from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.db.sqlite import get_conn
from app.db.app_settings import get_all_settings, set_setting
from app.db.audit import log_change

router = APIRouter(prefix="/admin", tags=["Admin"])


class SettingUpdate(BaseModel):
    value: str
    admin_name: str = "admin"


@router.get("/settings")
def list_settings():
    return get_all_settings()


@router.put("/settings/{key}")
def update_setting(key: str, body: SettingUpdate):
    existing = next((s for s in get_all_settings() if s["key"] == key), None)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
    old_val = existing["value"]
    set_setting(key, body.value, user=body.admin_name)
    log_change(body.admin_name, "update", "app_settings", key,
               old_value={"value": old_val}, new_value={"value": body.value})
    return {"key": key, "value": body.value}


@router.get("/audit-log")
def audit_log(page: int = 1, page_size: int = 100, table_name: str = ""):
    page_size = min(page_size, 500)
    offset = (page - 1) * page_size
    with get_conn() as conn:
        if table_name:
            total = conn.execute(
                "SELECT COUNT(*) FROM audit_log WHERE table_name = ?", (table_name,)
            ).fetchone()[0]
            rows = conn.execute(
                "SELECT * FROM audit_log WHERE table_name = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (table_name, page_size, offset),
            ).fetchall()
        else:
            total = conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
            rows = conn.execute(
                "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (page_size, offset),
            ).fetchall()
    return {
        "items": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
