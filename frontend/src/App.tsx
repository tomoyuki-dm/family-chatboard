import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { LoginScreen } from './components/LoginScreen'
import { ChatRoom } from './components/ChatRoom'
import { SetupScreen } from './components/SetupScreen'
import { api } from './api/client'

export function App() {
  const { user, isLoggedIn, login, logout } = useAuth()
  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null)
  const [setupError, setSetupError]   = useState(false)

  useEffect(() => {
    api.checkSetup()
      .then(({ needed }) => setSetupNeeded(needed))
      .catch(() => setSetupError(true))
  }, [])

  if (setupError) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-red-500 text-sm">サーバーに接続できません。<br />しばらく待ってから再読み込みしてください。</p>
      </div>
    )
  }

  if (setupNeeded === null) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </div>
    )
  }

  if (setupNeeded) {
    return <SetupScreen onComplete={() => setSetupNeeded(false)} />
  }

  if (!isLoggedIn || !user) {
    return <LoginScreen onLogin={login} />
  }

  return <ChatRoom currentUser={user} onLogout={logout} />
}
