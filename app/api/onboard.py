import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator
from app.db.sqlite import get_conn
from app.db.audit import log_change
from app.db.app_settings import get_setting
from app.services.commands import onboard_steps
from app.services.gam_runner import run_gam

log = logging.getLogger(__name__)
router = APIRouter(prefix="/onboard", tags=["Onboard"])


class OnboardRequest(BaseModel):
    first_name: str
    last_name: str
    domain: str
    org_unit: str
    email_group: str = ""
    job_title: str = ""
    password: str = ""
    manager_email: str = ""
    admin_name: str = "admin"

    @field_validator("first_name", "last_name", "domain", "org_unit")
    @classmethod
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("must not be empty")
        return v.strip()

    @property
    def email(self) -> str:
        first = self.first_name.lower().replace(" ", "")
        last = self.last_name.lower().replace(" ", "")
        return f"{first}.{last}@{self.domain}"


class StepResult(BaseModel):
    name: str
    command: str
    success: bool
    stdout: str
    stderr: str
    exit_code: int


@router.post("/preview")
def preview(req: OnboardRequest):
    """Return the commands that would be run — no execution."""
    pw = req.password or get_setting("default_password", "ChangeMe123!")
    steps = onboard_steps(
        first=req.first_name,
        last=req.last_name,
        email=req.email,
        password=pw,
        org_unit=req.org_unit,
        email_group=req.email_group,
        manager_email=req.manager_email,
        job_title=req.job_title,
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
def run(req: OnboardRequest):
    """Execute all onboarding GAM commands and log results."""
    pw = req.password or get_setting("default_password", "ChangeMe123!")
    steps = onboard_steps(
        first=req.first_name,
        last=req.last_name,
        email=req.email,
        password=pw,
        org_unit=req.org_unit,
        email_group=req.email_group,
        manager_email=req.manager_email,
        job_title=req.job_title,
    )

    # Insert employee record
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO employees
                (first_name, last_name, email, direction, job_title, org_unit, email_group, manager_email, processed_by)
            VALUES (?, ?, ?, 'onboard', ?, ?, ?, ?, ?)
            """,
            (
                req.first_name, req.last_name, req.email,
                req.job_title, req.org_unit, req.email_group,
                req.manager_email, req.admin_name,
            ),
        )
        employee_id = cur.lastrowid

    log_change(req.admin_name, "create", "employees", str(employee_id),
               new_value={"email": req.email, "direction": "onboard"})

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
