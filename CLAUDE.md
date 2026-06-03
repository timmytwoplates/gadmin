# GADmin — Project Notes

Google Workspace employee onboarding/offboarding automation app.
Replaces manual GAM command spreadsheets with a web UI.

## Stack
Standard architecture per global CLAUDE.md: FastAPI + React/TypeScript + SQLite.

## Dev Commands

```bash
# Backend (from project root)
pip install -e .
uvicorn app.main:app --reload --port 8002
# Docs: http://localhost:8002/api/docs

# Frontend
cd frontend && npm install && npm run dev   # http://localhost:5173
cd frontend && npm run build                # output: frontend/dist/

# Windows launch (builds frontend + starts server)
launch_app.bat
```

## Key Files
- `app/services/commands.py` — builds GAM command arg lists for onboard/offboard
- `app/services/gam_runner.py` — subprocess wrapper for `gam.exe`
- `app/services/gmail_archiver.py` — async Gmail → SQLite archiver (service account)
- `app/services/drive_uploader.py` — uploads archive files to shared Drive
- `app/db/app_settings.py` — `seed_defaults()` sets all initial settings on first run
- `app/db/migrations/001_init.sql` — full schema

## GAM
- Executable path configured in Admin → Settings (`gam_path`)
- Default: `C:\GAM7\gam.exe`
- Variant: GAMADV-XTD3
- Setup: download from https://github.com/taers232c/GAMADV-XTD3/releases/latest
- Auth: `gam.exe oauth create` (browser-interactive, must be done manually)

## First-Time Configuration (Admin → Settings)
After first launch, configure these settings in the Admin page:
- `domains` — pipe-separated list of your Google Workspace domains
- `org_units` — pipe-separated list of your org units
- `email_groups` — pipe-separated list of email groups for onboarding
- `company_name`, `company_address`, etc. — used in email signatures
- `forward_to` — default email forwarding target for offboarded users
- `drive_transfer_to` — default Drive transfer target
- `calendar_1/2/3` — shared calendar IDs to add new users to
- `gam_service_account_path` — path to GAM's oauth2service.json (for Gmail archive)
- `archive_drive_id` — shared Drive ID for inbox archives

## Phase 2 (not yet built)
- NetSuite API sync (pull employee data, push offboard status)
