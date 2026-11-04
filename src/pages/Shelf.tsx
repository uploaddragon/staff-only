import NoStore from '../components/NoStore'
import { useStore } from '../store/StoreProvider'

export default function Shelf() {
  const { active } = useStore()
  return (
    <main className="page">
      <h1 className="page-title">매대</h1>
      {active ? (
        <section className="card">
          <p className="empty">카테고리·구역·상품 등록은 3단계에서 만들어요.</p>
        </section>
      ) : (
        <NoStore />
      )}
    </main>
  )
}
