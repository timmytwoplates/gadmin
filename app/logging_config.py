import json
import logging
import logging.handlers
from app.config import settings


class _JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "time": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            **({"exc": self.formatException(record.exc_info)} if record.exc_info else {}),
        })


def configure_logging():
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    fmt = (
        _JsonFormatter()
        if settings.log_format == "json"
        else logging.Formatter(
            "%(asctime)s %(levelname)-8s %(name)s — %(message)s", "%Y-%m-%d %H:%M:%S"
        )
    )

    handlers = [
        logging.StreamHandler(),
        logging.handlers.RotatingFileHandler(
            settings.logs_dir / "app.log", maxBytes=10_000_000, backupCount=5
        ),
        logging.handlers.RotatingFileHandler(
            settings.logs_dir / "error.log", maxBytes=10_000_000, backupCount=5
        ),
    ]
    handlers[2].setLevel(logging.WARNING)
    for h in handlers:
        h.setFormatter(fmt)

    logging.basicConfig(level=level, handlers=handlers, force=True)
