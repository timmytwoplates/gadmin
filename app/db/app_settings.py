from app.db.sqlite import get_conn


def get_setting(key: str, default: str = "") -> str:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT value FROM app_settings WHERE key = ?", (key,)
        ).fetchone()
        return row[0] if row else default


def set_setting(key: str, value: str, description: str = "", user: str = "system"):
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO app_settings (key, value, description, updated_by, updated_at)
            VALUES (:key, :value, :description, :user, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET
                value=excluded.value,
                updated_by=excluded.updated_by,
                updated_at=excluded.updated_at
            """,
            {"key": key, "value": value, "description": description, "user": user},
        )


def get_all_settings() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT key, value, description, updated_by, updated_at FROM app_settings ORDER BY key"
        ).fetchall()
        return [dict(r) for r in rows]


def seed_defaults():
    defaults = {
        "gam_path": (r"C:\GAM7\gam.exe", "Path to gam.exe"),
        "forward_to": ("support@example.com", "Default offboard email forwarding destination"),
        "drive_transfer_to": ("admin@example.com", "Drive files transferred to this user on offboard"),
        "default_password": ("ChangeMe123!", "Default password for new accounts — change this"),
        "company_name": ("Example Company", "Company name used in signatures and messages"),
        "company_address": ("123 Main Street", "Street address for email signature"),
        "company_city_state_zip": ("Anytown, ST 12345", "City/state/zip for email signature"),
        "company_phone": ("555-000-0100", "Main office phone for email signature"),
        "company_fax": ("555-000-0101", "Fax number for email signature"),
        "calendar_1": (
            "",
            "Shared calendar ID added to new users on onboard (leave blank to skip)",
        ),
        "calendar_2": (
            "",
            "Shared calendar ID #2 added to new users on onboard (leave blank to skip)",
        ),
        "calendar_3": (
            "",
            "Shared calendar ID #3 added to new users on onboard (leave blank to skip)",
        ),
        "offboard_end_date": ("2099-12-31", "End date for OOO vacation messages"),
        "offboard_message_template": (
            "{name} is no longer with {company}. Please email {forward_to} for your inquiry.",
            "OOO message body. Variables: {name}, {company}, {forward_to}",
        ),
        "email_signature_template": (
            '<div dir="ltr"><div style="font-size:small">Regards,</div>'
            '<div style="font-size:small"><b><font size="4" color="#666666">{full_name}</font></b></div>'
            "<div><b>{job_title}</b></div>"
            "<div><b>{company_name}</b></div>"
            "<div>{company_address}</div>"
            "<div>{company_city_state_zip}</div>"
            "<div><b>Office</b>: {company_phone} | <b>Fax</b>: {company_fax}</div></div>",
            "HTML email signature. Variables: {full_name}, {job_title}, {company_name}, "
            "{company_address}, {company_city_state_zip}, {company_phone}, {company_fax}",
        ),
        "org_units": (
            "/Example Company",
            "Pipe-separated list of Google Workspace org units",
        ),
        "email_groups": (
            "all@example.com",
            "Pipe-separated list of email groups shown in the Onboard form",
        ),
        "domains": (
            "example.com",
            "Pipe-separated list of email domains shown in the Onboard form",
        ),
        "gam_service_account_path": (
            "",
            r"Path to GAM service account JSON key for Gmail archive — e.g. C:\Users\you\.gam\oauth2service.json",
        ),
        "archive_drive_id": (
            "",
            "Shared Drive ID for employee inbox archives (from the Drive URL)",
        ),
        "archive_admin_email": (
            "admin@example.com",
            "Admin email to impersonate when uploading archives to the shared drive",
        ),
    }
    with get_conn() as conn:
        for key, (value, description) in defaults.items():
            existing = conn.execute(
                "SELECT 1 FROM app_settings WHERE key = ?", (key,)
            ).fetchone()
            if not existing:
                conn.execute(
                    """
                    INSERT INTO app_settings (key, value, description, updated_by, updated_at)
                    VALUES (?, ?, ?, 'system', datetime('now'))
                    """,
                    (key, value, description),
                )
