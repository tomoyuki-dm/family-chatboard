import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { LoginScreen } from './components/LoginScreen'
import { ChatRoom } from './components/ChatRoom'
import { SetupScreen } from './components/SetupScreen'
import { api } from './api/client'

export function App() {
  const { user, isLoggedIn, login, logout } = useAuth()
  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null)

  useEffect(() => {
    api.checkSetup()
      .then(({ needed }) => setSetupNeeded(needed))
      .catch(() => setSetupNeeded(false))
  }, [])

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
