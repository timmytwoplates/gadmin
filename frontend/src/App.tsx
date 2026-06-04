import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './toast'
import { api, type GamStatus } from './api'
import { Onboard } from './pages/Onboard'
import { Offboard } from './pages/Offboard'
import { History } from './pages/History'
import { Admin } from './pages/Admin'
import { Tools } from './pages/Tools'
import { Archive } from './pages/Archive'
import { Signatures } from './pages/Signatures'
import { Help } from './pages/Help'

function GamBanner({ status }: { status: GamStatus | null }) {
  if (!status) return null
  if (status.installed && status.authenticated) return null
  const msg = !status.installed
    ? 'GAM is not installed. Go to Admin > GAM Setup to get started.'
    : 'GAM is installed but not authenticated. Go to Admin > GAM Setup.'
  return <div className="gam-banner">{msg}</div>
}

export default function App() {
  const [adminName, setAdminName] = useState(() => localStorage.getItem('adminName') || '')
  const [gamStatus, setGamStatus] = useState<GamStatus | null>(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!adminName) {
      const name = prompt('Enter your name (used in the audit log):') || 'admin'
      setAdminName(name)
      localStorage.setItem('adminName', name)
    }
  }, [adminName])

  useEffect(() => {
    api.gam.status().then(setGamStatus).catch(() => {})
    const interval = setInterval(() => {
      api.gam.status().then(setGamStatus).catch(() => {})
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('theme', next)
  }

  return (
    <ToastProvider>
      <nav className="nav">
        <span className="nav-brand">GADmin</span>
        <NavLink className="nav-link" to="/onboard">Onboard</NavLink>
        <NavLink className="nav-link" to="/offboard">Offboard</NavLink>
        <NavLink className="nav-link" to="/history">History</NavLink>
        <NavLink className="nav-link" to="/tools">Tools</NavLink>
        <NavLink className="nav-link" to="/archive">Archive</NavLink>
        <NavLink className="nav-link" to="/signatures">Signatures</NavLink>
        <NavLink className="nav-link" to="/admin">Admin</NavLink>
        <NavLink className="nav-link" to="/help">Help</NavLink>
        <span className="nav-spacer" />
        <button className="nav-dark-btn" onClick={toggleTheme} title="Toggle dark mode">
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <span className="nav-user" title="Click to change name" onClick={() => {
          const name = prompt('Your name:', adminName) || adminName
          setAdminName(name)
          localStorage.setItem('adminName', name)
        }}>
          {adminName}
        </span>
      </nav>

      {import.meta.env.DEV && (
        <div className="dev-banner">Dev / Sandbox — Not Production</div>
      )}

      <GamBanner status={gamStatus} />

      <Routes>
        <Route path="/" element={<Navigate to="/onboard" replace />} />
        <Route path="/onboard" element={<Onboard adminName={adminName} />} />
        <Route path="/offboard" element={<Offboard adminName={adminName} />} />
        <Route path="/history" element={<History />} />
        <Route path="/tools" element={<Tools adminName={adminName} />} />
        <Route path="/archive" element={<Archive adminName={adminName} />} />
        <Route path="/signatures" element={<Signatures adminName={adminName} />} />
        <Route path="/admin" element={<Admin adminName={adminName} />} />
        <Route path="/help" element={<Help />} />
      </Routes>
    </ToastProvider>
  )
}
