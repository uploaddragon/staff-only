import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { ddayLabel, formatShort, isImminent, nextWorkDay, todaySeoul, weekdayOf } from '../lib/dates'
import { formatDays } from '../lib/days'
import { supabase, toKoreanError } from '../lib/supabase'
import { useTodayList } from '../lib/useTodayList'
import { useStore, type Membership } from '../store/StoreProvider'

/** 처리 화면에서 돌아올 때 넘겨받는 값 (되돌리기 안내용) */
export type ProcessedState = { processed?: { logId: string; name: string } }

/** "11월 4일 (수)" (서울 기준) */
function todayLabel() {
  const today = todaySeoul()
  return `${Number(today.slice(5, 7))}월 ${Number(today.slice(8, 10))}일 (${'일월화수목금토'[weekdayOf(today)]})`
}

/** "11/5(목)" */
const shortDay = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}(${'일월화수목금토'[weekdayOf(iso)]})`

export default function Home() {
  const { profile } = useAuth()
  const { active, loading, error } = useStore()
  const isWorkDay = !!active?.work_days.includes(weekdayOf(todaySeoul()))

  return (
    <main className="page">
      <div>
        <p className="page-sub">
          {todayLabel()}
          {isWorkDay && <> · <span className="badge">출근일</span></>}
        </p>
        <h1 className="page-title">{profile ? `${profile.display_name}님, 안녕하세요` : '안녕하세요'}</h1>
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {loading ? <p className="empty">불러오는 중…</p> : active ? <StoreHome key={active.store_id} store={active} /> : <Onboarding />}
    </main>
  )
}

function StoreHome({ store }: { store: Membership }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { items, myCategories, unassigned, error, loaded, reload } = useTodayList(store)
  const [pendingCount, setPendingCount] = useState(0)
  const [toast, setToast] = useState<ProcessedState['processed'] | null>(
    (location.state as ProcessedState | null)?.processed ?? null,
  )
  const [toastError, setToastError] = useState('')
  const isOwner = store.role === 'owner'
  const today = todaySeoul()
  const next = nextWorkDay(today, store.work_days)

  // 점주에게는 입장 요청이 있으면 배너로 알려줘요
  useEffect(() => {
    if (!isOwner) return
    supabase
      .from('store_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('store_id', store.store_id)
      .eq('status', 'pending')
      .then(({ count }) => setPendingCount(count ?? 0))
  }, [store.store_id, isOwner])

  // 되돌리기 안내는 10초 뒤 사라지고, 새로고침해도 다시 뜨지 않게 주소 상태를 지워요
  useEffect(() => {
    if (!toast) return
    navigate('.', { replace: true, state: null })
    const t = setTimeout(() => setToast(null), 10000)
    return () => clearTimeout(t)
  }, [toast, navigate])

  const undo = async () => {
    if (!toast) return
    const { error } = await supabase.rpc('undo_process', { p_log_id: toast.logId })
    setToast(null)
    if (error) setToastError(toKoreanError(error.message))
    reload()
  }

  return (
    <>
      {pendingCount > 0 && (
        <Link className="banner" to="/manage">
          <span>입장 요청 {pendingCount}건이 있어요</span>
          <span aria-hidden="true">›</span>
        </Link>
      )}
      {isOwner && unassigned.length > 0 && (
        <Link className="banner" to={`/shelf/${unassigned[0].id}/settings`}>
          <span>담당자 없는 매대: {unassigned.map((c) => c.name).join(', ')}</span>
          <span aria-hidden="true">›</span>
        </Link>
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{toast.name} 처리 완료</span>
          <button className="toast-action" onClick={undo}>되돌리기</button>
        </div>
      )}
      {toastError && <p className="alert alert-error" role="alert">{toastError}</p>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}

      <section className="card today-card">
        <div className="row">
          <div>
            <p className="label">오늘 뺄 상품</p>
            <p className="today-count">{loaded ? `${items.length}개` : '…'}</p>
          </div>
          <Link className="link" to="/history">히스토리</Link>
        </div>
        <p className="hint">
          {next
            ? `다음 근무 ${shortDay(next)} 전에 임박하는 상품까지 미리 보여줘요`
            : '근무 요일을 설정하면 쉬는 날 임박하는 상품도 미리 챙겨드려요'}
          {!next && !isOwner && <> · <Link className="link" to="/settings">설정</Link></>}
        </p>
      </section>

      {loaded && (
        items.length > 0 ? (
          <section className="card card-list">
            {items.map(({ product, category, zoneName }) => {
              const overdue = isImminent(product.earliest_expiry!, category.warn_days, today)
              return (
                <button key={product.id} className={`product-row${overdue ? ' imminent' : ''}`}
                  onClick={() => navigate(`/process/${product.id}`)}>
                  <span className="zone-chip">{zoneName}</span>
                  <span className="product-name">
                    {product.name}
                    {myCategories.length > 1 && <span className="product-sub">{category.name}</span>}
                  </span>
                  <span className="product-date">
                    <span>{formatShort(product.earliest_expiry!)}</span>
                    <span className="dday">{ddayLabel(product.earliest_expiry!, today)}</span>
                  </span>
                  <span className="chevron" aria-hidden="true">›</span>
                </button>
              )
            })}
          </section>
        ) : (
          <section className="card">
            <p className="empty">
              {myCategories.length === 0
                ? isOwner ? '아직 매대가 없어요. 매대 탭에서 만들어 주세요.' : '내가 담당하는 매대가 없어요. 점주에게 담당 지정을 요청해 주세요.'
                : '오늘 뺄 상품이 없어요 👍'}
            </p>
          </section>
        )
      )}

      {!isOwner && (
        <p className="hint center">근무 {formatDays(store.work_days)} · {store.store_name}</p>
      )}
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
