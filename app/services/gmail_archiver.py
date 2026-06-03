"""
Gmail archiver — async, service-account-based.
Adapted from inbox_grabber/tim_gmailer.py. Uses domain-wide delegation to
impersonate any user without requiring per-user OAuth consent.
"""

import asyncio
import base64
import email as email_lib
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable, List, Optional, Set

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    import aiosqlite
except ImportError as exc:
    raise RuntimeError(
        f"Missing package: {exc}. "
        "Run: pip install google-auth google-api-python-client aiosqlite"
    ) from exc

log = logging.getLogger(__name__)

_GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
_BATCH = 100
_WORKERS = 20
_API_SEM = 10


@dataclass
class ArchiveStats:
    total: int = 0
    archived: int = 0
    errors: int = 0

    def pct(self) -> int:
        return int(self.archived / self.total * 100) if self.total else 0


ProgressFn = Callable[[ArchiveStats, str], None]


# ─── Auth ─────────────────────────────────────────────────────────────────────

def _gmail_service(sa_path: str, target_email: str):
    creds = service_account.Credentials.from_service_account_file(
        sa_path, scopes=[_GMAIL_SCOPE]
    ).with_subject(target_email)
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


# ─── Database ─────────────────────────────────────────────────────────────────

_SCHEMA = """
CREATE TABLE IF NOT EXISTS emails (
    id          INTEGER PRIMARY KEY,
    message_id  TEXT    NOT NULL UNIQUE,
    thread_id   TEXT    NOT NULL,
    sender      JSON    NOT NULL,
    recipients  JSON    NOT NULL,
    labels      JSON    NOT NULL,
    subject     TEXT    NOT NULL,
    body        TEXT    NOT NULL,
    size        INTEGER NOT NULL,
    timestamp   DATETIME NOT NULL,
    is_read     INTEGER NOT NULL,
    is_outgoing INTEGER NOT NULL,
    indexed_at  DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_id  ON emails(message_id);
CREATE INDEX IF NOT EXISTS idx_ts      ON emails(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sender  ON emails(json_extract(sender,'$.email'));
CREATE INDEX IF NOT EXISTS idx_thread  ON emails(thread_id);
"""


class _ArchiveDB:
    def __init__(self, path: Path):
        self._path = path
        self._lock = asyncio.Lock()
        self._seen: Set[str] = set()

    async def init(self) -> None:
        async with aiosqlite.connect(self._path) as db:
            await db.executescript(_SCHEMA)
            await db.commit()
        async with aiosqlite.connect(self._path) as db:
            async with db.execute("SELECT message_id FROM emails") as cur:
                async for row in cur:
                    self._seen.add(row[0])
        log.info("Archive DB: %d existing messages", len(self._seen))

    def seen(self, mid: str) -> bool:
        return mid in self._seen

    async def upsert(self, rows: List[dict]) -> int:
        fresh = [r for r in rows if r["message_id"] not in self._seen]
        if not fresh:
            return 0
        async with self._lock:
            async with aiosqlite.connect(self._path) as db:
                await db.executemany(
                    """
                    INSERT OR REPLACE INTO emails
                        (message_id, thread_id, sender, recipients, labels,
                         subject, body, size, timestamp, is_read, is_outgoing, indexed_at)
                    VALUES
                        (:message_id,:thread_id,:sender,:recipients,:labels,
                         :subject,:body,:size,:timestamp,:is_read,:is_outgoing,:indexed_at)
                    """,
                    [
                        {**r,
                         "sender":     json.dumps(r["sender"]),
                         "recipients": json.dumps(r["recipients"]),
                         "labels":     json.dumps(r["labels"])}
                        for r in fresh
                    ],
                )
                await db.commit()
        for r in fresh:
            self._seen.add(r["message_id"])
        return len(fresh)


# ─── Message parsing ──────────────────────────────────────────────────────────

def _decode(data: str) -> str:
    try:
        return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
    except Exception:
        return ""


def _body(payload: dict) -> str:
    def _walk(parts):
        text = html = ""
        for p in parts:
            mt = p.get("mimeType", "")
            d  = p.get("body", {}).get("data", "")
            if mt == "text/plain" and d:
                text = _decode(d)
            elif mt == "text/html" and d:
                html = _decode(d)
            elif "parts" in p:
                t2, h2 = _walk(p["parts"])
                text = text or t2
                html = html or h2
        return text, html

    if "parts" in payload:
        t, h = _walk(payload["parts"])
        return t or h
    d = payload.get("body", {}).get("data", "")
    return _decode(d) if d else ""


