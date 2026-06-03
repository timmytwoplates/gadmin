import { useEffect, useState } from 'react'
import { api, type Employee, type EmployeeDetail } from '../api'
import { Spinner } from '../components/Spinner'

export function History() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<EmployeeDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const PAGE_SIZE = 50

  useEffect(() => {
    setLoading(true)
    api.employees.list(page, PAGE_SIZE)
      .then(r => { setEmployees(r.items); setTotal(r.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page])

  async function openDetail(id: number) {
    setLoadingDetail(true)
    try {
      const detail = await api.employees.get(id)
      setSelected(detail)
    } catch {
      //
    } finally {
      setLoadingDetail(false)
    }
  }

  const pages = Math.ceil(total / PAGE_SIZE)

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">History</h1>
        <span className="count-badge">{total} records</span>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <strong>{selected.employee.first_name} {selected.employee.last_name}</strong>
              <span className={`badge badge-${selected.employee.direction}`}>{selected.employee.direction}</span>
              <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="modal-meta">
              {selected.employee.email} · Processed by {selected.employee.processed_by || '—'} · {selected.employee.processed_at?.slice(0, 16)}
            </div>
            <div className="modal-runs">
              {selected.runs.map(run => (
                <div key={run.id} className={`run-row ${run.success ? 'run-ok' : 'run-fail'}`}>
                  <div className="run-row-header">
                    <span className={`cmd-badge ${run.success ? 'cmd-badge-ok' : 'cmd-badge-fail'}`}>
                      {run.success ? '✓' : '✗'}
                    </span>
                    <span className="run-step-name">{run.step_name}</span>
                    <span className="run-time">{run.ran_at?.slice(0, 16)}</span>
                  </div>
                  <code className="cmd-text">{run.command_text}</code>
                  {!run.success && run.stderr && <div className="cmd-error">{run.stderr}</div>}
                  {run.success && run.stdout && <div className="cmd-output">{run.stdout}</div>}
                </div>
              ))}
              {selected.runs.length === 0 && <div className="muted">No runs recorded.</div>}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-center"><Spinner /></div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Direction</th>
                  <th>Processed By</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 && (
                  <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: '32px' }}>No records yet.</td></tr>
                )}
                {employees.map(emp => (
                  <tr key={emp.id}>
                    <td>{emp.first_name} {emp.last_name}</td>
                    <td className="mono">{emp.email}</td>
                    <td>
                      <span className={`badge badge-${emp.direction}`}>{emp.direction}</span>
                    </td>
                    <td>{emp.processed_by || '—'}</td>
                    <td>{emp.processed_at?.slice(0, 16)}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openDetail(emp.id)}
                        disabled={loadingDetail}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="pagination">
              <button className="btn btn-sm btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span className="count-badge">Page {page} of {pages}</span>
              <button className="btn btn-sm btn-secondary" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
