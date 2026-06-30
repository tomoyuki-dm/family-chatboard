import { useCallback, useRef, useState } from 'react'
import { api } from '../api/client'
import type { CallSignal } from '../types'

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected'

interface IncomingCall {
  fromUserId: number
  fromName: string
  offer: RTCSessionDescriptionInit
  callId: string
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

// 音声通話に十分な上限ビットレート（自動調整はOpusコーデックに任せ、上限のみ制限）
const MAX_AUDIO_BITRATE = 24000

async function capAudioBitrate(pc: RTCPeerConnection): Promise<void> {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== 'audio') continue
    const params = sender.getParameters()
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}]
    params.encodings[0].maxBitrate = MAX_AUDIO_BITRATE
    try {
      await sender.setParameters(params)
    } catch {
      // 一部ブラウザでは接続前のsetParametersが失敗することがあるが致命的ではない
    }
  }
}

// CANCEL相当の信号を一定間隔で複数回再送する（応答は待たない・UIとは無関係にバックグラウンドで完結）
const CANCEL_RETRY_INTERVAL_MS = 2000
const CANCEL_RETRY_MAX_ATTEMPTS = 6 // 約10秒間、合計6回試行

function sendCancelWithRetry(targetId: number, callId: string | null): void {
  let attempts = 0
  const send = () => { void api.sendCallSignal(targetId, 'cancel', { callId }) }
  send()
  const retryId = window.setInterval(() => {
    attempts++
    if (attempts >= CANCEL_RETRY_MAX_ATTEMPTS) {
      window.clearInterval(retryId)
      return
    }
    send()
  }, CANCEL_RETRY_INTERVAL_MS)
}

// INVITE相当(offer)を一定間隔で再送する。ringing/answer等を受けたら呼び出し側で停止させる
const OFFER_RETRY_INTERVAL_MS = 3000

