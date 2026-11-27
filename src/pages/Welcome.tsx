import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import GuestStart from '../components/GuestStart'
import { markIntroSeen } from '../lib/intro'

type Slide = { title: string; desc: string; mock: ReactNode }

/** 실제 앱 화면을 작게 그린 그림 (설명용이라 누를 수 없어요) */
function Mock({ children }: { children: ReactNode }) {
  return <div className="mock" aria-hidden="true">{children}</div>
}

const MockRow = ({ zone, name, date, dday, tone = '' }: { zone: string; name: string; date: string; dday: string; tone?: string }) => (
  <div className={`product-row ${tone}`}>
    <span className="zone-chip">{zone}</span>
    <span className="product-name">{name}</span>
    <span className="product-date"><span>{date}</span><span className="dday">{dday}</span></span>
  </div>
)

const SLIDES: Slide[] = [
  {
    title: '출근하면\n오늘 뺄 상품부터',
    desc: '유통기한이 임박한 상품을 내 근무일에 맞춰 모아 보여줘요. 쉬는 날 임박하는 상품도 미리 챙겨요.',
    mock: (
      <Mock>
        <div className="card today-card">
          <p className="label">오늘 뺄 상품</p>
          <p className="today-count">3개</p>
        </div>
        <div className="card card-list">
          <MockRow zone="A" name="신라면" date="26.12.03" dday="D-29" tone="imminent" />
          <MockRow zone="A" name="너구리" date="26.12.04" dday="D-30" tone="imminent" />
          <MockRow zone="B" name="안성탕면" date="26.12.05" dday="D-31" />
        </div>
      </Mock>
    ),
  },
  {
    title: '처리는\n15초면 끝',
    desc: '빼두기 완료를 누르고, 남은 것 중 가장 빠른 날짜 6자리만 입력하면 돼요. 기록은 히스토리로 남아 인수인계도 쉬워요.',
    mock: (
      <Mock>
        <div className="check-card on">
          <span className="check-box">✓</span>
          <span><span className="check-title">빼두기 완료</span><span className="check-desc">할인 스티커를 붙이고 따로 빼 뒀어요</span></span>
        </div>
        <div className="card stack">
          <span className="label">남은 상품 중 가장 빠른 유통기한</span>
          <div className="input input-date mock-input">261215</div>
          <span className="hint hint-ok">2026년 12월 15일 (화)</span>
        </div>
        <div className="btn btn-primary btn-block mock-btn">처리 완료</div>
      </Mock>
    ),
  },
  {
    title: '필독 공지는\n확인할 때까지',
    desc: '점주의 필독 공지는 "확인했어요"를 누를 때까지 홈에 남아요. 점주는 누가 확인했는지 바로 알 수 있어요.',
    mock: (
      <Mock>
        <div className="banner banner-required"><span><span className="badge badge-danger">필독</span> 금요일 라면 재고 정리</span><span>확인 ›</span></div>
        <div className="card notice-required stack">
          <p className="notice-title">금요일 라면 재고 정리</p>
          <p className="notice-body">입고 전에 A~D 구역 유통기한을 한 번씩 확인해 주세요.</p>
          <div className="btn btn-primary btn-block mock-btn">확인했어요</div>
          <p className="hint center">확인 2/3명</p>
        </div>
      </Mock>
    ),
  },
  {
    title: '우리 매장\n직원만의 공간',
    desc: '점주가 매장을 만들면 초대코드가 생겨요. 직원은 코드로 입장을 요청하고, 점주가 승인하면 함께 써요.',
    mock: (
      <Mock>
        <div className="card stack">
          <span className="label">초대코드</span>
          <div className="code-boxes">
            {'646936'.split('').map((d, i) => <div key={i} className="code-box">{d}</div>)}
          </div>
        </div>
        <div className="card stack">
          <span className="badge" style={{ alignSelf: 'flex-start' }}>승인 대기 중</span>
          <p className="list-name">○○마트 ○○점</p>
          <p className="muted">점주가 승인하면 바로 들어갈 수 있어요.</p>
        </div>
      </Mock>
    ),
  },
]

/** 첫 장: 앱 아이콘과 함께 스태프온리가 어떤 앱인지 */
function IntroSlide() {
  return (
    <section className="welcome-slide welcome-intro" aria-roledescription="slide" aria-label={`1 / ${SLIDES.length + 1}`}>
      <img className="intro-app-icon" src="/icon-512.png" alt="스태프온리 앱 아이콘" />
      <p className="intro-eyebrow">STAFF ONLY</p>
      <h1 className="intro-title">스태프온리</h1>
      <p className="intro-desc">
        메모장에 적던 유통기한, 단톡방에 묻히던 공지.<br />
        점주와 알바가 한 곳에서 같이 챙겨요.
      </p>
    </section>
  )
}

/** 첫 실행 소개: 로고 소개 + 기능 4장, 옆으로 넘기거나 버튼으로 이동 */
export default function Welcome() {
  const navigate = useNavigate()
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const total = SLIDES.length + 1
  const last = index === total - 1
  const first = index === 0

  const goTo = (i: number) => {
    const track = trackRef.current
    if (!track) return
    track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' })
  }

  const finish = (to: '/login' | '/signup') => {
    markIntroSeen()
    navigate(to, { replace: true })
  }

  return (
    <main className="welcome">
      <div className="welcome-top">
        {/* 첫 장은 가운데 큰 아이콘이 있으니 위쪽 작은 로고는 숨겨요 */}
        <div className="brand" style={{ visibility: first ? 'hidden' : 'visible' }}>
          <img src="/brand/logo.svg" alt="" />
          <span className="brand-name">스태프온리</span>
        </div>
        {!last && <button className="welcome-skip" onClick={() => finish('/login')}>건너뛰기</button>}
      </div>

      <div
        ref={trackRef}
        className="welcome-track"
        aria-roledescription="carousel"
        onScroll={(e) => {
          const t = e.currentTarget
          setIndex(Math.round(t.scrollLeft / t.clientWidth))
        }}
      >
        <IntroSlide />
        {SLIDES.map((s, i) => (
          <section key={i} className="welcome-slide" aria-roledescription="slide" aria-label={`${i + 2} / ${total}`}>
            <div className="welcome-art">{s.mock}</div>
            <h1 className="welcome-title">{s.title}</h1>
            <p className="welcome-desc">{s.desc}</p>
          </section>
        ))}
      </div>

      <div className="welcome-bottom">
        <div className="welcome-dots" role="tablist" aria-label="소개 페이지">
          {Array.from({ length: total }, (_, i) => (
            <button key={i} role="tab" aria-selected={i === index} aria-label={`${i + 1}번째 소개`}
              className={i === index ? 'on' : ''} onClick={() => goTo(i)} />
          ))}
        </div>
        {last ? (
          <div className="stack" style={{ width: '100%' }}>
            <button className="btn btn-primary btn-block" onClick={() => finish('/signup')}>시작하기</button>
            <button className="btn btn-ghost btn-block" onClick={() => finish('/login')}>이미 계정이 있어요</button>
            <GuestStart onBeforeStart={markIntroSeen} />
          </div>
        ) : (
          <button className="btn btn-block btn-primary" onClick={() => goTo(index + 1)}>
            {first ? '어떤 앱인지 보기' : '다음'}
          </button>
        )}
      </div>
    </main>
  )
}
