"""
Builds the list of GAM command steps for onboarding and offboarding.
Each step is a dict: {name, args: list[str]}
args are passed to run_gam(*args) — no shell expansion needed.
"""
from datetime import date
from app.db.app_settings import get_setting


def _sig_html(first: str, last: str, job_title: str) -> str:
    tmpl = get_setting("email_signature_template", "{full_name} | {job_title}")
    return tmpl.format(
        full_name=f"{first} {last}",
        job_title=job_title or "",
        company_name=get_setting("company_name"),
        company_address=get_setting("company_address"),
        company_city_state_zip=get_setting("company_city_state_zip"),
        company_phone=get_setting("company_phone"),
        company_fax=get_setting("company_fax"),
    )


def onboard_steps(
    first: str,
    last: str,
    email: str,
    password: str,
    org_unit: str,
    email_group: str,
    manager_email: str,
    job_title: str,
) -> list[dict]:
    steps = []

    # 1 — Create user account
    steps.append({
        "name": "Create user account",
        "args": [
            "create", "user", email,
            "firstname", first,
            "lastname", last,
            "password", password,
            "org", org_unit,
        ],
    })

    # 2 — Set email signature
    sig = _sig_html(first, last, job_title)
    steps.append({
        "name": "Set email signature",
        "args": ["user", email, "signature", sig],
    })

    # 3 — Add to email group
    if email_group:
        steps.append({
            "name": f"Add to group {email_group}",
            "args": ["update", "group", email_group, "add", "member", email],
        })

    # 4 — Notify manager
    if manager_email:
        msg = (
            f"Here is the info for your new employee's Google Account. "
            f"Please share this and ensure they understand how to access their account. "
            f"Email: {email}  Password: {password}"
        )
        steps.append({
            "name": "Send account info to manager",
            "args": [
                "user", email, "sendemail",
                "subject", "New Employee Info",
                "message", msg,
                "recipient", manager_email,
            ],
        })

    # 5 — Shared calendars (up to 3, configured in Admin → Settings)
    for i, key in enumerate(["calendar_1", "calendar_2", "calendar_3"], start=1):
        cal_id = get_setting(key)
        if cal_id:
            steps.append({
                "name": f"Add to shared calendar {i}",
                "args": ["calendar", cal_id, "add", "editor", email],
            })

    return steps


def offboard_steps(
    email: str,
    first: str,
    last: str,
    forward_to: str,
    new_password: str,
    drive_transfer_to: str,
) -> list[dict]:
    steps = []
    company = get_setting("company_name", "the company")
    end_date = get_setting("offboard_end_date", "2099-12-31")
    start_date = date.today().isoformat()
    msg_tmpl = get_setting(
        "offboard_message_template",
        "{name} is no longer with {company}. Please email {forward_to} for your inquiry.",
    )
    ooo_message = msg_tmpl.format(
        name=f"{first} {last}",
        company=company,
        forward_to=forward_to,
    )

    # 1 — Set vacation / OOO message
    steps.append({
        "name": "Set OOO vacation message",
        "args": [
            "user", email, "vacation", "on",
            "subject", "No Longer with Company",
            "message", ooo_message,
            "startdate", start_date,
            "enddate", end_date,
        ],
    })

    # 2 — Add forwarding address (must exist before enabling)
    steps.append({
        "name": f"Add forwarding address {forward_to}",
        "args": ["user", email, "add", "forwardingaddress", forward_to],
    })

    # 3 — Enable forwarding
    steps.append({
        "name": "Enable email forwarding",
        "args": ["user", email, "forward", "yes", "markread", forward_to],
    })

    # 4 — Transfer Drive
    if drive_transfer_to:
        steps.append({
            "name": f"Transfer Drive to {drive_transfer_to}",
            "args": ["user", email, "transfer", "drive", drive_transfer_to],
        })

    # 5 — Reset password
    steps.append({
        "name": "Reset password",
        "args": ["update", "user", email, "password", new_password],
    })

    # 6 — Remove from all groups
    steps.append({
        "name": "Remove from all groups",
        "args": ["user", email, "delete", "groups"],
    })

    # 7 — Deprovision (revoke tokens, ASPs, sign out)
    steps.append({
        "name": "Deprovision (revoke tokens & sign out)",
        "args": ["user", email, "deprovision", "signout"],
    })

    return steps
