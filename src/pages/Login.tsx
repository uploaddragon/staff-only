import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase, toKoreanError } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(toKoreanError(error.message))
    // 성공하면 AuthProvider가 세션을 받아 홈으로 이동해요
  }

  return (
    <main className="auth">
      <div className="brand">
        <img src="/icon.svg" alt="" />
        <span className="brand-name">스태프온리</span>
      </div>
      <div>
        <h1 className="page-title">로그인</h1>
        <p className="page-sub">매장 직원 전용 공간이에요</p>
      </div>

      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span className="label">이메일</span>
          <input className="input" type="email" inputMode="email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span className="label">비밀번호</span>
          <input className="input" type="password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? '로그인 중…' : '로그인'}
        </button>
      </form>

      <p className="center muted">
        처음이신가요? <Link className="link" to="/signup">회원가입</Link>
      </p>
    </main>
  )
}
