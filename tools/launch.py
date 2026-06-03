"""
GADmin launcher — build frontend, find a free port, open browser, start server.
Run via launch_app.bat (double-click).
"""
import socket
import subprocess
import sys
from pathlib import Path

ROOT     = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
NPM      = "npm.cmd" if sys.platform == "win32" else "npm"


def build_frontend() -> bool:
    print("Building frontend...")
    result = subprocess.run([NPM, "run", "build"], cwd=FRONTEND)
    if result.returncode != 0:
        print("\nFrontend build failed. Fix the error above and try again.")
        return False
    return True


def find_free_port(start: int = 8002) -> int:
    for port in range(start, start + 20):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("127.0.0.1", port))
                return port
        except OSError:
            continue
    raise RuntimeError("No free port found in range 8002-8021")


if not build_frontend():
    input("\nPress Enter to close.")
    sys.exit(1)

port = find_free_port()
url  = f"http://127.0.0.1:{port}"
print(f"\nStarting GADmin on {url}")

import webbrowser
webbrowser.open(url)

sys.exit(subprocess.run(
    [sys.executable, "-m", "uvicorn", "app.main:app",
     "--host", "127.0.0.1", "--port", str(port)]
).returncode)
