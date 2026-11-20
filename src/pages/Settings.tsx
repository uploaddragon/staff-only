import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { WEEK_DAYS } from '../lib/days'
import { emailRedirectTo, linkProvider, supabase, toKoreanError, type OAuthProvider } from '../lib/supabase'
import { useStore } from '../store/StoreProvider'

const PROVIDER_LABEL: Record<string, string> = { email: '이메일', google: '구글', kakao: '카카오', guest: '게스트' }

export default function Settings() {
  const { session, profile, refreshProfile, signOut } = useAuth()
  const { memberships, active, isOwner, refresh, selectStore } = useStore()
  const approved = memberships.filter((m) => m.status === 'approved')
  const isGuest = !!session?.user.is_anonymous
  // 게스트였다가 방금 연결한 경우 완료 안내를 남겨요 (연결 카드는 바로 사라지니까)
  const [wasGuest] = useState(isGuest)
  const justLinked = wasGuest && !isGuest
  const provider = isGuest ? 'guest' : String(session?.user.app_metadata.provider ?? 'email')

  // 게스트가 로그아웃하면 같은 계정으로 다시 들어올 방법이 없어서 한 번 더 물어봐요
  const onSignOut = () => {
    if (isGuest && !confirm('게스트로 로그아웃하면 지금 쓰던 매장·기록에 다시 들어올 수 없어요. 계정을 연결하지 않고 로그아웃할까요?')) return
    signOut()
  }

  const changeUserType = async (userType: 'owner' | 'staff') => {
    if (!profile || profile.user_type === userType) return
    await supabase.from('profiles').update({ user_type: userType }).eq('id', profile.id)
    await refreshProfile()
  }

  return (
    <main className="page">
      <h1 className="page-title">설정</h1>

      <section className="card stack">
        <div>
          <p style={{ fontWeight: 600, minHeight: '1.5em' }}>{profile?.display_name}</p>
          <p className="muted">
            {isGuest ? '게스트로 사용 중' : `${PROVIDER_LABEL[provider] ?? provider} 로그인`}
            {session?.user.email ? ` · ${session.user.email}` : ''}
          </p>
        </div>
        <NameEdit />
        <div className="field">
          <span className="label">가입 유형 (첫 화면 안내용)</span>
          <div className="btn-row">
            {(['staff', 'owner'] as const).map((t) => (
              <button key={t} type="button" style={{ flex: 1 }}
                className={`btn btn-sm ${profile?.user_type === t ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => changeUserType(t)}>
                {t === 'owner' ? '점주' : '알바·직원'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {isGuest && <GuestUpgrade />}
      {justLinked && (
        <p className="alert alert-info" role="status">
          계정을 연결했어요. 이제 다른 폰에서도 이 계정으로 로그인하면 같은 매장·기록을 볼 수 있어요.
        </p>
      )}

      {active && (
        <section className="card stack">
          <div className="row">
            <div>
              <p className="muted">이 매장에서 {isOwner ? '점주' : '직원'}</p>
              <p className="list-name" style={{ fontSize: 'var(--text-lg)' }}>{active.store_name}</p>
            </div>
            {isOwner && <Link className="btn btn-primary btn-sm btn-link" to="/manage">매장 관리</Link>}
          </div>
          {/* 점주는 근무 요일 없이 "오늘까지 임박한 상품"을 봐요 */}
          {!isOwner && <WorkDays key={active.store_id} storeId={active.store_id} initial={active.work_days} onSaved={refresh} />}
        </section>
      )}

      {approved.length > 1 && (
        <section className="card">
          <h2 className="section-title">매장 전환</h2>
          <div className="list">
            {approved.map((m) => (
              <button key={m.store_id} className="list-item list-button" onClick={() => selectStore(m.store_id)}>
                <span className="list-name">{m.store_name}</span>
                {m.store_id === active?.store_id && <span className="badge">보는 중</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="btn-row" id="stores">
        <Link className="btn btn-ghost btn-link" style={{ flex: 1, fontSize: 'var(--text-md)' }} to="/join">다른 매장 입장</Link>
        <Link className="btn btn-ghost btn-link" style={{ flex: 1, fontSize: 'var(--text-md)' }} to="/store/new">새 매장 만들기</Link>
      </div>

      <button className="btn btn-ghost btn-block" onClick={onSignOut}>로그아웃</button>
      <p className="center hint"><Link className="muted" to="/privacy">개인정보처리방침</Link></p>
    </main>
  )
}

/** 근무 요일 토글: 누를 때마다 바로 저장해요 */
function WorkDays({ storeId, initial, onSaved }: { storeId: string; initial: number[]; onSaved: () => Promise<void> }) {
  const [days, setDays] = useState<number[]>(initial)
  const [error, setError] = useState('')

  const toggle = async (day: number) => {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
    setDays(next)
    setError('')
    const { error } = await supabase.rpc('set_work_days', { p_store_id: storeId, p_days: next })
    if (error) {
      setDays(days) // 실패하면 되돌려요
      setError(toKoreanError(error.message))
      return
    }
    await onSaved()
  }

  return (
    <div className="stack">
      <div>
        <p className="label">이 매장 근무 요일</p>
        <p className="hint">출근일 기준으로 "오늘 뺄 상품"을 미리 챙겨드려요</p>
      </div>
      <div className="chips" role="group" aria-label="근무 요일">
        {WEEK_DAYS.map((d) => (
          <button key={d.value} type="button" className={`chip${days.includes(d.value) ? ' on' : ''}`}
            aria-pressed={days.includes(d.value)} onClick={() => toggle(d.value)}>
            {d.label}
          </button>
        ))}
      </div>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
    </div>
  )
}

/** 이름 바꾸기 (매장에서 보일 이름) */
function NameEdit() {
  const { profile, refreshProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  if (!profile) return null
  if (!editing) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}
        onClick={() => { setName(profile.display_name); setEditing(true) }}>
        이름 바꾸기
      </button>
    )
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', profile.id)
    if (error) return setError(toKoreanError(error.message))
    await refreshProfile()
    setEditing(false)
  }

  return (
    <form className="stack" onSubmit={save}>
      <input className="input" maxLength={20} autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setEditing(false)}>취소</button>
        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={!name.trim()}>저장</button>
      </div>
    </form>
  )
}

/**
 * 게스트 → 정식 계정: 구글·카카오를 연결하거나 이메일·비밀번호를 정해요.
 * 같은 계정이 유지돼서 매장·기록이 그대로 이어져요.
 */
function GuestUpgrade() {
  const { refreshProfile } = useAuth()
  const [mode, setMode] = useState<'buttons' | 'email'>('buttons')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const link = async (provider: OAuthProvider) => {
    setError('')
    const { error } = await linkProvider(provider)
    // 성공하면 구글·카카오로 이동했다가 설정 화면으로 돌아와요
    if (error) setError(toKoreanError(error.message))
  }

  const linkEmail = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    // 게스트는 이메일 인증을 먼저 끝내야 비밀번호를 정할 수 있어요 (인증 링크 화면에서 정해요)
    const { data, error } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: emailRedirectTo() })
    setBusy(false)
    if (error) return setError(toKoreanError(error.message))
    await refreshProfile()
    setInfo(`${data.user?.new_email ?? email.trim()}(으)로 인증 메일을 보냈어요. 메일의 버튼을 누른 뒤 로그인에 쓸 비밀번호를 정하면 연결이 끝나요.`)
  }

  return (
    <section className="card stack guest-card">
      <div>
        <p className="list-name">계정을 연결해 주세요</p>
        <p className="hint">지금은 게스트라 이 기기에서만 쓸 수 있어요. 연결하면 다른 폰에서도 같은 매장·기록으로 이어서 써요.</p>
      </div>
      {info ? (
        <p className="alert alert-info" role="status">{info}</p>
      ) : mode === 'buttons' ? (
        <div className="stack">
          <button type="button" className="btn btn-block btn-kakao" onClick={() => link('kakao')}>카카오 계정 연결</button>
          <button type="button" className="btn btn-block btn-google" onClick={() => link('google')}>구글 계정 연결</button>
          <button type="button" className="btn btn-block btn-ghost" onClick={() => setMode('email')}>이메일로 연결</button>
        </div>
      ) : (
        <form className="form" onSubmit={linkEmail}>
          <label className="field">
            <span className="label">이메일</span>
            <input className="input" type="email" inputMode="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <p className="hint">이 주소로 인증 메일을 보내요. 메일의 버튼을 누르면 비밀번호를 정하는 화면이 열려요.</p>
          <div className="btn-row">
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setMode('buttons')}>뒤로</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy}>{busy ? '연결 중…' : '연결'}</button>
          </div>
        </form>
      )}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
    </section>
  )
}