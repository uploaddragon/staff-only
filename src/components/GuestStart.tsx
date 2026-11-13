import { useState } from 'react'
import { signInAsGuest, toKoreanError } from '../lib/supabase'

/** "가입 없이 둘러보기": 게스트로 바로 시작 (세션이 생기면 이름·역할 선택으로 넘어가요) */
export default function GuestStart({ onBeforeStart }: { onBeforeStart?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const start = async () => {
    onBeforeStart?.()
    setBusy(true)
    setError('')
    const { error } = await signInAsGuest()
    if (error) {
      setBusy(false)
      setError(toKoreanError(error.message))
    }
  }

  return (
    <div className="stack" style={{ width: '100%' }}>
      <button type="button" className="btn btn-block btn-guest" onClick={start} disabled={busy}>
        {busy ? '시작하는 중…' : '가입 없이 게스트로 시작'}
      </button>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
    </div>
  )
}
