import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import Icon from '../components/Icon'
import { EmptyState, SectionHeader, Skeleton } from '../components/States'
import StoreSwitcher from '../components/StoreSwitcher'
import { ddayLabel, formatShort, isImminent, nextWorkDay, todaySeoul, weekdayOf } from '../lib/dates'
import { formatDays } from '../lib/days'
import { supabase, toKoreanError } from '../lib/supabase'
import { useNotices } from '../lib/useNotices'
import { useTodayList, type DueItem, type ShelfCard } from '../lib/useTodayList'
import { useStore, type Membership } from '../store/StoreProvider'

/** 처리 화면에서 돌아올 때 넘겨받는 값 (되돌리기 안내용) */
export type ProcessedState = { processed?: { logId: string; name: string } }

const WEEK = '일월화수목금토'

/** "11월 4일 (수)" (서울 기준) */
function todayLabel() {
  const today = todaySeoul()
  return `${Number(today.slice(5, 7))}월 ${Number(today.slice(8, 10))}일 (${WEEK[weekdayOf(today)]})`
}

/** "11/5(목)" */
const shortDay = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}(${WEEK[weekdayOf(iso)]})`

export default function Home() {
  const { profile } = useAuth()
  const { active, loading, error } = useStore()
  const greeting = profile ? `${profile.display_name}님, 안녕하세요` : '안녕하세요'

  if (loading) {
    return (
      <main className="page page-home">
        <header className="hero"><p className="hero-date">{todayLabel()}</p><h1 className="hero-title">{greeting}</h1></header>
        <Skeleton />
      </main>
    )
  }

  if (!active) {
    return (
      <main className="page">
        <div>
          <p className="page-sub">{todayLabel()}</p>
          <h1 className="page-title">{greeting}</h1>
        </div>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <GuestBanner />
        <Onboarding />
      </main>
    )
  }

  return <StoreHome key={active.store_id} store={active} greeting={greeting} />
}

function StoreHome({ store, greeting }: { store: Membership; greeting: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { items, expired, upcoming, shelves, processedToday, myCategories, unassigned, error, loaded, reload } = useTodayList(store)
  // 필독 공지: 직원이 '확인했어요'를 누를 때까지 홈에 배너로 남아요
  const { notices } = useNotices(store.role === 'staff' ? store.store_id : undefined)
  const unreadRequired = notices.filter((n) => n.is_required && !n.readByMe)
  const [pendingCount, setPendingCount] = useState(0)
  const [toast, setToast] = useState<ProcessedState['processed'] | null>(
    (location.state as ProcessedState | null)?.processed ?? null,
  )
  const [toastError, setToastError] = useState('')
  const isOwner = store.role === 'owner'
  const today = todaySeoul()
  const next = isOwner ? null : nextWorkDay(today, store.work_days)
  const isWorkDay = !isOwner && store.work_days.includes(weekdayOf(today))
  const remaining = items.length + expired.length

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

  const row = ({ product, category, zoneName }: DueItem, tone: 'imminent' | 'expired' | '') => (
    <button key={product.id} className={`product-row${tone ? ` ${tone}` : ''}`}
      onClick={() => navigate(`/process/${product.id}`)}>
      <span className="zone-chip">{zoneName}</span>
      <span className="product-name">
        {product.name}
        {(myCategories.length > 1 || product.memo) && (
          <span className="product-sub">
            {myCategories.length > 1 && category.name}
            {myCategories.length > 1 && product.memo && ' · '}
            {product.memo && `📝 ${product.memo}`}
          </span>
        )}
      </span>
      <span className="product-date">
        <span>{formatShort(product.earliest_expiry!)}</span>
        <span className="dday">{ddayLabel(product.earliest_expiry!, today)}</span>
      </span>
      <Icon name="chevronRight" size={18} className="chevron-icon" />
    </button>
  )

  const firstUpcoming = upcoming[0]

  return (
    <main className="page page-home">
      {/* ── 상단 요약 ── */}
      <header className="hero">
        <div className="hero-top">
          <p className="hero-date">
            {todayLabel()}
            {isWorkDay && <span className="hero-chip">출근일</span>}
          </p>
        </div>
        <h1 className="hero-title">{greeting}</h1>
        <StoreSwitcher variant="hero" />

        <div className="hero-summary">
          <ProgressRing done={processedToday} total={processedToday + remaining} loaded={loaded} />
          <div className="hero-stats">
            <Stat label="오늘 뺄 상품" value={loaded ? items.length : '–'} />
            <Stat label="기간 지남" value={loaded ? expired.length : '–'} alert={expired.length > 0} />
            {isOwner
              ? <Stat label="입장 요청" value={pendingCount} alert={pendingCount > 0} />
              : <Stat label="필독 공지" value={unreadRequired.length} alert={unreadRequired.length > 0} />}
          </div>
        </div>
        <p className="hero-caption">
          {isOwner
            ? '모든 매대에서 오늘까지 임박한 상품이에요'
            : next
              ? `다음 근무 ${shortDay(next)} 전에 임박하는 상품까지 챙겼어요`
              : <>근무 요일을 정하면 쉬는 날 임박하는 상품도 챙겨요 · <Link to="/settings">설정</Link></>}
        </p>
      </header>

      {/* ── 알림 ── */}
      {toast && (
        <div className="toast toast-success" role="status">
          <span className="toast-check" aria-hidden="true"><Icon name="check" size={18} /></span>
          <span className="toast-text">{toast.name} 처리 완료 · 오늘 {processedToday}개째</span>
          <button className="toast-action" onClick={undo}>되돌리기</button>
        </div>
      )}
      {toastError && <p className="alert alert-error" role="alert">{toastError}</p>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}

      <GuestBanner />
      {unreadRequired.map((n) => (
        <Link key={n.id} className="banner banner-required" to={`/notices/${n.id}`}>
          <span><span className="badge badge-danger">필독</span> {n.title}</span>
          <span aria-hidden="true">확인 ›</span>
        </Link>
      ))}
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

      {!loaded ? <Skeleton header={false} /> : (
        <>
          {/* ── 기간 지난 상품: 처리했는지 먼저 물어봐요 ── */}
          {expired.length > 0 && (
            <section className="card expired-card">
              <SectionHeader icon="alert" title={`유통기한이 지난 상품 ${expired.length}개`} />
              <p className="hint">빼뒀는지, 폐기했는지, 재고가 없는지 알려주세요.</p>
              <div className="card-list" style={{ padding: 0, marginTop: 8 }}>
                {expired.map((item) => row(item, 'expired'))}
              </div>
            </section>
          )}

          {/* ── 오늘 뺄 상품 ── */}
          <section className="home-section">
            <SectionHeader icon="box" title={<>오늘 뺄 상품 <span className="count">{items.length}</span></>}
              right={<Link className="link-sub" to="/history"><Icon name="history" size={16} /> 히스토리</Link>} />
            {items.length > 0 ? (
              <div className="card card-list">
                {items.map((item) => row(item, isImminent(item.product.earliest_expiry!, item.category.warn_days, today) ? 'imminent' : ''))}
              </div>
            ) : myCategories.length === 0 ? (
              <EmptyState icon="shelf" title={isOwner ? '아직 매대가 없어요' : '내가 담당하는 매대가 없어요'}
                desc={isOwner ? '봉지라면처럼 관리할 매대를 만들어 주세요.' : '점주에게 담당 지정을 요청해 주세요.'}
                action={isOwner && <Link className="btn btn-primary btn-sm btn-link" to="/shelf/new">매대 만들기</Link>} />
            ) : (
              <EmptyState tone="good" icon="checkCircle"
                title={processedToday > 0 ? `오늘 ${processedToday}개 처리 완료!` : '오늘 뺄 상품이 없어요'}
                desc={firstUpcoming
                  ? <>다음 빼는 날은 <b>{shortDay(firstUpcoming.date)}</b> · {firstUpcoming.items[0].product.name}{firstUpcoming.items.length > 1 ? ` 외 ${firstUpcoming.items.length - 1}개` : ''}</>
                  : '앞으로 7일 안에 임박하는 상품도 없어요.'} />
            )}
          </section>

          {/* ── 다가오는 임박 (7일) ── */}
          {upcoming.length > 0 && (
            <section className="home-section">
              <SectionHeader icon="calendar" title="다가오는 임박" right={<span className="hint">7일 안</span>} />
              <div className="card timeline">
                {upcoming.map((day) => {
                  const workday = !isOwner && store.work_days.includes(weekdayOf(day.date))
                  return (
                    <div key={day.date} className="timeline-day">
                      <div className="timeline-date">
                        <span className="timeline-dot" aria-hidden="true" />
                        <b>{shortDay(day.date)}</b>
                        {workday && <span className="badge">출근</span>}
                      </div>
                      <ul className="timeline-items">
                        {day.items.map(({ product, zoneName }) => (
                          <li key={product.id}>
                            <span className="zone-chip zone-chip-sm">{zoneName}</span>
                            <span className="timeline-name">{product.name}</span>
                            <span className="timeline-exp">{formatShort(product.earliest_expiry!)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── 내 매대 ── */}
          {shelves.length > 0 && (
            <section className="home-section">
              <SectionHeader icon="shelf" title={isOwner ? '매대' : '내 담당 매대'}
                right={<Link className="link-sub" to="/shelf">전체 ›</Link>} />
              <div className="shelf-cards">
                {shelves.map((s) => <ShelfMini key={s.category.id} shelf={s} />)}
              </div>
            </section>
          )}

          {isOwner && (
            <Link className="choice choice-row" to="/manage">
              <span className="choice-icon"><Icon name="users" /></span>
              <span style={{ flex: 1 }}>
                <span className="choice-title">매장 관리</span>
                <span className="choice-desc">임박 현황, 처리 기록, 필독 확인, 직원 관리</span>
              </span>
              <Icon name="chevronRight" size={18} className="chevron-icon" />
            </Link>
          )}
          {!isOwner && <p className="hint center">이 매장 근무 {formatDays(store.work_days)}</p>}
        </>
      )}
    </main>
  )
}

/** 게스트에게: 계정을 연결해야 다른 기기에서도 이어서 쓸 수 있어요 */
function GuestBanner() {
  const { session } = useAuth()
  if (!session?.user.is_anonymous) return null
  return (
    <Link className="banner banner-guest" to="/settings">
      <span>게스트로 사용 중 · 계정을 연결하면 다른 폰에서도 이어서 써요</span>
      <span aria-hidden="true">연결 ›</span>
    </Link>
  )
}

/** 오늘 처리 진행 링: 처리한 개수 / (처리한 개수 + 남은 개수) */
export function ProgressRing({ done, total, loaded }: { done: number; total: number; loaded: boolean }) {
  const r = 30
  const c = 2 * Math.PI * r
  const ratio = total === 0 ? 1 : done / total
  const allDone = loaded && done === total
  return (
    <div className="ring" role="img" aria-label={loaded ? `오늘 처리 ${done}/${total}` : '불러오는 중'}>
      <svg viewBox="0 0 72 72" width="76" height="76">
        <circle cx="36" cy="36" r={r} className="ring-track" />
        <circle cx="36" cy="36" r={r} className="ring-bar" strokeDasharray={c}
          strokeDashoffset={loaded ? c * (1 - ratio) : c} transform="rotate(-90 36 36)" />
      </svg>
      <span className="ring-label">
        {!loaded ? '' : allDone ? <Icon name="check" size={26} /> : <><b>{done}</b>/{total}</>}
      </span>
      <span className="ring-caption">오늘 처리</span>
    </div>
  )
}

export function Stat({ label, value, alert }: { label: string; value: number | string; alert?: boolean }) {
  return (
    <div className={`stat${alert ? ' stat-alert' : ''}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

