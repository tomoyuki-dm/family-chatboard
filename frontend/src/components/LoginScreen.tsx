import { useState, type FormEvent } from 'react'

interface Props {
  onLogin: (pin: string) => Promise<void>
}

export function LoginScreen({ onLogin }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onLogin(pin)
    } catch {
      setError('PINが違います')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">👨‍👩‍👧‍👦</div>
          <h1 className="text-2xl font-bold text-green-700">家族チャット</h1>
          <p className="text-gray-500 text-sm mt-1">PINを入力してください</p>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e) }}
              className="bg-white rounded-2xl shadow-md p-6 space-y-4">
          <div>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-4 text-center text-3xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="••••"
              maxLength={8}
              autoFocus
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold text-lg disabled:opacity-40 active:bg-green-700 transition-colors"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}
