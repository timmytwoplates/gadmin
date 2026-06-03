import sqlite3
from contextlib import contextmanager
from pathlib import Path
from app.config import settings


@contextmanager
def get_conn():
    conn = sqlite3.connect(str(settings.db_file))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def run_migrations():
    migration_dir = Path(__file__).parent / "migrations"
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename TEXT PRIMARY KEY,
                applied_at TEXT DEFAULT (datetime('now'))
            )
        """)
        applied = {r[0] for r in conn.execute("SELECT filename FROM schema_migrations")}
        for f in sorted(migration_dir.glob("*.sql")):
            if f.name not in applied:
                conn.executescript(f.read_text())
                conn.execute(
                    "INSERT INTO schema_migrations (filename) VALUES (?)", (f.name,)
                )
