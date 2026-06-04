import { useEffect, useState } from 'react'
import { api, type AuditEntry, type GamStatus, type Setting } from '../api'
import { Spinner } from '../components/Spinner'
import { Tooltip } from '../components/Tooltip'
import { useToast } from '../toast'

interface Props { adminName: string }

const GAM_INSTALL_URL = 'https://github.com/taers232c/GAMADV-XTD3/releases/latest'

export function Admin({ adminName }: Props) {
  const { toast } = useToast()
  const [tab, setTab] = useState<'settings' | 'gam' | 'audit'>('gam')
  const [settings, setSettings] = useState<Setting[]>([])
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [gamStatus, setGamStatus] = useState<GamStatus | null>(null)
  const [gamChecking, setGamChecking] = useState(false)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditPage, setAuditPage] = useState(1)
  const [loadingAudit, setLoadingAudit] = useState(false)

  useEffect(() => {
    api.admin.settings().then(setSettings).catch(() => {})
    checkGam()
  }, [])

  useEffect(() => {
    if (tab === 'audit') loadAudit()
  }, [tab, auditPage])

  function checkGam(force = false) {
    setGamChecking(true)
    api.gam.status(force)
      .then(setGamStatus)
      .catch(() => setGamStatus({ installed: false }))
      .finally(() => setGamChecking(false))
  }

  async function loadAudit() {
    setLoadingAudit(true)
    try {
      const r = await api.admin.auditLog(auditPage)
      setAuditLog(r.items)
      setAuditTotal(r.total)
    } catch {
      //
    } finally {
      setLoadingAudit(false)
    }
  }

  async function saveSetting(key: string) {
    const value = editing[key]
    if (value === undefined) return
    setSaving(s => ({ ...s, [key]: true }))
    try {
      await api.admin.updateSetting(key, value, adminName)
      setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s))
      setEditing(e => { const n = { ...e }; delete n[key]; return n })
      toast.success(`Setting '${key}' saved.`)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setSaving(s => ({ ...s, [key]: false }))
    }
  }

  const auditPages = Math.ceil(auditTotal / 100)

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">Admin</h1>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'gam' ? 'active' : ''}`} onClick={() => setTab('gam')}>GAM Setup</button>
        <button className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>Settings</button>
        <button className={`tab ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>Audit Log</button>
      </div>

      {tab === 'gam' && (
        <div className="section">
          <h2 className="section-title">GAM Status</h2>
          <div className="gam-status-row">
            <button className="btn btn-secondary" onClick={() => checkGam(true)} disabled={gamChecking}>
              {gamChecking ? <Spinner /> : 'Refresh'}
            </button>
            {gamStatus && (
              <span className={`badge ${gamStatus.installed ? (gamStatus.authenticated ? 'badge-open' : 'badge-claimed') : 'badge-lost'}`}>
                {gamStatus.installed
                  ? (gamStatus.authenticated ? 'Installed & Authenticated' : 'Installed — Not Authenticated')
                  : 'Not Installed'}
              </span>
            )}
          </div>
          {gamStatus?.version && (
            <pre className="gam-version">{gamStatus.version}</pre>
          )}
          {gamStatus?.message && (
            <div className="alert alert-warn">{gamStatus.message}</div>
          )}

          {!gamStatus?.installed && (
            <div className="gam-setup-steps">
              <h3>Step 1 — Install GAMADV-XTD3</h3>
              <p>Download the Windows installer from GitHub and extract to <code>C:\GAM7</code>.</p>
              <a className="btn btn-primary" href={GAM_INSTALL_URL} target="_blank" rel="noreferrer">
                Download GAMADV-XTD3 →
              </a>
            </div>
          )}

          {gamStatus?.installed && !gamStatus.authenticated && (
            <div className="gam-setup-steps">
              <h3>Step 2 — Authenticate with Google Workspace</h3>
              <p>Open a terminal and run the following command. It will open your browser for Google OAuth.</p>
              <code className="cmd-text">C:\GAM7\gam.exe oauth create</code>
              <p className="muted" style={{ marginTop: 8 }}>
                After authenticating, click <strong>Refresh</strong> above to confirm.
              </p>
            </div>
          )}

          {gamStatus?.installed && gamStatus.authenticated && (
            <div className="alert alert-ok">GAM is installed and authenticated. You're ready to use Onboard and Offboard.</div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="section">
          <h2 className="section-title">App Settings</h2>
          <p className="muted">Changes take effect immediately — no restart needed.</p>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 220 }}>Setting</th>
                  <th>Value</th>
                  <th style={{ width: 220 }}>Description</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {settings.map(s => {
                  const isEditing = s.key in editing
                  const currentVal = isEditing ? editing[s.key] : s.value
                  return (
                    <tr key={s.key}>
                      <td className="mono">{s.key}</td>
                      <td>
                        {s.key === 'email_signature_template' ? (
                          <textarea
                            className="input"
                            rows={4}
                            value={currentVal}
                            onChange={e => setEditing(ed => ({ ...ed, [s.key]: e.target.value }))}
                            style={{ fontFamily: 'monospace', fontSize: 12 }}
                          />
                        ) : (
                          <input
                            className="input"
                            value={currentVal}
                            onChange={e => setEditing(ed => ({ ...ed, [s.key]: e.target.value }))}
                          />
                        )}
                      </td>
                      <td className="muted" style={{ fontSize: 12 }}>{s.description}</td>
                      <td>
                        {isEditing && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => saveSetting(s.key)}
                            disabled={saving[s.key]}
                          >
                            {saving[s.key] ? <Spinner /> : 'Save'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="section">
          <h2 className="section-title">Audit Log</h2>
          {loadingAudit ? <Spinner /> : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Who</th>
                      <th>Action</th>
                      <th>Table</th>
                      <th>Record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.length === 0 && (
                      <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 32 }}>No audit entries yet.</td></tr>
                    )}
                    {auditLog.map(e => (
                      <tr key={e.id}>
                        <td className="mono">{e.created_at?.slice(0, 16)}</td>
                        <td>{e.user_name || '—'}</td>
                        <td><span className={`badge badge-${e.action === 'create' ? 'open' : e.action === 'update' ? 'working' : 'lost'}`}>{e.action}</span></td>
                        <td className="mono">{e.table_name}</td>
                        <td className="mono">{e.record_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {auditPages > 1 && (
                <div className="pagination">
                  <button className="btn btn-sm btn-secondary" disabled={auditPage === 1} onClick={() => setAuditPage(p => p - 1)}>← Prev</button>
                  <span className="count-badge">Page {auditPage} of {auditPages}</span>
                  <button className="btn btn-sm btn-secondary" disabled={auditPage >= auditPages} onClick={() => setAuditPage(p => p + 1)}>Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </main>
  )
}
