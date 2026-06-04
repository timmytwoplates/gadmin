import logging
import os
import tempfile

from fastapi import APIRouter
from pydantic import BaseModel

from app.db.app_settings import get_setting
from app.db.audit import log_change
from app.services.gam_runner import run_gam
from app.services.workspace_users import list_users, render_signature

log = logging.getLogger(__name__)
router = APIRouter(prefix="/signatures", tags=["Signatures"])


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/users")
def get_users(refresh: bool = False):
    """List all workspace users with profile data. Cached 5 minutes."""
    return {"users": list_users(refresh=refresh)}


class PreviewRequest(BaseModel):
    user_email: str
    template: str = ""


@router.post("/preview")
def preview_signature(req: PreviewRequest):
    """Render the signature template for a specific user — no GAM call, just HTML."""
    users = list_users()
    user = next((u for u in users if u["email"] == req.user_email), None)
    if not user:
        return {"html": "<p style='color:#dc2626;font-family:sans-serif'>User not found. Refresh the user list.</p>"}
    tmpl = req.template or get_setting("email_signature_template", "")
    return {"html": render_signature(tmpl, user)}


class PushRequest(BaseModel):
    user_email: str
    template: str = ""
    admin_name: str = "admin"


@router.post("/push")
def push_signature(req: PushRequest):
    """
    Set the default signature for one user via GAM.
    Uses a temp file to avoid CLI length limits on long HTML templates.
    Does NOT remove other Send-As signatures the user may have configured.
    """
    users = list_users()
    user = next((u for u in users if u["email"] == req.user_email), None)
    if not user:
        return {"success": False, "stderr": "User not found in directory cache. Try refreshing."}

    tmpl = req.template or get_setting("email_signature_template", "")
    html = render_signature(tmpl, user)

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".html", delete=False, encoding="utf-8"
        ) as f:
            f.write(html)
            tmp_path = f.name

        res = run_gam("user", req.user_email, "signature", "file", tmp_path, "html")

        if res["success"]:
            log_change(
                req.admin_name, "update", "users", req.user_email,
                new_value={"action": "set_signature"},
            )
        else:
            log.warning("Signature push failed for %s: %s", req.user_email, res["stderr"][:200])

        return {"success": res["success"], "stderr": res["stderr"]}

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
