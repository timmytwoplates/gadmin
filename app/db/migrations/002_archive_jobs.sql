CREATE TABLE IF NOT EXISTS archive_jobs (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    target_email      TEXT    NOT NULL,
    destination       TEXT    NOT NULL DEFAULT 'shared_drive',
    local_path        TEXT    NOT NULL DEFAULT '',
    status            TEXT    NOT NULL DEFAULT 'pending',
    step              TEXT    NOT NULL DEFAULT '',
    total_messages    INTEGER NOT NULL DEFAULT 0,
    archived_messages INTEGER NOT NULL DEFAULT 0,
    folder_url        TEXT    NOT NULL DEFAULT '',
    error             TEXT    NOT NULL DEFAULT '',
    started_by        TEXT,
    started_at        TEXT    DEFAULT (datetime('now')),
    completed_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_archive_email  ON archive_jobs(target_email);
CREATE INDEX IF NOT EXISTS idx_archive_status ON archive_jobs(status);