/** 매대 한눈에 보기 카드 */
function ShelfMini({ shelf }: { shelf: ShelfCard }) {
  const { category, inStock, outOfStock, imminent, zonesDone, zones } = shelf
  const setup = zones > 0 && zonesDone < zones
  return (
    <Link className="shelf-mini" to={`/shelf/${category.id}`}>
      <div className="row">
        <span className="shelf-mini-name">{category.name}</span>
        {imminent > 0 && <span className="badge badge-danger">임박 {imminent}</span>}
      </div>
      <p className="shelf-mini-meta">
        상품 {inStock}개{outOfStock > 0 && ` · 재고 없음 ${outOfStock}`} · 기준 {category.warn_days}일
      </p>
      {setup && (
        <div className="shelf-mini-setup">
          <div className="progress"><div style={{ width: `${(zonesDone / zones) * 100}%` }} /></div>
          <span>첫 등록 {zonesDone}/{zones}</span>
        </div>
      )}
    </Link>
  )
}

/** 아직 승인된 매장이 없을 때: 대기 중/거절된 요청 + 만들기·입장 (가입 유형에 맞는 쪽을 먼저) */
function Onboarding() {
  const { profile } = useAuth()
  const { memberships, refresh } = useStore()
  const [error, setError] = useState('')
  const pending = memberships.filter((m) => m.status === 'pending')
  const rejected = memberships.filter((m) => m.status === 'rejected')
  const isOwnerType = profile?.user_type === 'owner'

  const cancel = async (storeId: string) => {
    const { error } = await supabase.rpc('cancel_join_request', { p_store_id: storeId })
    if (error) setError(toKoreanError(error.message))
    await refresh()
  }

  const join = (
    <Link key="join" className="choice choice-row" to="/join">
      <span className="choice-icon"><Icon name="store" /></span>
      <span style={{ flex: 1 }}>
        <span className="choice-title">초대코드로 입장하기</span>
        <span className="choice-desc">점주에게 받은 6자리 코드를 입력하세요</span>
      </span>
      <Icon name="chevronRight" size={18} className="chevron-icon" />
    </Link>
  )
  const create = (
    <Link key="create" className="choice choice-row" to="/store/new">
      <span className="choice-icon"><Icon name="sparkle" /></span>
      <span style={{ flex: 1 }}>
        <span className="choice-title">매장 만들기</span>
        <span className="choice-desc">매장을 만들고 직원에게 초대코드를 알려주세요</span>
      </span>
      <Icon name="chevronRight" size={18} className="chevron-icon" />
    </Link>
  )

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
          <EmptyState icon="store" title="아직 들어간 매장이 없어요" desc="매장에 들어가면 오늘 뺄 상품과 공지를 여기서 볼 수 있어요." />
          {isOwnerType ? [create, join] : [join, create]}
        </>
      )}
    </>
  )
}
