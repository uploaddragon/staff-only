import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import SocialLogin from '../components/SocialLogin'
import ResendEmail from '../components/ResendEmail'
import { emailRedirectTo, supabase, toKoreanError } from '../lib/supabase'

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // DB 트리거가 이 값으로 profiles.display_name을 채워요
      options: { data: { display_name: name.trim() }, emailRedirectTo: emailRedirectTo() },
    })
    setBusy(false)
    if (error) return setError(toKoreanError(error.message))
    // 이메일 인증이 켜져 있으면 이미 가입된 이메일도 오류 없이 돌아와요 (identities가 비어 있음)
    if (data.user && data.user.identities?.length === 0)
      return setError('이미 가입된 이메일이에요. 로그인해 주세요. 인증을 안 끝냈다면 로그인 화면에서 인증 메일을 다시 받을 수 있어요.')
    // 이메일 인증이 켜져 있으면 세션 없이 돌아와요
    if (!data.session) setSentTo(email.trim())
  }

  if (sentTo) {
    return (
      <main className="auth">
        <div className="brand">
          <img src="/brand/logo.svg" alt="" />
          <span className="brand-name">스태프온리</span>
        </div>
        <div>
          <h1 className="page-title">메일함을 확인해 주세요</h1>
          <p className="page-sub"><strong>{sentTo}</strong>(으)로 인증 메일을 보냈어요.</p>
        </div>
        <section className="card stack">
          <p>메일의 <strong>이메일 인증하기</strong> 버튼을 누르면 가입이 끝나고 바로 시작할 수 있어요.</p>
          <p className="hint">메일이 안 보이면 스팸함도 확인해 주세요. 링크는 1시간 동안 쓸 수 있어요.</p>
        </section>
        <ResendEmail email={sentTo} startCooldown />
        <Link className="btn btn-primary btn-block btn-link" to="/login">로그인 화면으로</Link>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => { setSentTo(''); setPassword('') }}>
          다른 이메일로 가입
        </button>
      </main>
    )
  }

  return (
    <main className="auth">
      <div className="brand">
        <img src="/brand/logo.svg" alt="" />
        <span className="brand-name">스태프온리</span>
      </div>
      <div>
        <h1 className="page-title">회원가입</h1>
        <p className="page-sub">가입한 뒤 점주·알바를 골라요</p>
      </div>

      <SocialLogin />

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
