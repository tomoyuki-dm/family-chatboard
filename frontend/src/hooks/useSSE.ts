import { useEffect, useRef } from 'react'
import { api } from '../api/client'
import type { Message, PresenceMap, ReadUpdate } from '../types'

interface SSEHandlers {
  onMessage:  (msg: Message) => void
  onPresence: (presence: PresenceMap) => void
  onRead:     (update: ReadUpdate) => void
  onDeleted:  (messageId: number) => void
  getLastId:  () => number
}

export function useSSE({ onMessage, onPresence, onRead, onDeleted, getLastId }: SSEHandlers) {
  const handlersRef = useRef<SSEHandlers>({ onMessage, onPresence, onRead, onDeleted, getLastId })
  useEffect(() => {
    handlersRef.current = { onMessage, onPresence, onRead, onDeleted, getLastId }
  })

  useEffect(() => {
    let es: EventSource | null = null
    let closed = false

    async function connect() {
      if (closed) return
      try {
        const sseToken = await api.getSseToken()
        if (closed) return

        es = new EventSource(api.sseUrl(sseToken, handlersRef.current.getLastId()))

        es.addEventListener('message', (e: Event) => {
          const msg = JSON.parse((e as MessageEvent<string>).data) as Message
          handlersRef.current.onMessage(msg)
        })

        es.addEventListener('presence', (e: Event) => {
          const data = JSON.parse((e as MessageEvent<string>).data) as PresenceMap
          handlersRef.current.onPresence(data)
        })

        es.addEventListener('read', (e: Event) => {
          const data = JSON.parse((e as MessageEvent<string>).data) as ReadUpdate
          handlersRef.current.onRead(data)
        })

        es.addEventListener('deleted', (e: Event) => {
          const data = JSON.parse((e as MessageEvent<string>).data) as { message_id: number }
          handlersRef.current.onDeleted(data.message_id)
        })

        es.addEventListener('reconnect', () => {
          es?.close()
          if (!closed) setTimeout(() => { void connect() }, 200)
        })

        es.addEventListener('log_switched', () => {
          es?.close()
          window.location.reload()
        })

        es.onerror = () => {
          es?.close()
          if (!closed) setTimeout(() => { void connect() }, 2000)
        }
      } catch {
        if (!closed) setTimeout(() => { void connect() }, 5000)
      }
    }

    void connect()
    return () => {
      closed = true
      es?.close()
    }
  }, [])
}
