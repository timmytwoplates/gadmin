import csv
import io
import logging
from fastapi import APIRouter
from pydantic import BaseModel
from app.db.app_settings import get_setting
from app.db.audit import log_change
from app.services.gam_runner import run_gam

log = logging.getLogger(__name__)
router = APIRouter(prefix="/tools", tags=["Tools"])


# ─── Request models ───────────────────────────────────────────────────────────

class ResetPasswordRequest(BaseModel):
    email: str
    password: str = ""
    admin_name: str = "admin"


class GroupMemberRequest(BaseModel):
    group_email: str
    member_email: str
    action: str          # "add" | "remove"
    admin_name: str = "admin"


class AliasRequest(BaseModel):
    user_email: str
    alias: str
    action: str          # "add" | "remove"
    admin_name: str = "admin"


# ─── Reset password ───────────────────────────────────────────────────────────

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    pw = req.password or get_setting("default_password", "ChangeMe123!")
    res = run_gam("update", "user", req.email, "password", pw)
    if res["success"]:
        log_change(req.admin_name, "update", "users", req.email,
                   new_value={"action": "reset_password"})
    return {"success": res["success"], "stdout": res["stdout"], "stderr": res["stderr"]}


# ─── Group members ────────────────────────────────────────────────────────────

@router.get("/groups/{group_email:path}/members")
def list_group_members(group_email: str):
    res = run_gam("print", "members", "group", group_email, "fields", "email,role,type")
    if not res["success"]:
        return {"members": [], "error": res["stderr"]}
    members = []
    try:
        reader = csv.DictReader(io.StringIO(res["stdout"]))
        for row in reader:
            if row.get("email"):
                members.append({
                    "email": row["email"],
                    "role": row.get("role", "MEMBER"),
                    "type": row.get("type", "USER"),
                })
    except Exception:
        pass
    return {"members": members}


@router.post("/groups/members")
def update_group_member(req: GroupMemberRequest):
    if req.action not in ("add", "remove"):
        return {"success": False, "stderr": "action must be 'add' or 'remove'"}
    res = run_gam("update", "group", req.group_email, req.action, "member", req.member_email)
    if res["success"]:
        log_change(req.admin_name, "update", "groups", req.group_email,
                   new_value={"action": req.action, "member": req.member_email})
    return {"success": res["success"], "stdout": res["stdout"], "stderr": res["stderr"]}


# ─── Aliases ──────────────────────────────────────────────────────────────────

@router.get("/users/{email:path}/aliases")
def list_aliases(email: str):
    res = run_gam("info", "user", email)
    if not res["success"]:
        return {"aliases": [], "error": res["stderr"]}
    return {"aliases": _parse_aliases(res["stdout"])}


@router.post("/aliases")
def update_alias(req: AliasRequest):
    if req.action not in ("add", "remove"):
        return {"success": False, "stderr": "action must be 'add' or 'remove'"}
    res = run_gam("update", "user", req.user_email, req.action, "alias", req.alias)
    if res["success"]:
        log_change(req.admin_name, "update", "users", req.user_email,
                   new_value={"action": f"{req.action}_alias", "alias": req.alias})
    return {"success": res["success"], "stdout": res["stdout"], "stderr": res["stderr"]}


def _parse_aliases(gam_info_output: str) -> list[str]:
    """Parse alias lines from 'gam info user' text output."""
    aliases = []
    in_section = False
    for line in gam_info_output.splitlines():
        stripped = line.strip()
        if "Email Aliases:" in stripped or "Aliases:" in stripped:
            in_section = True
            continue
        if in_section:
            if stripped and "@" in stripped:
                aliases.append(stripped)
            elif stripped and "@" not in stripped:
                in_section = False
    return aliases
