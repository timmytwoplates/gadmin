import logging
import subprocess
from pathlib import Path
from app.db.app_settings import get_setting

log = logging.getLogger(__name__)

TIMEOUT = 120  # seconds per command


def _gam_exe() -> str:
    return get_setting("gam_path", r"C:\GAM7\gam.exe")


def run_gam(*args: str) -> dict:
    exe = _gam_exe()
    cmd = [exe] + list(args)
    cmd_str = " ".join(str(a) for a in cmd)
    log.info("Running GAM: %s", cmd_str)
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=TIMEOUT,
        )
        success = result.returncode == 0
        if not success:
            log.warning("GAM exited %d: %s", result.returncode, result.stderr[:500])
        return {
            "command": cmd_str,
            "success": success,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode,
        }
    except FileNotFoundError:
        msg = f"GAM not found at '{exe}'. Install GAMADV-XTD3 and check the gam_path setting."
        log.error(msg)
        return {"command": cmd_str, "success": False, "stdout": "", "stderr": msg, "exit_code": -1}
    except subprocess.TimeoutExpired:
        msg = f"GAM command timed out after {TIMEOUT}s"
        log.error(msg)
        return {"command": cmd_str, "success": False, "stdout": "", "stderr": msg, "exit_code": -2}


def gam_version() -> dict:
    return run_gam("version")


def gam_available() -> bool:
    exe = _gam_exe()
    return Path(exe).exists()
