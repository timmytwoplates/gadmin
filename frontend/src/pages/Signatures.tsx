import { useEffect, useRef, useState } from 'react'
import { api, type Setting, type WorkspaceUser } from '../api'
import { Spinner } from '../components/Spinner'
import { useToast } from '../toast'

interface Props { adminName: string }

type PushStatus = 'pending' | 'ok' | string   // string = error message

export function Signatures({ adminName }: Props) {
  const { toast } = useToast()

  const [users, setUsers]               = useState<WorkspaceUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [search, setSearch]             = useState('')
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [previewEmail, setPreviewEmail] = useState('')
  const [previewHtml, setPreviewHtml]   = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [template, setTemplate]         = useState('')
  const [savingTmpl, setSavingTmpl]     = useState(false)
  const [pushing, setPushing]           = useState(false)
  const [results, setResults]           = useState<Record<string, PushStatus>>({})

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load users + current template on mount
  useEffect(() => {
    fetchUsers()
    api.admin.settings()
      .then((s: Setting[]) => setTemplate(s.find(x => x.key === 'email_signature_template')?.value || ''))
      .catch(() => {})
  }, [])

  // Re-preview whenever template text or selected employee changes (debounced 400ms)
  useEffect(() => {
    if (!previewEmail) return
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => fetchPreview(previewEmail), 400)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [template, previewEmail])

  async function fetchUsers(refresh = false) {
    setLoadingUsers(true)
    try {
      const r = await api.signatures.users(refresh)
      setUsers(r.users)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setLoadingUsers(false)
    }
  }

  async function fetchPreview(email: string) {
    setPreviewLoading(true)
    try {
      const r = await api.signatures.preview(email, template)
      setPreviewHtml(r.html)
    } catch {
      setPreviewHtml("<p style='color:#dc2626;font-family:sans-serif'>Preview failed.</p>")
    } finally {
      setPreviewLoading(false)
    }
  }

  function handleRowClick(email: string) {
    setPreviewEmail(email)
    fetchPreview(email)
  }

  function toggleOne(email: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSelected(prev => { const n = new Set(prev); n.has(email) ? n.delete(email) : n.add(email); return n })
  }

  const filtered = users.filter(u =>
    !search ||
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.job_title.toLowerCase().includes(search.toLowerCase())
  )

  const allChecked = filtered.length > 0 && filtered.every(u => selected.has(u.email))

  function toggleAll() {
    setSelected(prev => {
      const n = new Set(prev)
      if (allChecked) filtered.forEach(u => n.delete(u.email))
      else            filtered.forEach(u => n.add(u.email))
      return n
    })
  }

  async function handleSaveTemplate() {
    setSavingTmpl(true)
    try {
      await api.admin.updateSetting('email_signature_template', template, adminName)
      toast.success('Signature template saved.')
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setSavingTmpl(false)
    }
  }

  async function handlePush() {
    if (selected.size === 0) { toast.error('Select at least one employee.'); return }
    setPushing(true)
    const emails = Array.from(selected)
    setResults(Object.fromEntries(emails.map(e => [e, 'pending' as PushStatus])))

    const counts = { ok: 0, fail: 0 }
    for (let i = 0; i < emails.length; i += 3) {
      const batch = emails.slice(i, i + 3)
      const outcomes = await Promise.all(batch.map(async email => {
        try {
          const r = await api.signatures.push(email, template, adminName)
          return { email, status: r.success ? 'ok' : (r.stderr || 'GAM error') }
        } catch (e: unknown) {
          return { email, status: (e as Error).message }
        }
      }))
      // Count synchronously before setState queues the update
      outcomes.forEach(({ status }) => {
        status === 'ok' ? counts.ok++ : counts.fail++
      })
      setResults(prev => {
        const n = { ...prev }
        outcomes.forEach(({ email, status }) => { n[email] = status })
        return n
      })
    }

    setPushing(false)
    if (counts.fail === 0)
      toast.success(`Signature set for ${counts.ok} employee${counts.ok !== 1 ? 's' : ''}.`)
    else
      toast.error(`${counts.ok} succeeded, ${counts.fail} failed — check results.`)
  }

  const previewUser = users.find(u => u.email === previewEmail)

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">Signatures</h1>
      </div>

      {/* ── Template editor ──────────────────────────────────────────────── */}
      <div className="sig-tmpl-card">
        <div className="sig-tmpl-header">
          <span className="form-label" style={{ margin: 0 }}>Signature Template</span>
          <span className="sig-vars">
            {['{full_name}','{first_name}','{last_name}','{email}','{job_title}',
              '{company_name}','{company_address}','{company_city_state_zip}',
              '{company_phone}','{company_fax}'].map(v => (
              <code key={v} className="sig-var">{v}</code>
            ))}
          </span>
        </div>
        <textarea
          className="input sig-tmpl-textarea"
          value={template}
          onChange={e => setTemplate(e.target.value)}
          spellCheck={false}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleSaveTemplate} disabled={savingTmpl}>
            {savingTmpl ? <Spinner /> : 'Save Template'}
          </button>
        </div>
      </div>

      {/* ── User list + preview ───────────────────────────────────────────── */}
      <div className="sig-body">

        {/* User list */}
        <div className="sig-user-panel">
          <div className="sig-user-toolbar">
            <input className="input" style={{ flex: 1, minWidth: 0 }}
              placeholder="Search by name, email, or title…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn btn-secondary btn-sm"
              onClick={() => fetchUsers(true)} disabled={loadingUsers}>
              {loadingUsers ? <Spinner /> : 'Refresh'}
            </button>
          </div>

          {filtered.length > 0 && (
            <label className="checkbox-label sig-select-all" onClick={toggleAll}>
              <input type="checkbox" checked={allChecked} onChange={() => {}} />
              <span className="muted" style={{ fontSize: 12 }}>
                {allChecked ? 'Deselect all' : `Select all ${filtered.length}`}
              </span>
            </label>
          )}

          <div className="sig-list">
            {loadingUsers && <div style={{ padding: 20, textAlign: 'center' }}><Spinner /></div>}
            {!loadingUsers && filtered.length === 0 && (
              <div className="muted" style={{ padding: '20px 16px', fontSize: 13, textAlign: 'center' }}>
                {users.length === 0 ? 'No users loaded — click Refresh.' : 'No matches.'}
              </div>
            )}
            {filtered.map(u => {
              const res = results[u.email]
              const isActive = previewEmail === u.email
              const isChecked = selected.has(u.email)
              return (
                <div key={u.email}
                  className={`sig-row${isActive ? ' sig-row--active' : ''}`}
                  onClick={() => handleRowClick(u.email)}
                  title="Click to preview"
                >
                  <input type="checkbox" checked={isChecked}
                    onClick={e => toggleOne(u.email, e)} onChange={() => {}} />
                  <div className="sig-row-info">
                    <span className="sig-row-name">{u.full_name || u.email}</span>
                    <span className="sig-row-meta">
                      {u.email}{u.job_title ? <> · <em>{u.job_title}</em></> : null}
                    </span>
                  </div>
                  {res === 'pending' && <span className="sig-status sig-status--pending">…</span>}
                  {res === 'ok'      && <span className="sig-status sig-status--ok">✓</span>}
                  {res && res !== 'pending' && res !== 'ok' &&
                    <span className="sig-status sig-status--fail" title={res}>✗</span>}
                </div>
              )
            })}
          </div>

          <div className="sig-push-bar">
            <span className="count-badge">{selected.size} selected</span>
            <button className="btn btn-primary" onClick={handlePush}
              disabled={pushing || selected.size === 0}>
              {pushing ? <Spinner /> : `Push Signature`}
            </button>
          </div>
        </div>

        {/* Preview panel */}
        <div className="sig-preview-panel">
          <div className="sig-preview-header">
            <span className="form-label" style={{ margin: 0 }}>
              {previewUser
                ? `Preview — ${previewUser.full_name || previewUser.email}`
                : 'Preview'}
            </span>
            {previewLoading && <Spinner />}
          </div>
          {previewHtml
            ? <iframe className="sig-preview-frame" srcDoc={previewHtml}
                sandbox="" title="Signature preview" />
            : <div className="sig-preview-empty">
                Click an employee name to preview their signature here.
              </div>
          }
        </div>
      </div>
    </main>
  )
}
