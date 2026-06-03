import logging
import traceback
import uuid
from fastapi import Request
from fastapi.responses import JSONResponse
from app.config import settings

log = logging.getLogger(__name__)


async def global_exception_handler(request: Request, exc: Exception):
    trace_id = str(uuid.uuid4())[:8]
    log.error("Unhandled exception [%s]: %s\n%s", trace_id, exc, traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={
            "error": "An unexpected error occurred.",
            "trace_id": trace_id,
            "detail": str(exc) if settings.app_env == "development" else None,
        },
    )