def _parse(msg: dict) -> dict:
    payload = msg.get("payload", {})
    hdrs = {h["name"].lower(): h["value"] for h in payload.get("headers", [])}
    name, addr = email_lib.utils.parseaddr(hdrs.get("from", ""))
    sender = {"name": name, "email": addr or hdrs.get("from", "")}
    recips: dict = {"to": [], "cc": [], "bcc": []}
    for f in ("to", "cc", "bcc"):
        for n, a in email_lib.utils.getaddresses([hdrs.get(f, "")]):
            if a:
                recips[f].append({"name": n, "email": a})
    labels = msg.get("labelIds", [])
    ts = datetime.fromtimestamp(int(msg.get("internalDate", 0)) / 1000).isoformat()
    return {
        "message_id": msg["id"],
        "thread_id":  msg["threadId"],
        "sender":     sender,
        "recipients": recips,
        "labels":     labels,
        "subject":    hdrs.get("subject", "(No Subject)"),
        "body":       _body(payload),
        "size":       int(msg.get("sizeEstimate", 0)),
        "timestamp":  ts,
        "is_read":    0 if "UNREAD" in labels else 1,
        "is_outgoing": 0,
        "indexed_at": datetime.now().isoformat(),
    }


# ─── Main entry point ─────────────────────────────────────────────────────────

async def archive_inbox(
    target_email: str,
    sa_path: str,
    output_db: Path,
    on_progress: Optional[ProgressFn] = None,
) -> ArchiveStats:
    """
    Archive a Gmail inbox to a SQLite file using service account impersonation.
    Safe to call multiple times — already-archived messages are skipped.
    """
    db = _ArchiveDB(output_db)
    await db.init()

    executor = ThreadPoolExecutor(max_workers=4)
    loop = asyncio.get_event_loop()
    run = lambda fn: loop.run_in_executor(executor, fn)  # noqa: E731

    service = await run(lambda: _gmail_service(sa_path, target_email))
    stats = ArchiveStats()
    api_sem = asyncio.Semaphore(_API_SEM)

    # ── List all message IDs ──────────────────────────────────────────────────
    if on_progress:
        on_progress(stats, "Listing messages…")

    ids: List[str] = []
    page_token = None
    while True:
        try:
            async with api_sem:
                result = await run(
                    lambda pt=page_token: service.users().messages().list(
                        userId="me", maxResults=500, pageToken=pt
                    ).execute()
                )
            ids.extend(m["id"] for m in result.get("messages", []))
            page_token = result.get("nextPageToken")
            if not page_token:
                break
        except HttpError as e:
            if e.resp.status == 429:
                await asyncio.sleep(30)
                continue
            log.error("List error: %s", e)
            break

    ids = [i for i in ids if not db.seen(i)]
    stats.total = len(ids)
    log.info("%s: %d new messages to archive", target_email, stats.total)

    if on_progress:
        on_progress(stats, f"Archiving {stats.total} messages…")

    # ── Fetch and store ───────────────────────────────────────────────────────
    work_sem = asyncio.Semaphore(_WORKERS)

    async def _fetch(mid: str) -> Optional[dict]:
        async with work_sem:
            async with api_sem:
                try:
                    raw = await run(
                        lambda m=mid: service.users().messages().get(
                            userId="me", id=m, format="full"
                        ).execute()
                    )
                    return _parse(raw)
                except HttpError as e:
                    if e.resp.status == 429:
                        await asyncio.sleep(1)
                    stats.errors += 1
                    return None

    for i in range(0, len(ids), _BATCH):
        batch = ids[i: i + _BATCH]
        results = await asyncio.gather(*[_fetch(mid) for mid in batch])
        saved = await db.upsert([r for r in results if r])
        stats.archived += saved
        if on_progress:
            on_progress(stats, f"Archiving messages… {stats.archived:,} / {stats.total:,}")

    if on_progress:
        on_progress(stats, "Complete")

    executor.shutdown(wait=False)
    return stats
