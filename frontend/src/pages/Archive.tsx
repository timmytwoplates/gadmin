import { useEffect, useRef, useState } from 'react'
import { api, type ArchiveJob } from '../api'
import { ProgressBar } from '../components/ProgressBar'
import { Spinner } from '../components/Spinner'
import { Tooltip } from '../components/Tooltip'
import { useToast } from '../toast'

interface Props { adminName: string }

const POLL_MS = 3000

export function Archive({ adminName }: Props) {
  const { toast } = useToast()
  const [email, setEmail]         = useState('')
  const [dest, setDest]           = useState<'shared_drive' | 'local'>('shared_drive')
  const [localPath, setLocalPath] = useState('')
  const [starting, setStarting]   = useState(false)
  const [activeJob, setActiveJob] = useState<ArchiveJob | null>(null)
  const [history, setHistory]     = useState<ArchiveJob[]>([])
  const [histTotal, setHistTotal] = useState(0)
  const [histPage, setHistPage]   = useState(1)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    loadHistory()
  }, [histPage])

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  function startPolling(jobId: number) {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const job = await api.archive.status(jobId)
        setActiveJob(job)
        if (job.status === 'complete' || job.status === 'error') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          loadHistory()
          if (job.status === 'complete') toast.success(`Archive complete for ${job.target_email}.`)
          else toast.error(`Archive failed: ${job.error}`)
        }
      } catch { /* silent */ }
    }, POLL_MS)
  }

  async function loadHistory() {
    try {
      const r = await api.archive.list(histPage)
      setHistory(r.items)
      setHistTotal(r.total)
    } catch { /* silent */ }
  }

  async function handleStart() {
    if (!email.trim()) { toast.error('Email is required.'); return }
    if (dest === 'local' && !localPath.trim()) { toast.error('Local path is required.'); return }
    setStarting(true)
    try {
      const { job_id } = await api.archive.start(email.trim(), dest, localPath.trim(), adminName)
      const job = await api.archive.status(job_id)
      setActiveJob(job)
      startPolling(job_id)
      toast.info(`Archive started for ${email}.`)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setStarting(false)
    }
  }

  const histPages = Math.ceil(histTotal / 50)

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">Archive</h1>
        <span className="count-badge muted" style={{ fontSize: 12 }}>
          Gmail → SQLite · exports to shared drive or local path
        </span>
      </div>

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <div className="form-card" style={{ maxWidth: 540, marginBottom: 24 }}>
        <div className="form-group">
          <label>
            Target Email <span className="required">*</span>
            <Tooltip text="The Google Workspace account to archive. Can be any user on your domain, including yourself.">
              <span className="help-icon">?</span>
            </Tooltip>
          </label>
          <input
            className="input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="employee@example.com"
            onKeyDown={e => e.key === 'Enter' && handleStart()}
          />
        </div>

        <div className="form-group">
          <label>Destination</label>
          <div className="radio-group">
            <label className="radio-label">
              <input type="radio" value="shared_drive" checked={dest === 'shared_drive'}
                onChange={() => setDest('shared_drive')} />
              Archive Drive
              <Tooltip text="Creates a folder named after the email address in your shared archive drive.">
                <span className="help-icon">?</span>
              </Tooltip>
            </label>
            <label className="radio-label">
              <input type="radio" value="local" checked={dest === 'local'}
                onChange={() => setDest('local')} />
              Local Path
              <Tooltip text="Saves inbox.db to a folder on this machine — use for personal backups to an external drive.">
                <span className="help-icon">?</span>
              </Tooltip>
            </label>
          </div>
        </div>

        {dest === 'local' && (
          <div className="form-group">
            <label>Local Path <span className="required">*</span></label>
            <input
              className="input mono"
              value={localPath}
              onChange={e => setLocalPath(e.target.value)}
              placeholder="D:\Backups"
            />
          </div>
        )}

        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={handleStart}
            disabled={starting || activeJob?.status === 'running'}
          >
            {starting ? <Spinner /> : 'Archive Inbox'}
          </button>
        </div>
      </div>

      {/* ── Active job ───────────────────────────────────────────────────── */}
      {activeJob && (
        <div className="archive-job-card">
          <div className="archive-job-header">
            <span className="archive-job-email">{activeJob.target_email}</span>
            <span className={`badge badge-${activeJob.status === 'complete' ? 'open' : activeJob.status === 'error' ? 'lost' : 'working'}`}>
              {activeJob.status}
            </span>
          </div>

          <div className="archive-job-step">{activeJob.step}</div>

          {activeJob.total_messages > 0 && (
            <ProgressBar
              value={activeJob.pct ?? 0}
              label={`${activeJob.archived_messages.toLocaleString()} / ${activeJob.total_messages.toLocaleString()} messages`}
            />
          )}
          {activeJob.status === 'running' && activeJob.total_messages === 0 && (
            <ProgressBar value={0} label="Counting messages…" />
          )}

          {activeJob.status === 'complete' && activeJob.folder_url && (
            <a className="btn btn-secondary btn-sm" href={activeJob.folder_url} target="_blank" rel="noreferrer"
               style={{ marginTop: 12, display: 'inline-block' }}>
              View in Drive →
            </a>
          )}
          {activeJob.status === 'error' && (
            <div className="tool-result tool-result-fail" style={{ marginTop: 12 }}>
              {activeJob.error}
            </div>
          )}
        </div>
      )}

      {/* ── History ──────────────────────────────────────────────────────── */}
      <div className="section" style={{ marginTop: 32 }}>
        <h2 className="section-title">Archive History</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Destination</th>
                <th>Messages</th>
                <th>Status</th>
                <th>Started By</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 32 }}>No archives yet.</td></tr>
              )}
              {history.map(job => (
                <tr key={job.id}>
                  <td className="mono">{job.target_email}</td>
                  <td>{job.destination === 'shared_drive' ? 'Archive Drive' : 'Local'}</td>
                  <td>{job.archived_messages > 0 ? job.archived_messages.toLocaleString() : '—'}</td>
                  <td>
                    <span className={`badge badge-${job.status === 'complete' ? 'open' : job.status === 'error' ? 'lost' : 'working'}`}>
                      {job.status}
                    </span>
                  </td>
                  <td>{job.started_by || '—'}</td>
                  <td>{job.started_at?.slice(0, 16)}</td>
                  <td>
                    {job.folder_url && job.status === 'complete' && (
                      <a className="btn btn-sm btn-secondary" href={job.folder_url}
                         target="_blank" rel="noreferrer">
                        {job.destination === 'shared_drive' ? 'Drive →' : 'Folder'}
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {histPages > 1 && (
          <div className="pagination">
            <button className="btn btn-sm btn-secondary" disabled={histPage === 1}
              onClick={() => setHistPage(p => p - 1)}>← Prev</button>
            <span className="count-badge">Page {histPage} of {histPages}</span>
            <button className="btn btn-sm btn-secondary" disabled={histPage >= histPages}
              onClick={() => setHistPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </main>
  )
}
