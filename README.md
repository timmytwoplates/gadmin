# GADmin

Web app for automating Google Workspace employee onboarding and offboarding. Replaces the manual "GAM and accounts.xlsm" spreadsheet — an admin fills in a form, reviews the generated commands, and clicks Run. Every step is logged with output and error details.

Built with FastAPI + React/TypeScript + SQLite. Runs locally on Windows.

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- [GAMADV-XTD3](https://github.com/taers232c/GAMADV-XTD3/releases/latest) installed at `C:\GAM7\gam.exe` (configurable in Admin > Settings)
- GAM authenticated against your Google Workspace domain (`gam.exe oauth create`)

---

## First-Time Setup

```bat
setup\install_windows.bat
```

This installs Python dependencies, builds the frontend, and creates `.env` from the template.

---

## Running

```bat
launch_app.bat
```

Double-click to start the server and open the browser. The app runs at `http://localhost:8000`.

---

## Running in Dev

```bash
# Backend (auto-reload on save)
pip install -e .
uvicorn app.main:app --reload --port 8000
# API docs: http://localhost:8000/api/docs

# Frontend (hot-reload)
cd frontend && npm run dev
# http://localhost:5173
```

---

## Building for Production

```bash
cd frontend && npm run build
```

The built files land in `frontend/dist/` and are served automatically by FastAPI at `/`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in values. All settings are optional — the app seeds sensible defaults on first run.

| Key | Description | Default |
|-----|-------------|---------|
| `GAM_PATH` | Path to `gam.exe` | `C:\GAM7\gam.exe` |
| `DATABASE_URL` | SQLite file path | `data/gadmin.db` |
| `LOG_LEVEL` | `DEBUG` / `INFO` / `WARNING` | `INFO` |
| `LOG_FORMAT` | `pretty` (dev) or `json` (prod) | `pretty` |

Runtime settings (forward-to email, calendar IDs, company info, etc.) are managed in **Admin → Settings** — no restart needed.

---

## App Settings (Admin → Settings)

All runtime configuration lives in the database and is editable in the browser:

| Setting | Description |
|---------|-------------|
| `gam_path` | Full path to `gam.exe` |
| `domains` | Pipe-separated list of email domains (e.g. `example.com\|subsidiary.com`) |
| `org_units` | Pipe-separated list of Google Workspace org units |
| `email_groups` | Pipe-separated list of email groups shown in the Onboard form |
| `default_password` | Default password for new accounts |
| `forward_to` | Default offboard email forwarding destination |
| `drive_transfer_to` | Default Drive transfer target on offboard |
| `company_name` | Used in email signatures and OOO messages |
| `company_address` / `company_city_state_zip` / `company_phone` / `company_fax` | Signature fields |
| `calendar_wei_ooo` / `calendar_ace_ooo` / `calendar_wei_dj` | Shared calendar IDs added on onboard |
| `email_signature_template` | HTML email signature with `{full_name}`, `{job_title}`, etc. placeholders |
| `offboard_message_template` | OOO message body with `{name}`, `{company}`, `{forward_to}` placeholders |
| `offboard_end_date` | End date for OOO vacation replies (default `2099-12-31`) |

---

## GAM Setup

1. Download GAMADV-XTD3 from GitHub and extract to `C:\GAM7`.
2. Run `C:\GAM7\gam.exe oauth create` in a terminal — this opens a browser for Google OAuth.
3. Open **Admin → GAM Setup** in the app and click Refresh to confirm the status.

The Admin page walks through these steps if GAM isn't detected.

---

## Common Tasks

**Run onboarding manually (re-run a failed step)**
Open History, find the employee, click View to see which step failed and the exact error.

**Change the default forward-to email**
Admin → Settings → `forward_to`

**Change company info in signatures**
Admin → Settings → `company_name`, `company_address`, `company_phone`, etc.

**Add a new email domain**
Admin → Settings → `domains` — append `|newdomain.com` to the existing value.

**View all audit history**
Admin → Audit Log — every create/update/delete is recorded with the admin name and timestamp.
