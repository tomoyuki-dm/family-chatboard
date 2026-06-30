import type { PresenceMap, User } from '../types'

interface Props {
  members: User[]
  presence: PresenceMap
  currentUserId: number
  callDisabled: boolean
  onCall: (userId: number, userName: string) => void
}

const AVATAR_COLORS = [
  'bg-green-600',
  'bg-blue-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
]

export function MemberList({ members, presence, currentUserId, callDisabled, onCall }: Props) {
  return (
    <div className="flex gap-4 px-4 py-2 bg-white border-b border-gray-100 overflow-x-auto">
      {members.map((member, i) => {
        const online  = !!presence[member.id]
        const isMe    = member.id === currentUserId
        const color   = AVATAR_COLORS[i % AVATAR_COLORS.length]
        const canCall = online && !isMe && !callDisabled
        return (
          <div key={member.id} className="flex flex-col items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              className="relative disabled:cursor-default"
              disabled={!canCall}
              title={canCall ? `${member.name}さんに音声通話を発信` : undefined}
              onClick={() => canCall && onCall(member.id, member.name)}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${online ? color : 'bg-gray-400'} ${canCall ? 'cursor-pointer ring-2 ring-transparent hover:ring-green-400 transition-shadow' : ''}`}>
                {member.name[0]}
              </div>
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                  online ? 'bg-green-400' : 'bg-gray-300'
                }`}
              />
            </button>
            <span className="text-xs text-gray-500 max-w-[36px] truncate">
              {isMe ? '自分' : member.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}
