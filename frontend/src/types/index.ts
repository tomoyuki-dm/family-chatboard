export interface User {
  id: number
  name: string
  role: 'parent' | 'child' | 'admin'
}

export interface FilePayload {
  id: number
  mime: string
  name: string
  size: number
}

export interface Message {
  id: number
  user_id: number
  user_name: string
  type: 'text' | 'image' | 'file'
  body: string
  deleted: boolean
  created_at: string
  read_count: number
  read_by: number[]
}

export interface PresenceMap {
  [userId: number]: boolean
}

export interface ReadUpdate {
  message_id: number
  read_count: number
  read_by: number[]
}

export type CallSignalType = 'offer' | 'answer' | 'ice' | 'hangup' | 'reject' | 'busy' | 'ringing' | 'cancel'

export interface CallSignal {
  from_user_id: number
  from_name: string
  type: CallSignalType
  payload: unknown
}
