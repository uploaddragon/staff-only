import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { formatDays } from '../lib/days'
import { supabase, toKoreanError } from '../lib/supabase'
import { useStore, type Membership } from '../store/StoreProvider'

/** 오늘 날짜를 서울 기준으로 "11월 4일 (수)" 형태로 보여줘요 */
function todayLabel() {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short',
  }).format(new Date())
}

/** 서울 기준 오늘 요일 (0=일 … 6=토) */
function todayWeekday() {
  const short = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(new Date())
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(short)
}

export default function Home() {
  const { profile } = useAuth()
  const { active, loading, error } = useStore()

  return (
    <main className="page">
      <div>
        <p className="page-sub">
          {todayLabel()}
          {active?.work_days.includes(todayWeekday()) && <> · <span className="badge">출근일</span></>}
        </p>
        <h1 className="page-title">{profile ? `${profile.display_name}님, 안녕하세요` : '안녕하세요'}</h1>
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {loading ? <p className="empty">불러오는 중…</p> : active ? <StoreHome store={active} /> : <Onboarding />}
    </main>
  )
}

function StoreHome({ store }: { store: Membership }) {
  const [pendingCount, setPendingCount] = useState(0)

  // 점주에게는 입장 요청이 있으면 배너로 알려줘요
  useEffect(() => {
    if (store.role !== 'owner') return
    supabase
      .from('store_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('store_id', store.store_id)
      .eq('status', 'pending')
      .then(({ count }) => setPendingCount(count ?? 0))
  }, [store])

  return (
    <>
      {pendingCount > 0 && (
        <Link className="banner" to="/manage">
          <span>입장 요청 {pendingCount}건이 있어요</span>
          <span aria-hidden="true">›</span>
        </Link>
      )}
      <section className="card">
        <p className="muted">{store.role === 'owner' ? '점주' : '직원'}</p>
        <p className="list-name" style={{ fontSize: 'var(--text-lg)' }}>{store.store_name}</p>
        {store.role === 'staff' && (
          <p className="list-meta">
            근무 {formatDays(store.work_days)}
            {store.work_days.length === 0 && <> · <Link className="link" to="/settings">설정하기</Link></>}
          </p>
        )}
      </section>
      <section className="card">
        <p className="empty">오늘 뺄 상품은 4단계에서 만들어요.</p>
      </section>
    </>
  )
}

/** 아직 승인된 매장이 없을 때: 대기 중/거절된 요청 + 만들기·입장 선택 */
function Onboarding() {
  const { memberships, refresh } = useStore()
  const [error, setError] = useState('')
  const pending = memberships.filter((m) => m.status === 'pending')
  const rejected = memberships.filter((m) => m.status === 'rejected')

  const cancel = async (storeId: string) => {
    const { error } = await supabase.rpc('cancel_join_request', { p_store_id: storeId })
    if (error) setError(toKoreanError(error.message))
    await refresh()
  }

  return (
    <>
      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {pending.map((m) => (
        <section className="card stack" key={m.store_id}>
          <span className="badge" style={{ alignSelf: 'flex-start' }}>승인 대기 중</span>
          <p className="list-name" style={{ fontSize: 'var(--text-lg)' }}>{m.store_name}</p>
          <p className="muted">점주가 승인하면 바로 들어갈 수 있어요.</p>
          <div className="btn-row">
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => cancel(m.store_id)}>요청 취소</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={refresh}>새로고침</button>
          </div>
        </section>
      ))}

      {rejected.map((m) => (
        <p className="alert alert-error" key={m.store_id}>
          {m.store_name} 입장 요청이 거절됐어요. 점주에게 확인한 뒤 다시 요청할 수 있어요.
        </p>
      ))}

      {pending.length === 0 && (
        <>
          <Link className="choice" to="/join">
            <p className="choice-title">초대코드로 입장하기</p>
            <p className="choice-desc">알바·직원이라면 점주에게 받은 6자리 코드를 입력하세요</p>
          </Link>
          <Link className="choice" to="/store/new">
            <p className="choice-title">매장 만들기</p>
            <p className="choice-desc">점주라면 매장을 만들고 초대코드를 받으세요</p>
          </Link>
        </>
      )}
    </>
  )
}
