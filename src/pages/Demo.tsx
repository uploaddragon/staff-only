import { useCallback, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import Icon from '../components/Icon'
import { tabs } from '../components/TabBar'
import Tour, { type TourStep } from '../components/Tour'
import { PageLoading, SectionHeader } from '../components/States'
import { addDays, ddayLabel, formatShort, todaySeoul, weekdayOf } from '../lib/dates'
import { useStore } from '../store/StoreProvider'
import { ProgressRing, Stat } from './Home'

/**
 * 체험 매장: 가입 직후(점주·알바를 고른 뒤) 진짜 매장에 들어가기 전에,
 * 가짜 데이터로 채운 실제와 같은 화면 위에서 주요 버튼을 하나씩 짚어 설명해요.
 * 아무것도 저장하지 않아요. 끝나면 매장 만들기·초대코드 입장으로 가요.
 * /demo?role=owner|staff (설정의 "화면 안내 다시 보기"는 &from=settings)
 */
type Role = 'owner' | 'staff'
type View = 'home' | 'process'
type DemoStep = Omit<TourStep, 'onEnter'> & { view: View }

const WEEK = '일월화수목금토'
const shortDay = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}(${WEEK[weekdayOf(iso)]})`

const STAFF_STEPS: DemoStep[] = [
  { view: 'home', target: 'summary', title: '오늘 할 일 한눈에', desc: '출근하면 여기부터 봐요. 오늘 뺄 상품, 기간 지난 상품, 아직 확인 안 한 필독 공지 수예요. 동그라미는 처리한 만큼 채워져요.' },
  { view: 'home', target: 'today', title: '오늘 뺄 상품', desc: '내가 맡은 매대에서 다음 출근 전에 임박하는 상품만 모아 보여줘요. 하나를 눌러 볼게요.' },
  { view: 'process', target: 'actions', title: '어떻게 처리했나요?', desc: '할인 스티커를 붙여 뺐으면 "빼두기 완료", 빼기 전에 다 팔렸으면 "판매 완료"를 골라요.' },
  { view: 'process', target: 'date', title: '남은 것 중 가장 빠른 날짜', desc: '매대에 남은 상품 중 가장 빠른 유통기한을 6자리로 넣어요. 261215처럼요. 다 떨어졌으면 "재고 없음"을 눌러요.' },
  { view: 'process', target: 'submit', title: '처리 완료!', desc: '이걸로 끝이에요. 15초면 돼요. 잘못 눌렀으면 홈에 뜨는 "되돌리기"로 바로 취소할 수 있어요.' },
  { view: 'home', target: 'history', title: '처리 히스토리', desc: '누가 언제 어떤 상품을 처리했는지 남아서 인수인계가 쉬워요.' },
  { view: 'home', target: 'tab-shelf', title: '매대', desc: '담당 매대의 상품과 날짜를 전부 보고, 새로 들어온 상품을 등록해요.' },
  { view: 'home', target: 'tab-notices', title: '공지', desc: '필독 공지는 "확인했어요"를 누를 때까지 홈 위쪽에 남아요.' },
  { view: 'home', target: 'tab-settings', title: '근무 요일', desc: '설정에서 근무 요일을 정하면, 쉬는 날 임박하는 상품도 그 전 출근일에 미리 보여줘요. 이제 초대코드로 진짜 매장에 들어가 볼까요?' },
]

const OWNER_STEPS: DemoStep[] = [
  { view: 'home', target: 'summary', title: '오늘 매장 현황', desc: '모든 매대에서 오늘 뺄 상품, 기간 지난 상품, 직원 입장 요청 수예요.' },
  { view: 'home', target: 'today', title: '오늘 뺄 상품', desc: '담당 직원 홈에도 똑같이 떠요. 점주도 눌러서 바로 처리할 수 있어요. 하나를 눌러 볼게요.' },
  { view: 'process', target: 'actions', title: '처리 방법 고르기', desc: '"빼두기 완료"(할인 스티커 붙여 뺌) 또는 "판매 완료"(빼기 전에 다 팔림). 기간이 지난 상품이면 "폐기"도 고를 수 있어요.' },
  { view: 'process', target: 'date', title: '다음 날짜 6자리', desc: '남은 상품 중 가장 빠른 유통기한을 넣으면, 그 날짜가 다가올 때 다시 알려줘요.' },
  { view: 'home', target: 'shelves', title: '매대', desc: '"봉지라면"처럼 매대를 만들고 A~D 구역으로 나눠요. 매대마다 담당 직원과 임박 기준일(예: 3일 전)을 정해요.' },
  { view: 'home', target: 'tab-shelf', title: '매대 만들기 · 상품 등록', desc: '여기서 새 매대를 만들고, 상품 이름과 가장 빠른 날짜 6자리로 등록해요.' },
  { view: 'home', target: 'tab-notices', title: '공지', desc: '꼭 알아야 할 내용은 필독으로 올리세요. 직원 중 누가 확인했는지 볼 수 있어요.' },
  { view: 'home', target: 'manage', title: '매장 관리', desc: '초대코드 확인, 직원 입장 승인, 매대별 임박 현황, 처리 기록을 여기서 봐요. 이제 진짜 매장을 만들어 볼까요?' },
]

export default function Demo() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { session, loading, profile } = useAuth()
  const { memberships } = useStore()
  const [view, setView] = useState<View>('home')
  const param = params.get('role')
  const role: Role = param === 'owner' || param === 'staff' ? param : profile?.user_type === 'owner' ? 'owner' : 'staff'
  const fromSettings = params.get('from') === 'settings'

  const steps: TourStep[] = useMemo(
    () => (role === 'owner' ? OWNER_STEPS : STAFF_STEPS).map(({ view: v, ...s }) => ({ ...s, onEnter: () => setView(v) })),
    [role],
  )

  // 끝나면: 설정에서 왔으면 설정으로, 아직 매장이 없으면 역할에 맞는 첫 화면(매장 만들기·초대코드 입장)으로
  const hasStore = memberships.some((m) => m.status !== 'rejected')
  const finish = useCallback(() => {
    if (fromSettings) return navigate('/settings', { replace: true })
    navigate(hasStore ? '/' : role === 'owner' ? '/store/new' : '/join', { replace: true })
  }, [navigate, fromSettings, hasStore, role])

  if (loading) return <PageLoading />
  if (!session) return <Navigate to="/login" replace />

  return (
    <>
      <div className="demo-banner" role="status">
        <span><b>체험 매장</b> · 예시 화면이라 저장되지 않아요</span>
        <button type="button" onClick={finish}>나가기</button>
      </div>
      {view === 'home' ? <DemoHome role={role} onOpen={() => setView('process')} /> : <DemoProcess onBack={() => setView('home')} />}
      <nav className="tabbar" aria-label="하단 메뉴 (예시)">
        {tabs.map((t) => (
          <span key={t.to} className={`tab${t.to === '/' ? ' active' : ''}`} data-tour={`tab-${t.to === '/' ? 'home' : t.to.slice(1)}`}>
            <span className="tab-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {t.icon}
              </svg>
            </span>
            {t.label}
          </span>
        ))}
      </nav>
      <Tour steps={steps} onClose={finish} doneLabel={fromSettings ? '닫기' : hasStore ? '시작하기' : role === 'owner' ? '매장 만들러 가기' : '매장 들어가기'} />
    </>
  )
}

/** 예시 상품 (오늘 기준으로 날짜를 만들어요) */
function useSample() {
  const today = todaySeoul()
  return {
    today,
    items: [
      { zone: 'A', name: '신라면', date: addDays(today, 2) },
      { zone: 'C', name: '너구리', date: addDays(today, 3) },
    ],
    upcoming: addDays(today, 5),
  }
}

function DemoHome({ role, onOpen }: { role: Role; onOpen: () => void }) {
  const { profile } = useAuth()
  const { today, items, upcoming } = useSample()
  const isOwner = role === 'owner'
  const name = profile?.display_name ?? (isOwner ? '점주' : '알바')

  return (
    <main className="page page-home">
      <header className="hero">
        <div className="hero-top">
          <p className="hero-date">
            {Number(today.slice(5, 7))}월 {Number(today.slice(8, 10))}일 ({WEEK[weekdayOf(today)]})
            {!isOwner && <span className="hero-chip">출근일</span>}
          </p>
        </div>
        <h1 className="hero-title">{name}님, 안녕하세요</h1>
        <div className="store-switcher store-switcher-hero"><select disabled><option>○○마트 ○○점 · {isOwner ? '점주' : '직원'}</option></select></div>
        <div className="hero-summary" data-tour="summary">
          <ProgressRing done={1} total={3} loaded />
          <div className="hero-stats">
            <Stat label="오늘 뺄 상품" value={items.length} />
            <Stat label="기간 지남" value={0} />
            {isOwner ? <Stat label="입장 요청" value={1} alert /> : <Stat label="필독 공지" value={1} alert />}
          </div>
        </div>
        <p className="hero-caption">
          {isOwner ? '모든 매대에서 오늘까지 임박한 상품이에요' : `다음 근무 ${shortDay(addDays(today, 2))} 전에 임박하는 상품까지 챙겼어요`}
        </p>
      </header>

      {!isOwner && (
        <div className="banner banner-required">
          <span><span className="badge badge-danger">필독</span> 금요일 라면 재고 정리</span>
          <span aria-hidden="true">확인 ›</span>
        </div>
      )}
      {isOwner && (
        <div className="banner"><span>입장 요청 1건이 있어요</span><span aria-hidden="true">›</span></div>
      )}

      <section className="home-section" data-tour="today">
        <SectionHeader icon="box" title={<>오늘 뺄 상품 <span className="count">{items.length}</span></>}
          right={<span className="link-sub" data-tour="history"><Icon name="history" size={16} /> 히스토리</span>} />
        <div className="card card-list">
          {items.map((it) => (
            <button key={it.name} type="button" className="product-row imminent" onClick={onOpen}>
              <span className="zone-chip">{it.zone}</span>
              <span className="product-name">{it.name}</span>
              <span className="product-date"><span>{formatShort(it.date)}</span><span className="dday">{ddayLabel(it.date, today)}</span></span>
              <Icon name="chevronRight" size={18} className="chevron-icon" />
            </button>
          ))}
        </div>
      </section>

      <section className="home-section">
        <SectionHeader icon="calendar" title="다가오는 임박" right={<span className="hint">7일 안</span>} />
        <div className="card timeline">
          <div className="timeline-day">
            <div className="timeline-date"><span className="timeline-dot" aria-hidden="true" /><b>{shortDay(upcoming)}</b></div>
            <ul className="timeline-items">
              <li><span className="zone-chip zone-chip-sm">B</span><span className="timeline-name">안성탕면</span><span className="timeline-exp">{formatShort(addDays(upcoming, 3))}</span></li>
            </ul>
          </div>
        </div>
      </section>

      <section className="home-section" data-tour="shelves">
        <SectionHeader icon="shelf" title={isOwner ? '매대' : '내 담당 매대'} right={<span className="link-sub">전체 ›</span>} />
        <div className="shelf-cards">
          <div className="shelf-mini">
            <div className="row"><span className="shelf-mini-name">봉지라면</span><span className="badge badge-danger">임박 2</span></div>
            <p className="shelf-mini-meta">상품 12개 · 기준 3일</p>
          </div>
          {isOwner && (
            <div className="shelf-mini">
              <div className="row"><span className="shelf-mini-name">컵라면</span></div>
              <p className="shelf-mini-meta">상품 8개 · 기준 3일</p>
            </div>
          )}
        </div>
      </section>

      {isOwner && (
        <div className="choice choice-row" data-tour="manage">
          <span className="choice-icon"><Icon name="users" /></span>
          <span style={{ flex: 1 }}>
            <span className="choice-title">매장 관리</span>
            <span className="choice-desc">임박 현황, 처리 기록, 필독 확인, 직원 관리</span>
          </span>
          <Icon name="chevronRight" size={18} className="chevron-icon" />
        </div>
      )}
    </main>
  )
}

function DemoProcess({ onBack }: { onBack: () => void }) {
  const { today, items } = useSample()
  const it = items[0]
  return (
    <main className="page">
      <button type="button" className="back back-button" onClick={onBack}>← 홈</button>
      <section className="card stack">
        <p className="muted">봉지라면 · {it.zone} 구역</p>
        <h1 className="page-title">{it.name}</h1>
        <div className="record">
          <div>
            <p className="label">현재 기록</p>
            <p className="record-date">{formatShort(it.date)} <span className="dday">{ddayLabel(it.date, today)}</span></p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="label">임박일</p>
            <p className="record-sub">{formatShort(addDays(it.date, -3))}</p>
          </div>
        </div>
      </section>

      <div className="action-row" data-tour="actions">
        <div className="check-card on">
          <span className="check-box" aria-hidden="true">✓</span>
          <span><span className="check-title">빼두기 완료</span><span className="check-desc">할인 스티커 붙여 뺐어요</span></span>
        </div>
        <div className="check-card">
          <span className="check-box" aria-hidden="true" />
          <span><span className="check-title">판매 완료</span><span className="check-desc">빼기 전에 다 팔렸어요</span></span>
        </div>
      </div>

      <section className="card form" data-tour="date">
        <div className="btn-row">
          <button type="button" tabIndex={-1} className="btn btn-sm btn-primary" style={{ flex: 1 }}>다음 날짜 입력</button>
          <button type="button" tabIndex={-1} className="btn btn-sm btn-ghost" style={{ flex: 1 }}>재고 없음</button>
        </div>
        <div className="field">
          <span className="label">남은 상품 중 가장 빠른 유통기한</span>
          <div className="input input-date mock-input">{formatShort(addDays(today, 18)).replace(/\./g, '')}</div>
        </div>
      </section>

      <button type="button" tabIndex={-1} className="btn btn-primary btn-block" data-tour="submit">처리 완료</button>
    </main>
  )
}
