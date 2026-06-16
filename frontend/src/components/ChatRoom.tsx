import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../api/client'
import { useSSE } from '../hooks/useSSE'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { MemberList } from './MemberList'
import { AdminPanel } from './AdminPanel'
import type { Message, PresenceMap, ReadUpdate, User } from '../types'

interface Props {
  currentUser: User
  onLogout: () => void
}

export function ChatRoom({ currentUser, onLogout }: Props) {
  const [messages, setMessages]   = useState<Message[]>([])
  const [members, setMembers]     = useState<User[]>([currentUser])
  const [presence, setPresence]   = useState<PresenceMap>({})
  const [loading, setLoading]     = useState(true)
  const [showAdmin, setShowAdmin] = useState(false)

  const AVATAR_COLORS = ['bg-green-600', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500']

  const lastIdRef      = useRef(0)
  const bottomRef      = useRef<HTMLDivElement>(null)
  const pendingReads   = useRef<Set<number>>(new Set())

  // 新着メッセージで末尾にスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // 初期データ取得
  useEffect(() => {
    void (async () => {
      try {
        const [users, msgs] = await Promise.all([
          api.fetchUsers(),
          api.fetchMessages(0),
        ])
        setMembers(users)
        setMessages(msgs)
        if (msgs.length > 0) {
          lastIdRef.current = msgs[msgs.length - 1].id
        }
        // 未読メッセージを既読に
        for (const m of msgs) {
          if (m.user_id !== currentUser.id && !m.read_by.includes(currentUser.id)) {
            void markRead(m.id)
          }
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [currentUser.id])

  // ハートビート（オンライン状態の維持）
  useEffect(() => {
    void api.ping()
    const id = setInterval(() => { void api.ping() }, 30_000)
    return () => clearInterval(id)
  }, [])

  async function markRead(messageId: number) {
    if (pendingReads.current.has(messageId)) return
    pendingReads.current.add(messageId)
    try {
      const update = await api.markRead(messageId)
      applyReadUpdate(update)
    } catch {
      pendingReads.current.delete(messageId)
    }
  }

  function applyReadUpdate(update: ReadUpdate) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === update.message_id
          ? { ...m, read_count: update.read_count, read_by: update.read_by }
          : m,
      ),
    )
  }

  const handleMessage = useCallback(
    (msg: Message) => {
      lastIdRef.current = Math.max(lastIdRef.current, msg.id)
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      if (msg.user_id !== currentUser.id && !msg.read_by.includes(currentUser.id)) {
        void markRead(msg.id)
      }
    },
    [currentUser.id],
  )

  const handlePresence = useCallback((p: PresenceMap) => {
    setPresence(p)
  }, [])

  const handleRead = useCallback((update: ReadUpdate) => {
    applyReadUpdate(update)
  }, [])

  const handleDeleted = useCallback((messageId: number) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, deleted: true, body: '' } : m
    ))
  }, [])

  const getLastId = useCallback(() => lastIdRef.current, [])

  async function handleDelete(messageId: number) {
    if (!confirm('このメッセージを削除しますか？')) return
    try {
      await api.deleteMessage(messageId)
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, deleted: true, body: '' } : m
      ))
    } catch (err) {
      alert('削除に失敗しました: ' + String(err))
    }
  }

  useSSE({ onMessage: handleMessage, onPresence: handlePresence, onRead: handleRead, onDeleted: handleDeleted, getLastId })

  async function handleSend(text: string) {
    const msg = await api.sendMessage(text)
    lastIdRef.current = Math.max(lastIdRef.current, msg.id)
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev
      return [...prev, msg]
    })
  }

  async function handleSendFile(file: File) {
    try {
      const upload = await api.uploadFile(file)
      const msg    = await api.sendFileMessage({
        id:   upload.id,
        mime: upload.mime_type,
        name: upload.orig_name,
        size: upload.size,
      })
      lastIdRef.current = Math.max(lastIdRef.current, msg.id)
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    } catch (err) {
      console.error('ファイル送信エラー:', err)
      alert('ファイルの送信に失敗しました。\n' + String(err))
      throw err
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* ヘッダー */}
      <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between shadow flex-shrink-0">
        <h1 className="font-bold text-lg tracking-wide">家族チャット</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm opacity-90">{currentUser.name}</span>
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setShowAdmin(true)}
              className="text-xs border border-white/50 px-2.5 py-1 rounded-lg opacity-80 active:opacity-100"
            >
              管理
            </button>
          )}
          <button
            onClick={onLogout}
            className="text-xs border border-white/50 px-2.5 py-1 rounded-lg opacity-80 active:opacity-100"
          >
            ログアウト
          </button>
        </div>
      </div>

      {/* メンバー在席バー */}
      <MemberList
        members={members}
        presence={presence}
        currentUserId={currentUser.id}
      />

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {loading && (
          <p className="text-center text-gray-400 text-sm py-8">読み込み中...</p>
        )}

        {!loading && messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">
            まだメッセージはありません。<br />最初のメッセージを送ってみましょう！
          </p>
        )}

        {messages.map((msg) => {
          const memberIndex = members.findIndex(m => m.id === msg.user_id)
          const avatarColor = memberIndex >= 0
            ? AVATAR_COLORS[memberIndex % AVATAR_COLORS.length]
            : 'bg-gray-400'
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isMine={msg.user_id === currentUser.id}
              canDelete={msg.user_id === currentUser.id || currentUser.role === 'parent' || currentUser.role === 'admin'}
              totalMembers={members.length}
              avatarColor={avatarColor}
              onDelete={handleDelete}
            />
          )
        })}

        <div ref={bottomRef} className="h-1" />
      </div>

      {/* 入力エリア */}
      <MessageInput onSend={handleSend} onSendFile={handleSendFile} disabled={loading} />

      {showAdmin && (
        <AdminPanel currentUserId={currentUser.id} onClose={() => setShowAdmin(false)} />
      )}
    </div>
  )
}
