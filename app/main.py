import logging
import time
import uuid
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from app.logging_config import configure_logging

configure_logging()

from app.config import settings
from app.db.sqlite import run_migrations
from app.db.app_settings import seed_defaults
from app.api.errors import global_exception_handler
from app.api.onboard import router as onboard_router
from app.api.offboard import router as offboard_router
from app.api.employees import router as employees_router
from app.api.gam import router as gam_router
from app.api.admin import router as admin_router
from app.api.tools import router as tools_router
from app.api.archive import router as archive_router
from app.api.signatures import router as signatures_router

log = logging.getLogger(__name__)

app = FastAPI(
    title="GADmin",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        trace_id = str(uuid.uuid4())[:8]
        start = time.perf_counter()
        response = await call_next(request)
        ms = (time.perf_counter() - start) * 1000
        logging.getLogger("http").info(
            "%s %s %s %.0fms [%s]",
            request.method, request.url.path, response.status_code, ms, trace_id,
        )
        response.headers["X-Trace-Id"] = trace_id
        return response


app.add_middleware(RequestLogMiddleware)
app.add_exception_handler(Exception, global_exception_handler)

_API = "/api"
for r in [onboard_router, offboard_router, employees_router, gam_router, admin_router, tools_router, archive_router, signatures_router]:
    app.include_router(r, prefix=_API)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# Serve built frontend
_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if _DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        return FileResponse(str(_DIST / "index.html"))


@app.on_event("startup")
def on_startup():
    settings.ensure_dirs()
    run_migrations()
    seed_defaults()
    # Mark any jobs that were mid-run when the server stopped
    from app.db.sqlite import get_conn
    with get_conn() as conn:
        conn.execute(
            "UPDATE archive_jobs SET status='error', error='Server restarted mid-run' "
            "WHERE status IN ('pending','running')"
        )
    log.info("GADmin started. GAM path: %s", settings.gam_path)
