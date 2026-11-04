import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase, toKoreanError } from '../lib/supabase'

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // DB 트리거가 이 값으로 profiles.display_name을 채워요
      options: { data: { display_name: name.trim() } },
    })
    setBusy(false)
    if (error) return setError(toKoreanError(error.message))
    // 이메일 인증이 켜져 있으면 세션 없이 돌아와요
    if (!data.session) setInfo('인증 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.')
  }

  return (
    <main className="auth">
      <div className="brand">
        <img src="/icon.svg" alt="" />
        <span className="brand-name">스태프온리</span>
      </div>
      <div>
        <h1 className="page-title">회원가입</h1>
        <p className="page-sub">점주·알바 모두 같은 방법으로 가입해요</p>
      </div>

      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span className="label">이름 (매장에서 보일 이름)</span>
          <input className="input" autoComplete="name" maxLength={20}
            value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          <span className="label">이메일</span>
          <input className="input" type="email" inputMode="email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span className="label">비밀번호</span>
          <input className="input" type="password" autoComplete="new-password" minLength={6}
            value={password} onChange={(e) => setPassword(e.target.value)} required />
          <span className="hint">6자 이상</span>
        </label>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {info && <p className="alert alert-info" role="status">{info}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? '가입 중…' : '가입하기'}
        </button>
      </form>

      <p className="center muted">
        이미 계정이 있나요? <Link className="link" to="/login">로그인</Link>
      </p>
    </main>
  )
}
