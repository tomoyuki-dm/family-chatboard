import { useState, useEffect } from 'react'
import { api } from '../api/client'

interface AdminUser {
  id: number
  name: string
  role: string
  banned: boolean
  banned_at: string | null
}

interface LogSession {
  id: number
  name: string
  is_current: boolean
  created_at: string
}

interface Props {
  currentUserId: number
  onClose: () => void
}

const ROLE_LABEL: Record<string, string> = { admin: '管理者', parent: '親', child: '子' }
const ROLE_COLOR: Record<string, string> = {
  admin:  'bg-purple-100 text-purple-700',
  parent: 'bg-blue-100 text-blue-700',
  child:  'bg-orange-100 text-orange-700',
}

export function AdminPanel({ currentUserId, onClose }: Props) {
  const [users, setUsers]             = useState<AdminUser[]>([])
  const [loading, setLoading]         = useState(true)
  const [editingId, setEditingId]     = useState<number | null>(null)
  const [editName, setEditName]       = useState('')
  const [editRole, setEditRole]       = useState<'parent' | 'child' | 'admin'>('child')
  const [editLoading, setEditLoading] = useState(false)
  const [name, setName]               = useState('')
  const [role, setRole]               = useState<'parent' | 'child' | 'admin'>('child')
  const [pin, setPin]                 = useState('')
  const [error, setError]             = useState('')
  const [addLoading, setAddLoading]   = useState(false)
  const [logs, setLogs]               = useState<LogSession[]>([])
  const [logLoading, setLogLoading]   = useState(false)
  const [tab, setTab]                 = useState<'users' | 'logs'>('users')

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    try { setUsers(await api.adminListUsers()) } finally { setLoading(false) }
  }

  async function loadLogs() {
    setLogLoading(true)
    try { setLogs(await api.adminListLogs()) } finally { setLogLoading(false) }
  }

  useEffect(() => { if (tab === 'logs') void loadLogs() }, [tab])

  async function handleNewLog() {
    if (!confirm('現在のチャット履歴をアーカイブして新しいログを開始しますか？\n（全メンバーの画面が次の再接続時に更新されます）')) return
    await api.adminNewLog()
    await loadLogs()
  }

  async function handleSwitchLog(logId: number, logName: string) {
    if (!confirm(`「${logName}」に切り替えますか？\n（全メンバーの画面が次の再接続時に更新されます）`)) return
    await api.adminSwitchLog(logId)
    await loadLogs()
  }

  function startEdit(u: AdminUser) {
    setEditingId(u.id)
    setEditName(u.name)
    setEditRole(u.role as 'parent' | 'child' | 'admin')
  }

  async function handleUpdate() {
    if (!editName.trim() || editingId === null) return
    setEditLoading(true)
    try {
      await api.adminUpdateUser(editingId, { name: editName.trim(), role: editRole })
      setEditingId(null)
      await load()
    } finally {
      setEditLoading(false)
    }
  }

  async function handleBan(userId: number, userName: string) {
    if (!confirm(`${userName} をバンしますか？`)) return
    await api.adminBanUser(userId)
    await load()
  }

  async function handleUnban(userId: number) {
    await api.adminUnbanUser(userId)
    await load()
  }

  async function handleAdd() {
    if (!name.trim()) { setError('名前を入力してください'); return }
    if (!/^\d{4,8}$/.test(pin)) { setError('PINは4〜8桁の数字にしてください'); return }
    setAddLoading(true)
    setError('')
    try {
      await api.adminAddUser({ name: name.trim(), role, pin })
      setName('')
      setPin('')
      await load()
    } catch (err) {
      setError('追加に失敗しました: ' + String(err))
    } finally {
      setAddLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-bold text-gray-800">管理パネル</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          {(['users', 'logs'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === t ? 'text-green-700 border-b-2 border-green-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {t === 'users' ? 'メンバー管理' : 'ログ管理'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {tab === 'logs' ? (
            /* ログ管理タブ */
            <div className="space-y-4">
              <div>
                <button
                  onClick={handleNewLog}
                  className="w-full bg-orange-500 text-white font-bold rounded-xl py-2.5 text-sm hover:bg-orange-600 active:bg-orange-700 transition-colors"
                >
                  新しいログセッションを開始（現在をアーカイブ）
                </button>
                <p className="text-xs text-gray-400 mt-1.5 text-center">
                  現在のチャット履歴を保存し、新しい空のチャットを開始します
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">ログ一覧</h3>
                {logLoading ? (
                  <p className="text-sm text-gray-400">読み込み中...</p>
                ) : (
                  <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
                    {logs.map(l => (
                      <div key={l.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-gray-800">{l.name}</span>
                          {l.is_current && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">表示中</span>
                          )}
                        </div>
                        {!l.is_current && (
                          <button
                            onClick={() => handleSwitchLog(l.id, l.name)}
                            className="text-xs text-blue-600 border border-blue-300 rounded-lg px-2.5 py-1 hover:bg-blue-50 transition-colors flex-shrink-0"
                          >
                            切替
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
          <>
          {/* メンバー一覧 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">メンバー一覧</h3>
            {loading ? (
              <p className="text-sm text-gray-400">読み込み中...</p>
            ) : (
              <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
                {users.map(u => (
                  <div key={u.id} className={`px-4 py-2.5 ${u.banned ? 'bg-gray-50' : ''}`}>
                    {editingId === u.id ? (
                      /* 編集モード */
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                          />
                          <select
                            value={editRole}
                            onChange={e => setEditRole(e.target.value as 'parent' | 'child' | 'admin')}
                            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                          >
                            <option value="child">子</option>
                            <option value="parent">親</option>
                            <option value="admin">管理者</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleUpdate}
                            disabled={editLoading}
                            className="flex-1 text-xs bg-green-600 text-white rounded-lg py-1.5 hover:bg-green-700 disabled:opacity-40 transition-colors"
                          >
                            {editLoading ? '保存中...' : '保存'}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex-1 text-xs border border-gray-300 text-gray-600 rounded-lg py-1.5 hover:bg-gray-50 transition-colors"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* 通常モード */
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`text-sm font-medium truncate ${u.banned ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                            {u.name}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ROLE_COLOR[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                            {ROLE_LABEL[u.role] ?? u.role}
                          </span>
                          {u.banned && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium flex-shrink-0">バン中</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <button
                            onClick={() => startEdit(u)}
                            className="text-xs text-gray-500 border border-gray-300 rounded-lg px-2.5 py-1 hover:bg-gray-50 transition-colors"
                          >
                            編集
                          </button>
                          {u.id !== currentUserId && (
                            u.banned ? (
                              <button
                                onClick={() => handleUnban(u.id)}
                                className="text-xs text-green-600 border border-green-300 rounded-lg px-2.5 py-1 hover:bg-green-50 transition-colors"
                              >
                                復帰
                              </button>
                            ) : (
                              <button
                                onClick={() => handleBan(u.id, u.name)}
                                className="text-xs text-red-500 border border-red-300 rounded-lg px-2.5 py-1 hover:bg-red-50 transition-colors"
                              >
                                バン
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ユーザー追加 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">ユーザーを追加</h3>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="名前"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <div className="flex gap-2">
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as 'parent' | 'child' | 'admin')}
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="child">子</option>
                  <option value="parent">親</option>
                  <option value="admin">管理者</option>
                </select>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="PIN（4〜8桁）"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                onClick={handleAdd}
                disabled={addLoading}
                className="w-full bg-green-600 text-white font-bold rounded-xl py-2.5 text-sm disabled:opacity-40 hover:bg-green-700 active:bg-green-800 transition-colors"
              >
                {addLoading ? '追加中...' : '＋ 追加'}
              </button>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
