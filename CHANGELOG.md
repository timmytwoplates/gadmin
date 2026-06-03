# Changelog

## [Unreleased]

## [1.0.0] — 2026-06-02

### Added
- Onboard page: form-driven Google Workspace account creation via GAMADV-XTD3
  - Creates user, sets email signature, adds to email group, notifies manager, adds to shared calendars
  - Preview mode shows exact commands before execution
  - Per-step result display with stdout/stderr on failure
- Offboard page: automated employee departure workflow
  - Sets OOO vacation reply, enables email forwarding, transfers Drive, resets password, removes from all groups, deprovisions account
  - Confirmation dialog before execution
- History page: paginated table of all onboarded/offboarded employees with full per-run command log viewer
- Admin page with three tabs:
  - GAM Setup — detects install/auth state and guides through setup steps
  - Settings — inline-editable table of all runtime configuration; changes take effect immediately
  - Audit Log — paginated log of every write operation with admin name and timestamp
- Help page with step-by-step guides for non-technical admins
- GAM status banner in nav — alerts when GAM is not installed or not authenticated
- Full audit trail: every employee record and setting change logged to `audit_log`
- SQLite database with versioned migrations applied automatically on startup
- Structured logging with rotating file handlers (`logs/app.log`, `logs/error.log`)
- Request logging middleware with trace IDs on every response
- Global error handler returning clean JSON with trace IDs
- Email signature HTML template with configurable company fields
- Offboard OOO message template with `{name}`, `{company}`, `{forward_to}` variables
- Dark mode toggle persisted in localStorage
- Windows launch script (`launch_app.bat`) — double-click to start server and open browser
- First-time setup script (`setup\install_windows.bat`)
