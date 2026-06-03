import logging
from fastapi import APIRouter
from pydantic import BaseModel, field_validator
from app.db.sqlite import get_conn
from app.db.audit import log_change
from app.db.app_settings import get_setting
from app.services.commands import offboard_steps
from app.services.gam_runner import run_gam

log = logging.getLogger(__name__)
router = APIRouter(prefix="/offboard", tags=["Offboard"])


class OffboardRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    forward_to: str = ""
    new_password: str = ""
    drive_transfer_to: str = ""
    admin_name: str = "admin"

    @field_validator("first_name", "last_name", "email")
    @classmethod
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("must not be empty")
        return v.strip()


class StepResult(BaseModel):
    name: str
    command: str
    success: bool
    stdout: str
    stderr: str
    exit_code: int


@router.post("/preview")
def preview(req: OffboardRequest):
    forward_to = req.forward_to or get_setting("forward_to", "")
    new_password = req.new_password or get_setting("default_password", "ChangeMe123!")
    drive_transfer_to = req.drive_transfer_to or get_setting("drive_transfer_to", "")

    steps = offboard_steps(
        email=req.email,
        first=req.first_name,
        last=req.last_name,
        forward_to=forward_to,
        new_password=new_password,
        drive_transfer_to=drive_transfer_to,
    )
    return {
        "email": req.email,
        "steps": [
            {"name": s["name"], "command": "gam " + " ".join(
                f'"{a}"' if " " in str(a) else str(a) for a in s["args"]
            )}
            for s in steps
        ],
    }


@router.post("/run")
def run(req: OffboardRequest):
    forward_to = req.forward_to or get_setting("forward_to", "")
    new_password = req.new_password or get_setting("default_password", "ChangeMe123!")
    drive_transfer_to = req.drive_transfer_to or get_setting("drive_transfer_to", "")

    steps = offboard_steps(
        email=req.email,
        first=req.first_name,
        last=req.last_name,
        forward_to=forward_to,
        new_password=new_password,
        drive_transfer_to=drive_transfer_to,
    )

    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO employees
                (first_name, last_name, email, direction, processed_by)
            VALUES (?, ?, ?, 'offboard', ?)
            """,
            (req.first_name, req.last_name, req.email, req.admin_name),
        )
        employee_id = cur.lastrowid

    log_change(req.admin_name, "create", "employees", str(employee_id),
               new_value={"email": req.email, "direction": "offboard"})

    results = []
    all_ok = True
    for step in steps:
        res = run_gam(*step["args"])
        cmd_str = "gam " + " ".join(
            f'"{a}"' if " " in str(a) else str(a) for a in step["args"]
        )
        with get_conn() as conn:
            conn.execute(
                """
                INSERT INTO gam_runs
                    (employee_id, step_name, command_text, stdout, stderr, exit_code, success, ran_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    employee_id, step["name"], cmd_str,
                    res["stdout"], res["stderr"], res["exit_code"],
                    1 if res["success"] else 0, req.admin_name,
                ),
            )
        results.append(StepResult(
            name=step["name"],
            command=cmd_str,
            success=res["success"],
            stdout=res["stdout"],
            stderr=res["stderr"],
            exit_code=res["exit_code"],
        ))
        if not res["success"]:
            all_ok = False
            log.warning("Step '%s' failed for %s", step["name"], req.email)

    return {
        "employee_id": employee_id,
        "email": req.email,
        "success": all_ok,
        "steps": [r.model_dump() for r in results],
    }
