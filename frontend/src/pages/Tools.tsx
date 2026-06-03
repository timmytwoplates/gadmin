import { useEffect, useState } from 'react'
import { api, type Setting } from '../api'
import { Spinner } from '../components/Spinner'
import { Tooltip } from '../components/Tooltip'
import { useToast } from '../toast'

interface Props { adminName: string }

interface Member { email: string; role: string; type: string }

// ─── Reset Password ───────────────────────────────────────────────────────────

function ResetPassword({ adminName }: Props) {
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [defaultPw, setDefaultPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; stderr: string } | null>(null)

  useEffect(() => {
    api.admin.settings().then((s: Setting[]) => {
      setDefaultPw(s.find(x => x.key === 'default_password')?.value || '')
    }).catch(() => {})
  }, [])

  async function handleRun() {
    if (!email.trim()) { toast.error('Email is required.'); return }
    if (!confirm(`Reset password for ${email}?`)) return
    setLoading(true)
    setResult(null)
    try {
      const res = await api.tools.resetPassword(email.trim(), password.trim(), adminName)
      setResult(res)
      if (res.success) toast.success(`Password reset for ${email}.`)
      else toast.error('Reset failed — see details below.')
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="tool-panel">
      <div className="form-group">
        <label>User Email <span className="required">*</span></label>
        <input className="input" value={email} onChange={e => { setEmail(e.target.value); setResult(null) }}
          placeholder="employee@example.com" />
      </div>
      <div className="form-group">
        <label>
          New Password
          <Tooltip text="Leave blank to use the default password from Settings.">
            <span className="help-icon">?</span>
          </Tooltip>
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={password} onChange={e => setPassword(e.target.value)}
            placeholder={defaultPw ? `default: ${defaultPw}` : '(default from settings)'} style={{ flex: 1 }} />
          {defaultPw && (
            <button className="btn btn-secondary btn-sm" onClick={() => setPassword(defaultPw)}>
              Use Default
            </button>
          )}
        </div>
      </div>
      <div className="form-actions">
        <button className="btn btn-danger" onClick={handleRun} disabled={loading}>
          {loading ? <Spinner /> : 'Reset Password'}
        </button>
      </div>
      {result && (
        <div className={`tool-result ${result.success ? 'tool-result-ok' : 'tool-result-fail'}`}>
          {result.success ? '✓ Password reset successfully.' : `✗ ${result.stderr || 'GAM returned an error.'}`}
        </div>
      )}
    </div>
  )
}

// ─── Group Members ────────────────────────────────────────────────────────────

function GroupMembers({ adminName }: Props) {
  const { toast } = useToast()
  const [groups, setGroups] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState('')
  const [members, setMembers] = useState<Member[] | null>(null)
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<Record<string, boolean>>({})

  useEffect(() => {
    api.admin.settings().then((s: Setting[]) => {
      const raw = s.find(x => x.key === 'email_groups')?.value || ''
      setGroups(raw.split('|').filter(Boolean))
    }).catch(() => {})
  }, [])

  async function loadMembers(group: string) {
    if (!group) return
    setLoadingMembers(true)
    setMembers(null)
    try {
      const res = await api.tools.listGroupMembers(group)
      setMembers(res.members)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setLoadingMembers(false)
    }
  }

  function handleGroupChange(g: string) {
    setSelectedGroup(g)
    setMembers(null)
    setAddEmail('')
    if (g) loadMembers(g)
  }

  async function handleAdd() {
    if (!addEmail.trim()) { toast.error('Email is required.'); return }
    setAdding(true)
    try {
      const res = await api.tools.updateGroupMember(selectedGroup, addEmail.trim(), 'add', adminName)
      if (res.success) {
        toast.success(`Added ${addEmail} to ${selectedGroup}.`)
        setAddEmail('')
        loadMembers(selectedGroup)
      } else {
        toast.error(res.stderr || 'Failed to add member.')
      }
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(memberEmail: string) {
    if (!confirm(`Remove ${memberEmail} from ${selectedGroup}?`)) return
    setRemoving(r => ({ ...r, [memberEmail]: true }))
    try {
      const res = await api.tools.updateGroupMember(selectedGroup, memberEmail, 'remove', adminName)
      if (res.success) {
        toast.success(`Removed ${memberEmail}.`)
        setMembers(prev => prev ? prev.filter(m => m.email !== memberEmail) : prev)
      } else {
        toast.error(res.stderr || 'Failed to remove member.')
      }
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setRemoving(r => { const n = { ...r }; delete n[memberEmail]; return n })
    }
  }

  return (
    <div className="tool-panel">
      <div className="form-group">
        <label>Group <span className="required">*</span></label>
        <select className="input" value={selectedGroup} onChange={e => handleGroupChange(e.target.value)}>
          <option value="">— select a group —</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {selectedGroup && (
        <>
          <div className="form-group" style={{ marginTop: 16 }}>
            <label>Add Member</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={addEmail} onChange={e => setAddEmail(e.target.value)}
                placeholder="newmember@example.com"
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={adding}>
                {adding ? <Spinner /> : 'Add'}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label className="form-label">Current Members</label>
            {loadingMembers && <div style={{ marginTop: 8 }}><Spinner /></div>}
            {members && members.length === 0 && (
              <div className="muted" style={{ marginTop: 8 }}>No members found.</div>
            )}
            {members && members.length > 0 && (
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th style={{ width: 100 }}>Role</th>
                      <th style={{ width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.email}>
                        <td className="mono">{m.email}</td>
                        <td>
                          <span className={`badge ${m.role === 'OWNER' ? 'badge-working' : 'badge-open'}`}>
                            {m.role}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleRemove(m.email)}
                            disabled={!!removing[m.email]}
                          >
                            {removing[m.email] ? <Spinner /> : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Aliases ──────────────────────────────────────────────────────────────────

function Aliases({ adminName }: Props) {
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [aliases, setAliases] = useState<string[] | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [addAlias, setAddAlias] = useState('')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<Record<string, boolean>>({})

  async function handleLookup() {
    if (!email.trim()) { toast.error('Email is required.'); return }
    setLookingUp(true)
    setAliases(null)
    try {
      const res = await api.tools.listAliases(email.trim())
      setAliases(res.aliases)
      if (res.error) toast.error(res.error)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setLookingUp(false)
    }
  }

  async function handleAdd() {
    if (!addAlias.trim()) { toast.error('Alias is required.'); return }
    setAdding(true)
    try {
      const res = await api.tools.updateAlias(email.trim(), addAlias.trim(), 'add', adminName)
      if (res.success) {
        toast.success(`Added alias ${addAlias}.`)
        setAddAlias('')
        handleLookup()
      } else {
        toast.error(res.stderr || 'Failed to add alias.')
      }
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(alias: string) {
    if (!confirm(`Remove alias ${alias} from ${email}?`)) return
    setRemoving(r => ({ ...r, [alias]: true }))
    try {
      const res = await api.tools.updateAlias(email.trim(), alias, 'remove', adminName)
      if (res.success) {
        toast.success(`Removed alias ${alias}.`)
        setAliases(prev => prev ? prev.filter(a => a !== alias) : prev)
      } else {
        toast.error(res.stderr || 'Failed to remove alias.')
      }
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setRemoving(r => { const n = { ...r }; delete n[alias]; return n })
    }
  }

  return (
    <div className="tool-panel">
      <div className="form-group">
        <label>User Email <span className="required">*</span></label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={email}
            onChange={e => { setEmail(e.target.value); setAliases(null) }}
            placeholder="employee@example.com"
            onKeyDown={e => e.key === 'Enter' && handleLookup()}
            style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={handleLookup} disabled={lookingUp}>
            {lookingUp ? <Spinner /> : 'Look Up'}
          </button>
        </div>
      </div>

      {aliases !== null && (
        <>
          <div className="form-group" style={{ marginTop: 16 }}>
            <label>Add Alias</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={addAlias} onChange={e => setAddAlias(e.target.value)}
                placeholder="alias@example.com"
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={adding}>
                {adding ? <Spinner /> : 'Add'}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label className="form-label">Current Aliases</label>
            {aliases.length === 0 && (
              <div className="muted" style={{ marginTop: 8 }}>No aliases on this account.</div>
            )}
            {aliases.length > 0 && (
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Alias</th>
                      <th style={{ width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {aliases.map(a => (
                      <tr key={a}>
                        <td className="mono">{a}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleRemove(a)}
                            disabled={!!removing[a]}
                          >
                            {removing[a] ? <Spinner /> : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'password' | 'groups' | 'aliases'

export function Tools({ adminName }: Props) {
  const [tab, setTab] = useState<Tab>('password')

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">Tools</h1>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'password' ? 'active' : ''}`} onClick={() => setTab('password')}>
          Reset Password
        </button>
        <button className={`tab ${tab === 'groups' ? 'active' : ''}`} onClick={() => setTab('groups')}>
          Group Members
        </button>
        <button className={`tab ${tab === 'aliases' ? 'active' : ''}`} onClick={() => setTab('aliases')}>
          Aliases
        </button>
      </div>

      <div className="section">
        {tab === 'password' && <ResetPassword adminName={adminName} />}
        {tab === 'groups' && <GroupMembers adminName={adminName} />}
        {tab === 'aliases' && <Aliases adminName={adminName} />}
      </div>
    </main>
  )
}
