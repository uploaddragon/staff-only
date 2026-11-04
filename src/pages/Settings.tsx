import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { WEEK_DAYS } from '../lib/days'
import { supabase, toKoreanError } from '../lib/supabase'
import { useStore } from '../store/StoreProvider'

export default function Settings() {
  const { session, profile, signOut } = useAuth()
  const { memberships, active, isOwner, refresh, selectStore } = useStore()
  const approved = memberships.filter((m) => m.status === 'approved')

  return (
    <main className="page">
      <h1 className="page-title">설정</h1>

      <section className="card">
        <p style={{ fontWeight: 600, minHeight: '1.5em' }}>{profile?.display_name}</p>
        <p className="muted">{session?.user.email}</p>
      </section>

      {active && (
        <section className="card stack">
          <div className="row">
            <div>
              <p className="muted">{isOwner ? '점주' : '직원'}</p>
              <p className="list-name" style={{ fontSize: 'var(--text-lg)' }}>{active.store_name}</p>
            </div>
            {isOwner && <Link className="btn btn-primary btn-sm btn-link" to="/manage">매장 관리</Link>}
          </div>
          <WorkDays key={active.store_id} storeId={active.store_id} initial={active.work_days} onSaved={refresh} />
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

      <div className="btn-row">
        <Link className="btn btn-ghost btn-link" style={{ flex: 1, fontSize: 'var(--text-md)' }} to="/join">다른 매장 입장</Link>
        <Link className="btn btn-ghost btn-link" style={{ flex: 1, fontSize: 'var(--text-md)' }} to="/store/new">새 매장 만들기</Link>
      </div>

      <button className="btn btn-ghost btn-block" onClick={signOut}>로그아웃</button>
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
        <p className="label">내 근무 요일</p>
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
