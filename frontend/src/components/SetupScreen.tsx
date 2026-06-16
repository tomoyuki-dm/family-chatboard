import { useState } from 'react'
import { api } from '../api/client'

interface Member {
  name: string
  role: 'parent' | 'child' | 'admin'
  pin: string
}

interface Props {
  onComplete: () => void
}

export function SetupScreen({ onComplete }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [name, setName]       = useState('')
  const [role, setRole]       = useState<'parent' | 'child' | 'admin'>('parent')
  const [pin, setPin]         = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  function addMember() {
    if (!name.trim()) { setError('名前を入力してください'); return }
    if (!/^\d{4,8}$/.test(pin)) { setError('PINは4〜8桁の数字にしてください'); return }
    setMembers(prev => [...prev, { name: name.trim(), role, pin }])
    setName('')
    setPin('')
    setError('')
  }

  function removeMember(index: number) {
    setMembers(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (members.length === 0) { setError('メンバーを1人以上追加してください'); return }
    setLoading(true)
    try {
      await api.runSetup(members)
      onComplete()
    } catch (err) {
      setError('セットアップに失敗しました: ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md">
        <h1 className="text-xl font-bold text-green-700 text-center mb-1">家族チャット</h1>
        <p className="text-sm text-gray-500 text-center mb-6">初期セットアップ — メンバーを登録してください</p>

        <div className="space-y-2 mb-3">
          <input
            type="text"
            placeholder="名前"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMember()}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <div className="flex gap-2">
            <select
              value={role}
              onChange={e => setRole(e.target.value as 'parent' | 'child' | 'admin')}
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="parent">親</option>
              <option value="child">子</option>
              <option value="admin">管理者</option>
            </select>
            <input
              type="text"
              inputMode="numeric"
              placeholder="PIN（4〜8桁）"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              onKeyDown={e => e.key === 'Enter' && addMember()}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button
            onClick={addMember}
            className="w-full bg-green-100 text-green-700 font-medium rounded-xl py-2.5 text-sm hover:bg-green-200 active:bg-green-300 transition-colors"
          >
            ＋ メンバーを追加
          </button>
        </div>

        {members.length > 0 && (
          <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 mb-4">
            {members.map((m, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{m.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    m.role === 'admin'
                      ? 'bg-purple-100 text-purple-700'
                      : m.role === 'parent'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {m.role === 'admin' ? '管理者' : m.role === 'parent' ? '親' : '子'}
                  </span>
                  <span className="text-xs text-gray-400">{'●'.repeat(m.pin.length)}</span>
                </div>
                <button
                  onClick={() => removeMember(i)}
                  className="text-gray-300 hover:text-red-400 transition-colors text-base leading-none"
                  aria-label="削除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={members.length === 0 || loading}
          className="w-full bg-green-600 text-white font-bold rounded-xl py-3 text-sm disabled:opacity-40 hover:bg-green-700 active:bg-green-800 transition-colors"
        >
          {loading ? 'セットアップ中...' : 'セットアップ完了'}
        </button>
      </div>
    </div>
  )
}
