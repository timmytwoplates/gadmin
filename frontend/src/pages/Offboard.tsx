import { useEffect, useRef, useState } from 'react'
import { api, type ArchiveJob, type OffboardRequest, type PreviewResponse, type RunResponse, type Setting } from '../api'
import { CommandPreview } from '../components/CommandPreview'
import { ProgressBar } from '../components/ProgressBar'
import { Spinner } from '../components/Spinner'
import { Tooltip } from '../components/Tooltip'
import { useToast } from '../toast'

interface Props { adminName: string }

const EMPTY: OffboardRequest = {
  first_name: '', last_name: '', email: '',
  forward_to: '', new_password: '', drive_transfer_to: '',
}

export function Offboard({ adminName }: Props) {
  const { toast } = useToast()
  const [form, setForm] = useState<OffboardRequest>(EMPTY)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [result, setResult] = useState<RunResponse | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [running, setRunning] = useState(false)
  const [archiveInbox, setArchiveInbox] = useState(true)
  const [archiveJob, setArchiveJob] = useState<ArchiveJob | null>(null)
  const archivePollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    api.admin.settings().then((settings: Setting[]) => {
      const get = (k: string) => settings.find(s => s.key === k)?.value || ''
      setForm(f => ({
        ...f,
        forward_to: f.forward_to || get('forward_to'),
        drive_transfer_to: f.drive_transfer_to || get('drive_transfer_to'),
        new_password: f.new_password || get('default_password'),
      }))
    }).catch(() => {})
  }, [])

  function set(field: keyof OffboardRequest, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setPreview(null)
    setResult(null)
  }

  async function handlePreview() {
    if (!form.first_name || !form.last_name || !form.email) {
      toast.error('First name, last name, and email are required.')
      return
    }
    setPreviewing(true)
    try {
      const res = await api.offboard.preview({ ...form, admin_name: adminName })
      setPreview(res)
      setResult(null)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setPreviewing(false)
    }
  }

  async function handleRun() {
    if (!preview) return
    if (!confirm(`Offboard ${form.email}? This will set their email to forward, remove group memberships, and deprovision their account.`)) return
    setRunning(true)
    try {
      const res = await api.offboard.run({ ...form, admin_name: adminName })
      setResult(res)
      setPreview(null)
      if (res.success) {
        toast.success(`Offboarded ${res.email} — all steps completed.`)
      } else {
        toast.error(`Offboarding completed with errors for ${res.email}.`)
      }
      if (archiveInbox) {
        startArchive(form.email)
      }
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    return () => { if (archivePollRef.current) clearInterval(archivePollRef.current) }
  }, [])

  function startArchivePoll(jobId: number) {
    if (archivePollRef.current) clearInterval(archivePollRef.current)
    archivePollRef.current = setInterval(async () => {
      try {
        const job = await api.archive.status(jobId)
        setArchiveJob(job)
        if (job.status === 'complete' || job.status === 'error') {
          clearInterval(archivePollRef.current!)
          archivePollRef.current = null
          if (job.status === 'complete') toast.success('Inbox archived to shared drive.')
          else toast.error(`Archive failed: ${job.error}`)
        }
      } catch { /* silent */ }
    }, 3000)
  }

  async function startArchive(email: string) {
    try {
      const { job_id } = await api.archive.start(email, 'shared_drive', '', adminName)
      const job = await api.archive.status(job_id)
      setArchiveJob(job)
      startArchivePoll(job_id)
    } catch (e: unknown) {
      toast.error(`Archive could not start: ${(e as Error).message}`)
    }
  }

  function handleReset() {
    if (archivePollRef.current) clearInterval(archivePollRef.current)
    setForm(EMPTY)
    setPreview(null)
    setResult(null)
    setArchiveJob(null)
  }

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">Offboard Employee</h1>
      </div>

      <div className="two-col">
        <div className="form-card">
          <div className="form-group">
            <label>First Name <span className="required">*</span></label>
            <input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Natalie" />
          </div>
          <div className="form-group">
            <label>Last Name <span className="required">*</span></label>
            <input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Petersen" />
          </div>
          <div className="form-group">
            <label>Work Email <span className="required">*</span></label>
            <input className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="employee@example.com" />
          </div>

          <hr className="form-divider" />

          <div className="form-group">
            <label>
              Forward Email To
              <Tooltip text="Incoming email will be forwarded here. Defaults to the value in Settings.">
                <span className="help-icon">?</span>
              </Tooltip>
            </label>
            <input className="input" value={form.forward_to} onChange={e => set('forward_to', e.target.value)} placeholder="support@example.com" />
          </div>
          <div className="form-group">
            <label>
              Transfer Drive To
              <Tooltip text="Ownership of all Drive files will be transferred to this account.">
                <span className="help-icon">?</span>
              </Tooltip>
            </label>
            <input className="input" value={form.drive_transfer_to} onChange={e => set('drive_transfer_to', e.target.value)} placeholder="admin@example.com" />
          </div>
          <div className="form-group">
            <label>
              Reset Password To
              <Tooltip text="Account password will be changed to this value after offboarding.">
                <span className="help-icon">?</span>
              </Tooltip>
            </label>
            <input className="input" value={form.new_password} onChange={e => set('new_password', e.target.value)} placeholder="(default from settings)" />
          </div>

          <div className="form-group" style={{ marginTop: 8 }}>
            <label className="checkbox-label">
              <input type="checkbox" checked={archiveInbox}
                onChange={e => setArchiveInbox(e.target.checked)} />
              Archive inbox to shared drive
              <Tooltip text="Exports the full Gmail inbox to a searchable SQLite file in your archive drive. Runs after offboarding completes.">
                <span className="help-icon">?</span>
              </Tooltip>
            </label>
          </div>

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={handleReset} disabled={previewing || running}>
              Reset
            </button>
            <button className="btn btn-primary" onClick={handlePreview} disabled={previewing || running}>
              {previewing ? <Spinner /> : 'Preview Commands'}
            </button>
            {preview && (
              <button className="btn btn-danger" onClick={handleRun} disabled={running}>
                {running ? <Spinner /> : 'Run All'}
              </button>
            )}
          </div>
        </div>

        <div className="preview-col">
          {result && (
            <div className={`run-banner ${result.success ? 'run-ok' : 'run-partial'}`}>
              {result.success
                ? `All steps completed for ${result.email}`
                : `Completed with errors for ${result.email} — review below`}
            </div>
          )}
          {(preview || result) && (
            <CommandPreview
              steps={result ? result.steps : preview!.steps}
              ran={!!result}
            />
          )}
          {!preview && !result && (
            <div className="preview-placeholder">
              Fill in the employee's details and click <strong>Preview Commands</strong> to see what will run.
            </div>
          )}

          {archiveJob && (
            <div className="archive-job-card" style={{ marginTop: 16 }}>
              <div className="archive-job-header">
                <span className="archive-job-email">Inbox Archive</span>
                <span className={`badge badge-${archiveJob.status === 'complete' ? 'open' : archiveJob.status === 'error' ? 'lost' : 'working'}`}>
                  {archiveJob.status}
                </span>
              </div>
              <div className="archive-job-step">{archiveJob.step}</div>
              {archiveJob.total_messages > 0 && (
                <ProgressBar
                  value={archiveJob.total_messages > 0 ? Math.round(archiveJob.archived_messages / archiveJob.total_messages * 100) : 0}
                  label={`${archiveJob.archived_messages.toLocaleString()} / ${archiveJob.total_messages.toLocaleString()} messages`}
                />
              )}
              {archiveJob.status === 'running' && archiveJob.total_messages === 0 && (
                <ProgressBar value={0} label="Counting messages…" />
              )}
              {archiveJob.status === 'complete' && archiveJob.folder_url && (
                <a className="btn btn-secondary btn-sm" href={archiveJob.folder_url}
                   target="_blank" rel="noreferrer" style={{ marginTop: 10, display: 'inline-block' }}>
                  View in Drive →
                </a>
              )}
              {archiveJob.status === 'error' && (
                <div className="tool-result tool-result-fail" style={{ marginTop: 8 }}>
                  {archiveJob.error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
