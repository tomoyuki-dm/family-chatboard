import { useEffect, useState } from 'react'
import type { CallState } from '../hooks/useCall'

interface Props {
  state: CallState
  peerName: string
  incomingName: string | null
  muted: boolean
  remoteAudioRef: React.RefObject<HTMLAudioElement>
  onAccept: () => void
  onReject: () => void
  onHangup: () => void
  onToggleMute: () => void
}

function useElapsedSeconds(active: boolean): number {
  const [sec, setSec] = useState(0)
  useEffect(() => {
    if (!active) {
      setSec(0)
      return
    }
    const start = Date.now()
    const id = setInterval(() => setSec(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [active])
  return sec
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function CallOverlay({
  state, peerName, incomingName, muted, remoteAudioRef,
  onAccept, onReject, onHangup, onToggleMute,
}: Props) {
  const elapsed = useElapsedSeconds(state === 'connected')

  if (state === 'idle') return null

  const displayName = state === 'ringing' ? (incomingName ?? '') : peerName

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={remoteAudioRef} autoPlay />
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-green-600 flex items-center justify-center text-white text-2xl font-bold">
          {displayName[0] ?? '?'}
        </div>

        {state === 'ringing' && (
          <>
            <p className="font-bold text-gray-800">{displayName} さんから着信</p>
            <p className="text-xs text-gray-400 animate-pulse">音声通話の着信です</p>
            <div className="flex gap-3">
              <button
                onClick={onReject}
                className="flex-1 bg-red-500 text-white font-bold rounded-xl py-2.5 text-sm hover:bg-red-600 transition-colors"
              >
                拒否
              </button>
              <button
                onClick={onAccept}
                className="flex-1 bg-green-600 text-white font-bold rounded-xl py-2.5 text-sm hover:bg-green-700 transition-colors"
              >
                応答
              </button>
            </div>
          </>
        )}

        {state === 'calling' && (
          <>
            <p className="font-bold text-gray-800">{displayName} さんを呼び出し中...</p>
            <p className="text-xs text-gray-400 animate-pulse">応答をお待ちください</p>
            <button
              onClick={onHangup}
              className="w-full bg-red-500 text-white font-bold rounded-xl py-2.5 text-sm hover:bg-red-600 transition-colors"
            >
              キャンセル
            </button>
          </>
        )}

        {state === 'connected' && (
          <>
            <p className="font-bold text-gray-800">{displayName} さんと通話中</p>
            <p className="text-sm text-gray-400 font-mono">{formatElapsed(elapsed)}</p>
            <div className="flex gap-3">
              <button
                onClick={onToggleMute}
                className={`flex-1 font-bold rounded-xl py-2.5 text-sm transition-colors ${
                  muted ? 'bg-gray-200 text-gray-700' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {muted ? 'ミュート中' : 'ミュート'}
              </button>
              <button
                onClick={onHangup}
                className="flex-1 bg-red-500 text-white font-bold rounded-xl py-2.5 text-sm hover:bg-red-600 transition-colors"
              >
                終了
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
