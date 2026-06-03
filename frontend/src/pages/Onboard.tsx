import { useEffect, useState } from 'react'
import { api, type OnboardRequest, type PreviewResponse, type RunResponse, type Setting } from '../api'
import { CommandPreview } from '../components/CommandPreview'
import { Spinner } from '../components/Spinner'
import { Tooltip } from '../components/Tooltip'
import { useToast } from '../toast'

interface Props { adminName: string }

const EMPTY: OnboardRequest = {
  first_name: '', last_name: '', domain: '', org_unit: '',
  email_group: '', job_title: '', password: '', manager_email: '',
}

export function Onboard({ adminName }: Props) {
  const { toast } = useToast()
  const [form, setForm] = useState<OnboardRequest>(EMPTY)
  const [domains, setDomains] = useState<string[]>([])
  const [orgUnits, setOrgUnits] = useState<string[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [result, setResult] = useState<RunResponse | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    api.admin.settings().then((settings: Setting[]) => {
      const get = (k: string) => settings.find(s => s.key === k)?.value || ''
      setDomains(get('domains').split('|').filter(Boolean))
      setOrgUnits(get('org_units').split('|').filter(Boolean))
      setGroups(get('email_groups').split('|').filter(Boolean))
      setForm(f => ({
        ...f,
        domain: f.domain || get('domains').split('|')[0] || '',
        org_unit: f.org_unit || get('org_units').split('|')[0] || '',
        password: f.password || get('default_password') || '',
      }))
    }).catch(() => {})
  }, [])

  const emailPreview = form.first_name && form.last_name && form.domain
    ? `${form.first_name.toLowerCase().replace(/ /g, '')}.${form.last_name.toLowerCase().replace(/ /g, '')}@${form.domain}`
    : ''

  function set(field: keyof OnboardRequest, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setPreview(null)
    setResult(null)
  }

  async function handlePreview() {
    if (!form.first_name || !form.last_name || !form.domain || !form.org_unit) {
      toast.error('First name, last name, domain, and org unit are required.')
      return
    }
    setPreviewing(true)
    try {
      const res = await api.onboard.preview({ ...form, admin_name: adminName })
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
    setRunning(true)
    try {
      const res = await api.onboard.run({ ...form, admin_name: adminName })
      setResult(res)
      setPreview(null)
      if (res.success) {
        toast.success(`Onboarded ${res.email} — all steps completed.`)
      } else {
        toast.error(`Onboarding completed with errors. Check the results below.`)
      }
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  function handleReset() {
    setForm(EMPTY)
    setPreview(null)
    setResult(null)
  }

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">Onboard Employee</h1>
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
            <label>
              Domain <span className="required">*</span>
              <Tooltip text="The @domain the new employee's email will use.">
                <span className="help-icon">?</span>
              </Tooltip>
            </label>
            <select className="input" value={form.domain} onChange={e => set('domain', e.target.value)}>
              <option value="">— select —</option>
              {domains.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {emailPreview && (
            <div className="email-preview">
              Email will be: <strong>{emailPreview}</strong>
            </div>
          )}

          <div className="form-group">
            <label>
              Org Unit <span className="required">*</span>
              <Tooltip text="The Google Workspace org unit this account belongs to.">
                <span className="help-icon">?</span>
              </Tooltip>
            </label>
            <select className="input" value={form.org_unit} onChange={e => set('org_unit', e.target.value)}>
              <option value="">— select —</option>
              {orgUnits.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Email Group</label>
            <select className="input" value={form.email_group} onChange={e => set('email_group', e.target.value)}>
              <option value="">— none —</option>
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Job Title</label>
            <input className="input" value={form.job_title} onChange={e => set('job_title', e.target.value)} placeholder="Sales Rep" />
          </div>

          <div className="form-group">
            <label>
              Password
              <Tooltip text="Leave blank to use the default password from Settings.">
                <span className="help-icon">?</span>
              </Tooltip>
            </label>
            <input className="input" value={form.password} onChange={e => set('password', e.target.value)} placeholder="(default from settings)" />
          </div>

          <div className="form-group">
            <label>
              Manager Email
              <Tooltip text="Account info will be emailed here after creation.">
                <span className="help-icon">?</span>
              </Tooltip>
            </label>
            <input className="input" value={form.manager_email} onChange={e => set('manager_email', e.target.value)} placeholder="manager@example.com" />
          </div>

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={handleReset} disabled={previewing || running}>
              Reset
            </button>
            <button className="btn btn-primary" onClick={handlePreview} disabled={previewing || running}>
              {previewing ? <Spinner /> : 'Preview Commands'}
            </button>
            {preview && (
              <button className="btn btn-primary" onClick={handleRun} disabled={running} style={{ background: 'var(--green)' }}>
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
              Fill in the form and click <strong>Preview Commands</strong> to see what will run.
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
