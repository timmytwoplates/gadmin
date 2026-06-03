from fastapi import APIRouter
from app.services.gam_runner import gam_version, gam_available

router = APIRouter(prefix="/gam", tags=["GAM"])


@router.get("/status")
def gam_status():
    """Check if GAM is installed and return version info."""
    if not gam_available():
        return {
            "installed": False,
            "version": None,
            "message": "GAM executable not found. See Admin > GAM Setup.",
        }
    result = gam_version()
    return {
        "installed": True,
        "authenticated": result["success"],
        "version": result["stdout"].strip() if result["success"] else None,
        "message": result["stderr"].strip() if not result["success"] else None,
    }
