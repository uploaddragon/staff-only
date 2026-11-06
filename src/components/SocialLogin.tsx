import { useState } from 'react'
import { signInWithProvider, toKoreanError, type OAuthProvider } from '../lib/supabase'

/** 구글·카카오로 시작하기. 처음 누르면 가입, 다음부터는 로그인이에요. */
export default function SocialLogin() {
  const [busy, setBusy] = useState<OAuthProvider | null>(null)
  const [error, setError] = useState('')

  const start = async (provider: OAuthProvider) => {
    setBusy(provider)
    setError('')
    const { error } = await signInWithProvider(provider)
    // 성공하면 구글·카카오 페이지로 넘어가요. 여기로 돌아오면 실패한 거예요.
    if (error) {
      setBusy(null)
      setError(
        error.message.toLowerCase().includes('provider is not enabled')
          ? `${provider === 'google' ? '구글' : '카카오'} 로그인이 아직 설정되지 않았어요. Supabase에서 켜 주세요.`
          : toKoreanError(error.message),
      )
    }
  }

  return (
    <div className="stack">
      <button type="button" className="btn btn-block btn-kakao" disabled={busy !== null} onClick={() => start('kakao')}>
        <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
          <path fill="currentColor" d="M12 3C6.48 3 2 6.48 2 10.78c0 2.77 1.86 5.2 4.66 6.58l-.95 3.48c-.08.3.26.54.52.37l4.13-2.73c.54.06 1.09.1 1.64.1 5.52 0 10-3.48 10-7.8S17.52 3 12 3z" />
        </svg>
        {busy === 'kakao' ? '카카오로 이동 중…' : '카카오로 시작하기'}
      </button>
      <button type="button" className="btn btn-block btn-google" disabled={busy !== null} onClick={() => start('google')}>
        <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
        {busy === 'google' ? '구글로 이동 중…' : '구글로 시작하기'}
      </button>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <div className="divider"><span>또는 이메일로</span></div>
    </div>
  )
}
