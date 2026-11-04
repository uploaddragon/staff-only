import NoStore from '../components/NoStore'
import { useStore } from '../store/StoreProvider'

export default function Notices() {
  const { active } = useStore()
  return (
    <main className="page">
      <h1 className="page-title">공지</h1>
      {active ? (
        <section className="card">
          <p className="empty">필독 공지는 5단계에서 만들어요.</p>
        </section>
      ) : (
        <NoStore />
      )}
    </main>
  )
}
