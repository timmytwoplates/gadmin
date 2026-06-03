import json
from app.db.sqlite import get_conn


def log_change(
    user_name: str,
    action: str,
    table_name: str,
    record_id: str,
    old_value: dict = None,
    new_value: dict = None,
):
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO audit_log (user_name, action, table_name, record_id, old_value, new_value)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                user_name,
                action,
                table_name,
                str(record_id),
                json.dumps(old_value) if old_value else None,
                json.dumps(new_value) if new_value else None,
            ),
        )
