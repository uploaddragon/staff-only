import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { EmailOtpType } from '@supabase/supabase-js'
import { useAuth } from '../auth/AuthProvider'
import { markIntroSeen } from '../lib/intro'
import { supabase, toKoreanError } from '../lib/supabase'

/**
 * 인증 메일의 링크가 여는 화면: /auth/confirm?token_hash=…&type=email | email_change
 * - 가입 인증(email): 확인되면 바로 로그인돼서 홈(처음이면 점주·알바 고르기)으로 가요.
 * - 게스트 → 이메일 연결(email_change): 확인되면 로그인에 쓸 비밀번호를 정해요.
 * token_hash 방식이라 가입한 기기와 다른 폰·PC에서 메일을 열어도 돼요.
 */
export default function AuthConfirm() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const tokenHash = params.get('token_hash')
  const type = params.get('type') as EmailOtpType | null
  const [state, setState] = useState<'checking' | 'password' | 'error'>('checking')
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const started = useRef(false) // 개발 모드에서 두 번 불려도 한 번만 확인해요 (링크는 한 번만 쓸 수 있어요)

  useEffect(() => {
    if (started.current) return
    started.current = true
    markIntroSeen() // 실패해서 로그인 화면으로 가도 소개로 돌려보내지 않아요
    if (!tokenHash || !type) {
      setError('인증 링크가 올바르지 않아요. 메일의 버튼을 다시 눌러 주세요.')
      return setState('error')
    }
    supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(async ({ error }) => {
      if (error) {
        setError(toKoreanError(error.message))
        return setState('error')
      }
      await refreshProfile()
      if (type === 'email_change') setState('password')
      else navigate('/', { replace: true })
    })
  }, [tokenHash, type, navigate, refreshProfile])

  const savePassword = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(toKoreanError(error.message))
    navigate('/', { replace: true })
  }

  return (
    <main className="auth">
      <div className="brand">
        <img src="/brand/logo.svg" alt="" />
        <span className="brand-name">스태프온리</span>
      </div>
      {state === 'checking' && (
        <div>
          <h1 className="page-title">이메일 확인 중…</h1>
          <p className="page-sub">잠깐만 기다려 주세요.</p>
        </div>
      )}
      {state === 'error' && (
        <>
          <div>
            <h1 className="page-title">인증하지 못했어요</h1>
            <p className="page-sub">{error}</p>
          </div>
          <p className="hint">이미 인증을 끝냈다면 그냥 로그인하면 돼요. 아니라면 로그인 화면에서 이메일·비밀번호를 넣으면 인증 메일을 다시 받을 수 있어요.</p>
          <Link className="btn btn-primary btn-block btn-link" to="/login" replace>로그인 화면으로</Link>
        </>
      )}
      {state === 'password' && (
        <>
          <div>
            <h1 className="page-title">이메일을 연결했어요</h1>
            <p className="page-sub">마지막으로, 이 이메일로 로그인할 때 쓸 비밀번호를 정해 주세요.</p>
          </div>
          <form className="form" onSubmit={savePassword}>
            <label className="field">
              <span className="label">비밀번호</span>
              <input className="input" type="password" autoComplete="new-password" minLength={6} autoFocus
                value={password} onChange={(e) => setPassword(e.target.value)} required />
              <span className="hint">6자 이상</span>
            </label>
            {error && <p className="alert alert-error" role="alert">{error}</p>}
            <button className="btn btn-primary btn-block" disabled={busy || password.length < 6}>
              {busy ? '저장 중…' : '비밀번호 정하고 시작하기'}
            </button>
          </form>
        </>
      )}
    </main>
  )
}
