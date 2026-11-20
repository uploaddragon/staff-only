import { useEffect, useState } from 'react'
import { resendSignupEmail, toKoreanError } from '../lib/supabase'

/** 가입 인증 메일 다시 보내기 (Supabase가 1분에 한 번만 허용해서 60초 기다리게 해요) */
export default function ResendEmail({ email, startCooldown = false }: { email: string; startCooldown?: boolean }) {
  const [left, setLeft] = useState(startCooldown ? 60 : 0)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [left])

  const resend = async () => {
    setBusy(true)
    setMsg('')
    const { error } = await resendSignupEmail(email)
    setBusy(false)
    if (error) return setMsg(toKoreanError(error.message))
    setMsg('인증 메일을 다시 보냈어요.')
    setLeft(60)
  }

  return (
    <div className="stack">
      <button type="button" className="btn btn-ghost btn-block" disabled={busy || left > 0 || !email} onClick={resend}>
        {busy ? '보내는 중…' : left > 0 ? `인증 메일 다시 보내기 (${left}초)` : '인증 메일 다시 보내기'}
      </button>
      {msg && <p className="hint center" role="status">{msg}</p>}
    </div>
  )
}
