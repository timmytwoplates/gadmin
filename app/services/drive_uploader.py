"""
Upload files to a Google Shared Drive using service account impersonation.
"""

import logging
from pathlib import Path
from typing import List

log = logging.getLogger(__name__)

_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"


def _drive_service(sa_path: str, impersonate_email: str):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    creds = service_account.Credentials.from_service_account_file(
        sa_path, scopes=[_DRIVE_SCOPE]
    ).with_subject(impersonate_email)
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _get_or_create_folder(service, name: str, parent_id: str, drive_id: str) -> str:
    safe = name.replace("'", "\\'")
    res = service.files().list(
        q=(
            f"name='{safe}' "
            f"and mimeType='application/vnd.google-apps.folder' "
            f"and '{parent_id}' in parents "
            f"and trashed=false"
        ),
        fields="files(id)",
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
        corpora="drive",
        driveId=drive_id,
    ).execute()
    existing = res.get("files", [])
    if existing:
        log.info("Reusing existing Drive folder: %s", name)
        return existing[0]["id"]
    folder = service.files().create(
        body={
            "name": name,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [parent_id],
        },
        fields="id",
        supportsAllDrives=True,
    ).execute()
    log.info("Created Drive folder: %s → %s", name, folder["id"])
    return folder["id"]


def _folder_url(service, folder_id: str) -> str:
    meta = service.files().get(
        fileId=folder_id, fields="webViewLink", supportsAllDrives=True
    ).execute()
    return meta.get("webViewLink", "")


def _upload_file(service, path: Path, folder_id: str) -> None:
    from googleapiclient.http import MediaFileUpload
    media = MediaFileUpload(str(path), mimetype="application/octet-stream", resumable=True)
    service.files().create(
        body={"name": path.name, "parents": [folder_id]},
        media_body=media,
        fields="id",
        supportsAllDrives=True,
    ).execute()
    log.info("Uploaded %s to Drive folder %s", path.name, folder_id)


def upload_to_shared_drive(
    sa_path: str,
    impersonate_email: str,
    shared_drive_id: str,
    folder_name: str,
    files: List[Path],
) -> str:
    """
    Create (or reuse) a folder named `folder_name` in the shared drive root,
    upload each file, and return the folder's web URL.
    """
    service = _drive_service(sa_path, impersonate_email)
    folder_id = _get_or_create_folder(service, folder_name, shared_drive_id, shared_drive_id)
    url = _folder_url(service, folder_id)
    for path in files:
        if path.exists():
            _upload_file(service, path, folder_id)
        else:
            log.warning("Skipping missing file: %s", path)
    return url
