import { useCallback, useRef, useState } from 'react'
import { api } from '../api/client'
import type { CallSignal } from '../types'

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected'

interface IncomingCall {
  fromUserId: number
  fromName: string
  offer: RTCSessionDescriptionInit
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

  const cleanup = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    pendingIceRef.current = []
    peerIdRef.current = null
    if (callTimeoutRef.current !== null) {
      window.clearTimeout(callTimeoutRef.current)
      callTimeoutRef.current = null
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
    peerIdRef.current = peerId
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
      await api.sendCallSignal(peerId, 'offer', { sdp: offer.sdp, type: offer.type })

      callTimeoutRef.current = window.setTimeout(() => {
        if (peerIdRef.current === peerId) {
          void api.sendCallSignal(peerId, 'hangup', {})
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
    const { fromUserId, fromName, offer } = incoming
    setIncoming(null)
    peerIdRef.current = fromUserId
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
    if (peerIdRef.current !== null) {
      void api.sendCallSignal(peerIdRef.current, 'hangup', {})
    }
    cleanup()
  }, [cleanup])

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
      if (state !== 'idle' || incoming) {
        void api.sendCallSignal(from_user_id, 'busy', {})
        return
      }
      setIncoming({ fromUserId: from_user_id, fromName: from_name, offer: payload as RTCSessionDescriptionInit })
      setState('ringing')
      return
    }

    if (peerIdRef.current !== from_user_id) return

    if (type === 'answer') {
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
