"""
Fetch and cache Google Workspace user profiles via GAM.
Used by the Signatures tool to resolve real names, emails, and titles.
"""

import csv
import io
import time
import logging
from app.services.gam_runner import run_gam
from app.db.app_settings import get_setting

log = logging.getLogger(__name__)

_cache: dict = {"users": None, "ts": 0.0}
_TTL = 300  # 5 minutes


def list_users(refresh: bool = False) -> list[dict]:
    """Return all active Workspace users with profile fields, cached for 5 minutes."""
    now = time.monotonic()
    if not refresh and _cache["users"] is not None and (now - _cache["ts"]) < _TTL:
        return _cache["users"]

    res = run_gam("print", "users", "fields", "primaryEmail,name,organizations")
    if not res["success"] or not res["stdout"].strip():
        log.warning("GAM print users failed: %s", res["stderr"][:200])
        return _cache["users"] or []

    users = []
    try:
        reader = csv.DictReader(io.StringIO(res["stdout"]))
        for row in reader:
            email = row.get("primaryEmail", "").strip()
            if not email:
                continue
            users.append({
                "email":      email,
                "full_name":  row.get("name.fullName",  "").strip(),
                "first_name": row.get("name.givenName",  "").strip(),
                "last_name":  row.get("name.familyName", "").strip(),
                "job_title":  row.get("organizations.0.title", "").strip(),
            })
    except Exception as exc:
        log.error("Failed to parse GAM user list: %s", exc)
        return _cache["users"] or []

    users.sort(key=lambda u: (u["last_name"].lower(), u["first_name"].lower()))
    _cache["users"] = users
    _cache["ts"] = now
    log.info("Loaded %d workspace users", len(users))
    return users


def render_signature(template: str, user: dict) -> str:
    """
    Render the HTML signature template for a specific user.
    User fields ({email}, {full_name}, etc.) come from their Google profile.
    Company fields come from app settings.
    """
    try:
        return template.format(
            email=user.get("email", ""),
            full_name=user.get("full_name", ""),
            first_name=user.get("first_name", ""),
            last_name=user.get("last_name", ""),
            job_title=user.get("job_title", ""),
            company_name=get_setting("company_name"),
            company_address=get_setting("company_address"),
            company_city_state_zip=get_setting("company_city_state_zip"),
            company_phone=get_setting("company_phone"),
            company_fax=get_setting("company_fax"),
        )
    except KeyError as exc:
        return (
            f"<p style='color:#dc2626;font-family:sans-serif'>"
            f"Template error: unknown variable {exc}. "
            f"Check your template in Admin → Settings.</p>"
        )
