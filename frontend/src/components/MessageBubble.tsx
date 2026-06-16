import { api } from '../api/client'
import type { FilePayload, Message } from '../types'

interface Props {
  message:      Message
  isMine:       boolean
  canDelete:    boolean
  totalMembers: number
  avatarColor:  string
  onDelete?:    (id: number) => void
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('ja-JP', {
    hour:   '2-digit',
    minute: '2-digit',
  })
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function FileAttachment({ payload, isMine }: { payload: FilePayload; isMine: boolean }) {
  const url       = api.fileUrl(payload.id)
  const linkClass = isMine ? 'text-white underline' : 'text-green-700 underline'

  if (payload.mime.startsWith('image/')) {
    return (
      <img
        src={url}
        alt={payload.name}
        className="max-w-full rounded-lg max-h-64 object-contain cursor-pointer"
        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      />
    )
  }
  if (payload.mime.startsWith('video/')) {
    return <video src={url} controls className="max-w-full rounded-lg max-h-64" preload="metadata" />
  }
  if (payload.mime.startsWith('audio/')) {
    return <audio src={url} controls className="w-full min-w-[200px]" preload="metadata" />
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={payload.name}
      className={`flex items-center gap-2 text-sm break-all ${linkClass}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 flex-shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
      </svg>
      <span>{payload.name}</span>
      <span className="opacity-60 flex-shrink-0">({formatSize(payload.size)})</span>
    </a>
  )
}

export function MessageBubble({ message, isMine, canDelete, totalMembers, avatarColor, onDelete }: Props) {
  const othersCount = totalMembers - 1
  const readCount   = message.read_count
  const showRead    = isMine && readCount > 0
  const readLabel   =
    othersCount > 1 && readCount < othersCount ? `既読 ${readCount}` : '既読'

  let filePayload: FilePayload | null = null
  if (message.type === 'file' && !message.deleted) {
    try { filePayload = JSON.parse(message.body) as FilePayload } catch { /* ignore */ }
  }

  return (
    <div className={`flex ${isMine ? 'flex-row-reverse' : 'flex-row'} items-end gap-1.5 mb-0.5`}>
      {!isMine && (
        <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-4`}>
          {message.user_name[0]}
        </div>
      )}

      <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[75%]`}>
        {!isMine && (
          <span className="text-xs text-gray-500 mb-0.5 ml-1">{message.user_name}</span>
        )}

        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
            message.deleted
              ? 'bg-gray-100 text-gray-400 italic'
              : isMine
                ? 'bg-green-500 text-white rounded-br-none'
                : 'bg-white text-gray-800 rounded-bl-none shadow-sm'
          } ${filePayload ? 'overflow-hidden p-1' : 'whitespace-pre-wrap break-words'}`}
        >
          {message.deleted ? (
            'このメッセージは削除されました'
          ) : filePayload ? (
            <FileAttachment payload={filePayload} isMine={isMine} />
          ) : (
            message.body
          )}
        </div>

        <div className={`flex items-center gap-1.5 mt-0.5 ${isMine ? 'flex-row-reverse' : ''}`}>
          <span className="text-[11px] text-gray-400">{formatTime(message.created_at)}</span>
          {showRead && (
            <span className="text-[11px] text-green-600 font-medium">{readLabel}</span>
          )}
          {canDelete && !message.deleted && onDelete && (
            <button
              onClick={() => onDelete(message.id)}
              className="text-gray-300 hover:text-red-400 active:text-red-500 transition-colors"
              aria-label="削除"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {isMine && <div className="w-8 flex-shrink-0" />}
    </div>
  )
}
