from fastapi import APIRouter, HTTPException
from app.db.sqlite import get_conn

router = APIRouter(prefix="/employees", tags=["Employees"])


def _sql(name: str) -> str:
    from pathlib import Path
    return (Path(__file__).parent.parent / "db" / "queries" / f"{name}.sql").read_text()


@router.get("/")
def list_employees(page: int = 1, page_size: int = 50):
    page_size = min(page_size, 200)
    offset = (page - 1) * page_size
    with get_conn() as conn:
        total = conn.execute(_sql("employees_count")).fetchone()[0]
        rows = conn.execute(_sql("employees_list"), {"limit": page_size, "offset": offset}).fetchall()
    return {
        "items": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{employee_id}")
def get_employee(employee_id: int):
    with get_conn() as conn:
        emp = conn.execute(_sql("employees_by_id"), {"id": employee_id}).fetchone()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        runs = conn.execute(
            _sql("gam_runs_by_employee"), {"employee_id": employee_id}
        ).fetchall()
    return {
        "employee": dict(emp),
        "runs": [dict(r) for r in runs],
    }
