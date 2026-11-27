import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase, toKoreanError } from '../lib/supabase'

const ROLES = [
  { value: 'staff', title: '알바·직원이에요', desc: '점주에게 받은 초대코드로 매장에 들어가요' },
  { value: 'owner', title: '점주예요', desc: '매장을 만들고 직원을 초대해요' },
] as const

/** 가입 직후 한 번: 매장에서 보일 이름과 점주/알바를 골라요 (구글·카카오 가입자도 여기서 이름 확인) */
export default function RoleSetup() {
  const navigate = useNavigate()
  const { profile, refreshProfile, signOut } = useAuth()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [role, setRole] = useState<'owner' | 'staff' | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile || !role) return
    setBusy(true)
    setError('')
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name.trim(), user_type: role })
      .eq('id', profile.id)
    if (error) {
      setBusy(false)
      return setError(toKoreanError(error.message))
    }
    // 홈에서 고른 역할에 맞는 화면 안내(버튼 강조 설명)가 시작돼요
    navigate('/', { replace: true })
    await refreshProfile()
  }

  return (
    <main className="auth">
      <div className="brand">
        <img src="/brand/logo.svg" alt="" />
        <span className="brand-name">스태프온리</span>
      </div>
      <div>
        <h1 className="page-title">반가워요!</h1>
        <p className="page-sub">처음 한 번만 정하면 돼요</p>
      </div>

      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span className="label">이름 (매장에서 보일 이름)</span>
          <input className="input" maxLength={20} autoComplete="name"
            value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <div className="field" role="radiogroup" aria-label="역할">
          <span className="label">어떻게 쓰실 건가요?</span>
          {ROLES.map((r) => (
            <button key={r.value} type="button" role="radio" aria-checked={role === r.value}
              className={`check-card${role === r.value ? ' on' : ''}`} onClick={() => setRole(r.value)}>
              <span className="check-box" aria-hidden="true">{role === r.value ? '✓' : ''}</span>
              <span>
                <span className="check-title">{r.title}</span>
                <span className="check-desc">{r.desc}</span>
              </span>
            </button>
          ))}
          <span className="hint">고르면 화면의 주요 버튼을 하나씩 짚어 설명해 드려요. 실제 역할은 매장마다 따로라서, 다른 매장에서는 다르게 일할 수도 있어요.</span>
        </div>

        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy || !role || !name.trim()}>
          {busy ? '저장 중…' : '시작하기'}
        </button>
      </form>

      <button type="button" className="btn btn-ghost btn-block" onClick={signOut}>다른 계정으로 로그인</button>
    </main>
  )
}
