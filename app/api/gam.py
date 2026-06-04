import time
from fastapi import APIRouter
from app.services.gam_runner import gam_version, gam_available

router = APIRouter(prefix="/gam", tags=["GAM"])

_cache: dict = {"result": None, "ts": 0.0}
_TTL = 300  # re-run gam.exe at most once every 5 minutes


@router.get("/status")
def gam_status(refresh: bool = False):
    """Check if GAM is installed and return version info. Cached for 5 minutes."""
    now = time.monotonic()
    if not refresh and _cache["result"] and (now - _cache["ts"]) < _TTL:
        return _cache["result"]

    if not gam_available():
        result = {
            "installed": False,
            "version": None,
            "message": "GAM executable not found. See Admin > GAM Setup.",
        }
    else:
        r = gam_version()
        result = {
            "installed": True,
            "authenticated": r["success"],
            "version": r["stdout"].strip() if r["success"] else None,
            "message": r["stderr"].strip() if not r["success"] else None,
        }

    _cache["result"] = result
    _cache["ts"] = now
    return result
