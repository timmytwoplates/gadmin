async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err: Error & { traceId?: string } = new Error(
      body.error || body.detail || `HTTP ${res.status}`
    )
    err.traceId = body.trace_id
    throw err
  }
  return res.json()
}

// --- GAM ---
export const api = {
  gam: {
    status: (refresh = false) => request<GamStatus>(`/api/gam/status${refresh ? '?refresh=true' : ''}`),
  },

  onboard: {
    preview: (body: OnboardRequest) =>
      request<PreviewResponse>('/api/onboard/preview', { method: 'POST', body: JSON.stringify(body) }),
    run: (body: OnboardRequest) =>
      request<RunResponse>('/api/onboard/run', { method: 'POST', body: JSON.stringify(body) }),
  },

  offboard: {
    preview: (body: OffboardRequest) =>
      request<PreviewResponse>('/api/offboard/preview', { method: 'POST', body: JSON.stringify(body) }),
    run: (body: OffboardRequest) =>
      request<RunResponse>('/api/offboard/run', { method: 'POST', body: JSON.stringify(body) }),
  },

  employees: {
    list: (page = 1, pageSize = 50) =>
      request<PagedResponse<Employee>>(`/api/employees/?page=${page}&page_size=${pageSize}`),
    get: (id: number) => request<EmployeeDetail>(`/api/employees/${id}`),
  },

  archive: {
    start: (targetEmail: string, destination: string, localPath: string, adminName: string) =>
      request<{ job_id: number }>('/api/archive/start', {
        method: 'POST',
        body: JSON.stringify({ target_email: targetEmail, destination, local_path: localPath, admin_name: adminName }),
      }),
    status: (jobId: number) => request<ArchiveJob>(`/api/archive/${jobId}/status`),
    list: (page = 1) => request<PagedResponse<ArchiveJob>>(`/api/archive/?page=${page}`),
  },

  tools: {
    resetPassword: (email: string, password: string, adminName: string) =>
      request<ToolResult>('/api/tools/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, password, admin_name: adminName }),
      }),
    listGroupMembers: (groupEmail: string) =>
      request<{ members: GroupMember[]; error?: string }>(
        `/api/tools/groups/${encodeURIComponent(groupEmail)}/members`
      ),
    updateGroupMember: (groupEmail: string, memberEmail: string, action: string, adminName: string) =>
      request<ToolResult>('/api/tools/groups/members', {
        method: 'POST',
        body: JSON.stringify({ group_email: groupEmail, member_email: memberEmail, action, admin_name: adminName }),
      }),
    listAliases: (email: string) =>
      request<{ aliases: string[]; error?: string }>(
        `/api/tools/users/${encodeURIComponent(email)}/aliases`
      ),
    updateAlias: (userEmail: string, alias: string, action: string, adminName: string) =>
      request<ToolResult>('/api/tools/aliases', {
        method: 'POST',
        body: JSON.stringify({ user_email: userEmail, alias, action, admin_name: adminName }),
      }),
  },

  admin: {
    settings: () => request<Setting[]>('/api/admin/settings'),
    updateSetting: (key: string, value: string, adminName: string) =>
      request<Setting>(`/api/admin/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value, admin_name: adminName }),
      }),
    auditLog: (page = 1, tableFilter = '') =>
      request<PagedResponse<AuditEntry>>(
        `/api/admin/audit-log?page=${page}&table_name=${tableFilter}`
      ),
  },
}

// --- Types ---
export interface GamStatus {
  installed: boolean
  authenticated?: boolean
  version?: string
  message?: string
}

export interface OnboardRequest {
  first_name: string
  last_name: string
  domain: string
  org_unit: string
  email_group?: string
  job_title?: string
  password?: string
  manager_email?: string
  admin_name?: string
}

export interface OffboardRequest {
  first_name: string
  last_name: string
  email: string
  forward_to?: string
  new_password?: string
  drive_transfer_to?: string
  admin_name?: string
}

export interface PreviewStep { name: string; command: string }
export interface PreviewResponse { email: string; steps: PreviewStep[] }

export interface StepResult {
  name: string
  command: string
  success: boolean
  stdout: string
  stderr: string
  exit_code: number
}
export interface RunResponse {
  employee_id: number
  email: string
  success: boolean
  steps: StepResult[]
}

export interface Employee {
  id: number
  first_name: string
  last_name: string
  email: string
  direction: 'onboard' | 'offboard'
  job_title: string | null
  org_unit: string | null
  email_group: string | null
  manager_email: string | null
  processed_by: string | null
  processed_at: string
  notes: string | null
}

export interface GamRun {
  id: number
  employee_id: number
  step_name: string
  command_text: string
  stdout: string | null
  stderr: string | null
  exit_code: number | null
  success: number
  ran_by: string | null
  ran_at: string
}

export interface EmployeeDetail { employee: Employee; runs: GamRun[] }

export interface Setting {
  key: string
  value: string
  description: string | null
  updated_by: string | null
  updated_at: string | null
}

export interface AuditEntry {
  id: number
  user_name: string | null
  action: string
  table_name: string
  record_id: string | null
  old_value: string | null
  new_value: string | null
  created_at: string
}

export interface ArchiveJob {
  id: number
  target_email: string
  destination: string
  local_path: string
  status: 'pending' | 'running' | 'complete' | 'error'
  step: string
  total_messages: number
  archived_messages: number
  folder_url: string
  error: string
  started_by: string | null
  started_at: string
  completed_at: string | null
  pct?: number
}

export interface ToolResult {
  success: boolean
  stdout: string
  stderr: string
}

export interface GroupMember {
  email: string
  role: string
  type: string
}

export interface PagedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}
