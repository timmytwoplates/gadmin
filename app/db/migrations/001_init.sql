CREATE TABLE IF NOT EXISTS employees (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,
    email       TEXT NOT NULL,
    direction   TEXT NOT NULL CHECK (direction IN ('onboard','offboard')),
    job_title   TEXT,
    org_unit    TEXT,
    email_group TEXT,
    manager_email TEXT,
    processed_by TEXT,
    processed_at TEXT DEFAULT (datetime('now')),
    notes       TEXT,
    deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_direction ON employees(direction);

CREATE TABLE IF NOT EXISTS gam_runs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id  INTEGER NOT NULL REFERENCES employees(id),
    step_name    TEXT NOT NULL,
    command_text TEXT NOT NULL,
    stdout       TEXT,
    stderr       TEXT,
    exit_code    INTEGER,
    success      INTEGER NOT NULL DEFAULT 0,
    ran_by       TEXT,
    ran_at       TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gam_runs_employee ON gam_runs(employee_id);

CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    description TEXT,
    updated_by  TEXT,
    updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_name   TEXT,
    action      TEXT NOT NULL,
    table_name  TEXT NOT NULL,
    record_id   TEXT,
    old_value   TEXT,
    new_value   TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name, record_id);
