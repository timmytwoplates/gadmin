import asyncio
import logging
import shutil
import tempfile
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from app.db.sqlite import get_conn
from app.db.app_settings import get_setting
from app.db.audit import log_change

log = logging.getLogger(__name__)
router = APIRouter(prefix="/archive", tags=["Archive"])

# Keep task references alive so the GC doesn't collect them mid-run
_tasks: set = set()


# ─── Models ───────────────────────────────────────────────────────────────────

class StartArchiveRequest(BaseModel):
    target_email: str
    destination: str = "shared_drive"   # "shared_drive" | "local"
    local_path: str = ""
    admin_name: str = "admin"


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/start")
async def start_archive(req: StartArchiveRequest):
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO archive_jobs
                (target_email, destination, local_path, status, step, started_by)
            VALUES (?, ?, ?, 'pending', 'Starting…', ?)
            """,
            (req.target_email, req.destination, req.local_path, req.admin_name),
        )
        job_id = cur.lastrowid

    log_change(req.admin_name, "create", "archive_jobs", str(job_id),
               new_value={"target_email": req.target_email, "destination": req.destination})

    task = asyncio.create_task(
        _run(job_id, req.target_email, req.destination, req.local_path)
    )
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)

    return {"job_id": job_id}


@router.get("/{job_id}/status")
def archive_status(job_id: int):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM archive_jobs WHERE id = ?", (job_id,)
        ).fetchone()
    if not row:
        return {"error": "Job not found"}
    return dict(row)


@router.get("/")
def list_archives(page: int = 1, page_size: int = 50):
    page_size = min(page_size, 200)
    offset = (page - 1) * page_size
    with get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) FROM archive_jobs").fetchone()[0]
        rows = conn.execute(
            "SELECT * FROM archive_jobs ORDER BY started_at DESC LIMIT ? OFFSET ?",
            (page_size, offset),
        ).fetchall()
    return {
        "items": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ─── Background worker ────────────────────────────────────────────────────────

def _update(job_id: int, **kwargs):
    if not kwargs:
        return
    cols = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [job_id]
    with get_conn() as conn:
        conn.execute(f"UPDATE archive_jobs SET {cols} WHERE id = ?", vals)


async def _run(job_id: int, target_email: str, destination: str, local_path_str: str):
    from app.services.gmail_archiver import archive_inbox
    from app.services.drive_uploader import upload_to_shared_drive

    _update(job_id, status="running", step="Starting…")

    tmp_dir = tempfile.mkdtemp(prefix="gadmin_archive_")
    try:
        inbox_db = Path(tmp_dir) / "inbox.db"
        sa_path = get_setting("gam_service_account_path")
        if not sa_path:
            raise ValueError(
                "gam_service_account_path is not configured. "
                "Set it in Admin → Settings to the full path of your GAM oauth2service.json file."
            )

        def on_progress(stats, step_msg):
            _update(
                job_id,
                step=step_msg,
                total_messages=stats.total,
                archived_messages=stats.archived,
            )

        await archive_inbox(
            target_email=target_email,
            sa_path=sa_path,
            output_db=inbox_db,
            on_progress=on_progress,
        )

        _update(job_id, step="Uploading…")

        if destination == "shared_drive":
            shared_drive_id = get_setting("archive_drive_id")
            admin_email = get_setting(
                "archive_admin_email",
                get_setting("drive_transfer_to", ""),
            )
            folder_url = await asyncio.to_thread(
                upload_to_shared_drive,
                sa_path,
                admin_email,
                shared_drive_id,
                target_email,
                [inbox_db],
            )
            _update(
                job_id,
                status="complete",
                step="Complete",
                folder_url=folder_url,
                completed_at=datetime.now().isoformat(),
            )
        else:
            dest = Path(local_path_str) / target_email
            dest.mkdir(parents=True, exist_ok=True)
            shutil.copy2(inbox_db, dest / "inbox.db")
            _update(
                job_id,
                status="complete",
                step="Complete",
                folder_url=str(dest),
                completed_at=datetime.now().isoformat(),
            )

    except Exception as exc:
        log.error("Archive job %d failed: %s", job_id, exc, exc_info=True)
        _update(
            job_id,
            status="error",
            step="Failed",
            error=str(exc),
            completed_at=datetime.now().isoformat(),
        )
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