export function useCall() {
  const [state, setState]       = useState<CallState>('idle')
  const [peerName, setPeerName] = useState('')
  const [incoming, setIncoming] = useState<IncomingCall | null>(null)
  const [muted, setMuted]       = useState(false)

  const pcRef           = useRef<RTCPeerConnection | null>(null)
  const localStreamRef  = useRef<MediaStream | null>(null)
  const remoteAudioRef  = useRef<HTMLAudioElement | null>(null)
  const peerIdRef        = useRef<number | null>(null)
  const pendingIceRef    = useRef<RTCIceCandidateInit[]>([])
  const callTimeoutRef   = useRef<number | null>(null)
  const offerRetryRef    = useRef<number | null>(null)
  const callIdRef         = useRef<string | null>(null)

  const cleanup = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    pendingIceRef.current = []
    peerIdRef.current = null
    callIdRef.current = null
    if (callTimeoutRef.current !== null) {
      window.clearTimeout(callTimeoutRef.current)
      callTimeoutRef.current = null
    }
    if (offerRetryRef.current !== null) {
      window.clearInterval(offerRetryRef.current)
      offerRetryRef.current = null
    }
    setState('idle')
    setPeerName('')
    setIncoming(null)
    setMuted(false)
  }, [])

  const createPeerConnection = useCallback((peerId: number) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        void api.sendCallSignal(peerId, 'ice', e.candidate.toJSON())
      }
    }

    pc.ontrack = (e) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0]
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        if (peerIdRef.current !== null) {
          void api.sendCallSignal(peerIdRef.current, 'hangup', {})
        }
        cleanup()
        alert('通話の接続に失敗しました。ネットワーク環境により接続できない場合があります。')
      }
    }

    pcRef.current = pc
    return pc
  }, [cleanup])

  const startCall = useCallback(async (peerId: number, peerNameArg: string) => {
    if (state !== 'idle') return
    const callId = crypto.randomUUID()
    peerIdRef.current = peerId
    callIdRef.current = callId
    setPeerName(peerNameArg)
    setState('calling')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      localStreamRef.current = stream
      const pc = createPeerConnection(peerId)
      stream.getTracks().forEach((t) => pc.addTrack(t, stream))
      await capAudioBitrate(pc)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sendOffer = () => { void api.sendCallSignal(peerId, 'offer', { sdp: offer.sdp, type: offer.type, callId }) }
      sendOffer()
      offerRetryRef.current = window.setInterval(sendOffer, OFFER_RETRY_INTERVAL_MS)

      callTimeoutRef.current = window.setTimeout(() => {
        if (peerIdRef.current === peerId) {
          sendCancelWithRetry(peerId, callId)
          cleanup()
          alert('応答がありませんでした')
        }
      }, 30_000)
    } catch (err) {
      cleanup()
      alert('マイクにアクセスできませんでした: ' + String(err))
    }
  }, [state, createPeerConnection, cleanup])

  const acceptCall = useCallback(async () => {
    if (!incoming) return
    const { fromUserId, fromName, offer, callId } = incoming
    setIncoming(null)
    peerIdRef.current = fromUserId
    callIdRef.current = callId
    setPeerName(fromName)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      localStreamRef.current = stream
      const pc = createPeerConnection(fromUserId)
      stream.getTracks().forEach((t) => pc.addTrack(t, stream))
      await capAudioBitrate(pc)
      await pc.setRemoteDescription(offer)
      for (const cand of pendingIceRef.current) {
        await pc.addIceCandidate(cand)
      }
      pendingIceRef.current = []
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await api.sendCallSignal(fromUserId, 'answer', { sdp: answer.sdp, type: answer.type })
      setState('connected')
    } catch (err) {
      void api.sendCallSignal(fromUserId, 'hangup', {})
      cleanup()
      alert('マイクにアクセスできませんでした: ' + String(err))
    }
  }, [incoming, createPeerConnection, cleanup])

  const rejectCall = useCallback(() => {
    if (!incoming) return
    void api.sendCallSignal(incoming.fromUserId, 'reject', {})
    setIncoming(null)
    setState('idle')
  }, [incoming])

  const hangup = useCallback(() => {
    const target = peerIdRef.current
    const callId = callIdRef.current
    if (target !== null) {
      if (state === 'calling') {
        // 応答前のキャンセル(CANCEL相当)。UIはここで即座に閉じ、再送はバックグラウンドに任せて結果は待たない
        sendCancelWithRetry(target, callId)
      } else {
        void api.sendCallSignal(target, 'hangup', {})
      }
    }
    cleanup()
  }, [state, cleanup])

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const next = !muted
    stream.getAudioTracks().forEach((t) => { t.enabled = !next })
    setMuted(next)
  }, [muted])

  const handleSignal = useCallback((signal: CallSignal) => {
    const { from_user_id, from_name, type, payload } = signal

    if (type === 'offer') {
      const offerPayload = payload as { sdp: string; type: RTCSdpType; callId: string }
      if (incoming && incoming.fromUserId === from_user_id && incoming.callId === offerPayload.callId) {
        // 同一通話試行の再送offerとみなし、着信UIはそのまま維持してringingのみ返す
        void api.sendCallSignal(from_user_id, 'ringing', {})
        return
      }
      if (peerIdRef.current === from_user_id && callIdRef.current === offerPayload.callId) {
        // 既にこの通話試行を確立済み/処理中 → 再送されたofferとみなし無視
        return
      }
      if (state !== 'idle' || incoming) {
        void api.sendCallSignal(from_user_id, 'busy', {})
        return
      }
      setIncoming({
        fromUserId: from_user_id,
        fromName: from_name,
        offer: { sdp: offerPayload.sdp, type: offerPayload.type },
        callId: offerPayload.callId,
      })
      setState('ringing')
      void api.sendCallSignal(from_user_id, 'ringing', {})
      return
    }

    if (type === 'cancel') {
      // 応答前のキャンセル(CANCEL相当)。peerIdRefがまだ未設定の着信中(ringing)でも処理できるようガード外で扱う。
      // 同一相手への別の通話試行(callId不一致)まで誤って巻き込まないようcallIdで照合する
      const cancelCallId = (payload as { callId?: string } | null)?.callId ?? null
      if (incoming && incoming.fromUserId === from_user_id && incoming.callId === cancelCallId) {
        setIncoming(null)
        setState('idle')
        return
      }
      if (peerIdRef.current === from_user_id && callIdRef.current === cancelCallId) {
        cleanup()
      }
      return
    }

    if (peerIdRef.current !== from_user_id) return

    if (type === 'ringing') {
      if (offerRetryRef.current !== null) {
        window.clearInterval(offerRetryRef.current)
        offerRetryRef.current = null
      }
      return
    }

    if (type === 'answer') {
      if (offerRetryRef.current !== null) {
        window.clearInterval(offerRetryRef.current)
        offerRetryRef.current = null
      }
      if (callTimeoutRef.current !== null) {
        window.clearTimeout(callTimeoutRef.current)
        callTimeoutRef.current = null
      }
      const pc = pcRef.current
      if (!pc) return
      void pc.setRemoteDescription(payload as RTCSessionDescriptionInit).then(async () => {
        for (const cand of pendingIceRef.current) {
          await pc.addIceCandidate(cand)
        }
        pendingIceRef.current = []
        setState('connected')
      })
    } else if (type === 'ice') {
      const cand = payload as RTCIceCandidateInit
      if (pcRef.current?.remoteDescription) {
        void pcRef.current.addIceCandidate(cand)
      } else {
        pendingIceRef.current.push(cand)
      }
    } else if (type === 'hangup' || type === 'reject' || type === 'busy') {
      if (type === 'busy') alert(`${from_name}さんは通話中です`)
      cleanup()
    }
  }, [state, incoming, cleanup])

  return {
    state,
    peerName,
    incomingName: incoming?.fromName ?? null,
    muted,
    remoteAudioRef,
    startCall,
    acceptCall,
    rejectCall,
    hangup,
    toggleMute,
    handleSignal,
  }
}
