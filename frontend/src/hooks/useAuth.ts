import { useState, useCallback } from 'react'
import { api } from '../api/client'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
}

function loadAuth(): AuthState {
  try {
    const token = localStorage.getItem('token')
    const raw   = localStorage.getItem('user')
    if (token && raw) return { token, user: JSON.parse(raw) as User }
  } catch {
    // ignore
  }
  return { user: null, token: null }
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(loadAuth)

  const login = useCallback(async (pin: string) => {
    const { token, user } = await api.login(pin)
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    setAuth({ token, user })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setAuth({ user: null, token: null })
  }, [])

  return { user: auth.user, isLoggedIn: !!auth.user, login, logout }
}
