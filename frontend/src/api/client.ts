import type { FilePayload, Message, ReadUpdate, User } from '../types'

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token')
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  login(pin: string) {
    return req<{ token: string; user: User }>('/auth/login.php', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    })
  },

  fetchUsers() {
    return req<User[]>('/users/index.php')
  },

  fetchMessages(since = 0, limit = 50) {
    return req<Message[]>(`/messages/index.php?since=${since}&limit=${limit}`)
  },

  sendMessage(body: string) {
    return req<Message>('/messages/index.php', {
      method: 'POST',
      body: JSON.stringify({ body }),
    })
  },

  markRead(message_id: number) {
    return req<ReadUpdate>('/reads/index.php', {
      method: 'POST',
      body: JSON.stringify({ message_id }),
    })
  },

  ping() {
    return req<{ ok: boolean }>('/ping/index.php', { method: 'POST' })
  },

  async uploadFile(file: File): Promise<{ id: number; orig_name: string; mime_type: string; size: number }> {
    const token = localStorage.getItem('token')
    const form  = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE}/uploads/index.php`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `HTTP ${res.status}`)
    }
    return res.json() as Promise<{ id: number; orig_name: string; mime_type: string; size: number }>
  },

  deleteMessage(id: number) {
    return req<{ ok: boolean; id: number }>('/messages/index.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    })
  },

  sendFileMessage(payload: FilePayload) {
    return req<Message>('/messages/index.php', {
      method: 'POST',
      body: JSON.stringify({ type: 'file', body: payload }),
    })
  },

  fileUrl(uploadId: number): string {
    const token = localStorage.getItem('token') ?? ''
    return `${BASE}/files/index.php?id=${uploadId}&token=${encodeURIComponent(token)}`
  },

  /** SSE専用の短命トークンを取得（90秒有効）*/
  async getSseToken(): Promise<string> {
    const { sse_token } = await req<{ sse_token: string }>('/auth/sse_token.php', {
      method: 'POST',
    })
    return sse_token
  },

  sseUrl(sseToken: string, lastId: number): string {
    return `${BASE}/events/index.php?st=${encodeURIComponent(sseToken)}&last_id=${lastId}`
  },

  checkSetup() {
    return req<{ needed: boolean }>('/setup/index.php')
  },

  runSetup(members: Array<{ name: string; role: 'parent' | 'child' | 'admin'; pin: string }>) {
    return req<{ ok: boolean }>('/setup/index.php', {
      method: 'POST',
      body: JSON.stringify({ members }),
    })
  },

  adminListUsers() {
    return req<Array<{ id: number; name: string; role: string; banned: boolean; banned_at: string | null }>>('/admin/users.php')
  },

  adminAddUser(data: { name: string; role: 'parent' | 'child' | 'admin'; pin: string }) {
    return req<{ ok: boolean; id: number }>('/admin/users.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'add', ...data }),
    })
  },

  adminBanUser(userId: number) {
    return req<{ ok: boolean }>('/admin/users.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'ban', user_id: userId }),
    })
  },

  adminUnbanUser(userId: number) {
    return req<{ ok: boolean }>('/admin/users.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'unban', user_id: userId }),
    })
  },

  adminUpdateUser(userId: number, data: { name: string; role: 'parent' | 'child' | 'admin' }) {
    return req<{ ok: boolean }>('/admin/users.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'update', user_id: userId, ...data }),
    })
  },

  adminListLogs() {
    return req<Array<{ id: number; name: string; is_current: boolean; created_at: string }>>('/admin/logs.php')
  },

  adminNewLog() {
    return req<{ ok: boolean; name: string; id: number }>('/admin/logs.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'new' }),
    })
  },

  adminSwitchLog(logId: number) {
    return req<{ ok: boolean }>('/admin/logs.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'switch', log_id: logId }),
    })
  },

  adminGetLineSettings() {
    return req<{ enabled: boolean; channel_access_token: string; to_user_id: string }>('/admin/line_settings.php')
  },

  adminUpdateLineSettings(data: { enabled: boolean; channel_access_token: string; to_user_id: string }) {
    return req<{ ok: boolean }>('/admin/line_settings.php', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  sendCallSignal(to_user_id: number, type: string, payload: unknown) {
    return req<{ ok: boolean }>('/calls/index.php', {
      method: 'POST',
      body: JSON.stringify({ to_user_id, type, payload }),
    })
  },
}
