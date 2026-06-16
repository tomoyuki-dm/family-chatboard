import { useState, useRef, type KeyboardEvent, type ChangeEvent } from 'react'

interface Props {
  onSend:     (text: string) => Promise<void>
  onSendFile: (file: File)   => Promise<void>
  disabled?:  boolean
}

interface PendingFile {
  file:       File
  previewUrl: string | null
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function MessageInput({ onSend, onSendFile, disabled }: Props) {
  const [text,        setText]        = useState('')
  const [sending,     setSending]     = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || sending || uploading || disabled) return
    setSending(true)
    try {
      await onSend(trimmed)
      setText('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    setPendingFile({ file, previewUrl })
  }

  async function handleFileConfirm() {
    if (!pendingFile || uploading) return
    setUploading(true)
    try {
      await onSendFile(pendingFile.file)
      if (pendingFile.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl)
      setPendingFile(null)
    } finally {
      setUploading(false)
    }
  }

  function handleFileCancel() {
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl)
    setPendingFile(null)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void handleSend()
    }
  }

  function handleInput() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  const busy    = sending || uploading || !!disabled
  const canSend = text.trim().length > 0 && !busy

  return (
    <div className="bg-white border-t border-gray-200">
      {/* ファイルプレビュー確認エリア */}
      {pendingFile && (
        <div className="flex items-center gap-3 px-3 py-2 bg-blue-50 border-b border-blue-100">
          {pendingFile.previewUrl ? (
            <img
              src={pendingFile.previewUrl}
              className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
              alt="preview"
            />
          ) : (
            <div className="w-14 h-14 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-gray-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{pendingFile.file.name}</p>
            <p className="text-xs text-gray-500">{formatSize(pendingFile.file.size)}</p>
          </div>
          {/* 送信ボタン */}
          <button
            onClick={() => { void handleFileConfirm() }}
            disabled={uploading}
            className="flex-shrink-0 w-9 h-9 bg-green-600 text-white rounded-full flex items-center justify-center disabled:opacity-50"
            aria-label="送信"
          >
            {uploading ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 translate-x-0.5">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            )}
          </button>
          {/* キャンセルボタン */}
          <button
            onClick={handleFileCancel}
            disabled={uploading}
            className="flex-shrink-0 w-9 h-9 text-gray-400 hover:text-gray-600 flex items-center justify-center disabled:opacity-50"
            aria-label="キャンセル"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      )}

      {/* テキスト入力エリア */}
      <div className="flex items-end gap-2 px-3 py-2 safe-area-inset-bottom">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,application/pdf,audio/*"
          onChange={handleFileChange}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy || !!pendingFile}
          className="flex-shrink-0 w-10 h-10 text-gray-400 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-30 transition-colors"
          aria-label="ファイルを添付"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          rows={1}
          placeholder="メッセージを入力..."
          disabled={busy}
          className="flex-1 resize-none border border-gray-300 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50 overflow-y-auto bg-gray-50"
          style={{ maxHeight: '120px' }}
        />

        <button
          onClick={() => { void handleSend() }}
          disabled={!canSend}
          className="flex-shrink-0 w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center disabled:opacity-30 active:bg-green-700 transition-colors"
          aria-label="送信"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 translate-x-0.5">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
