import { useAuth } from '../auth/AuthProvider'

/** 오늘 날짜를 서울 기준으로 "11월 4일 (수)" 형태로 보여줘요 */
function todayLabel() {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short',
  }).format(new Date())
}

export default function Home() {
  const { profile } = useAuth()
  return (
    <main className="page">
      <div>
        <p className="page-sub">{todayLabel()}</p>
        <h1 className="page-title">{profile ? `${profile.display_name}님, 안녕하세요` : '안녕하세요'}</h1>
      </div>
      <section className="card">
        <p className="empty">아직 들어간 매장이 없어요.<br />매장 개설·입장은 다음 단계에서 만들어요.</p>
      </section>
    </main>
  )
}
