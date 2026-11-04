import { Link } from 'react-router-dom'

/** 승인된 매장이 없을 때 매대·공지 탭에 보여줘요 */
export default function NoStore() {
  return (
    <section className="card">
      <p className="empty">
        매장에 들어가면 볼 수 있어요.
        <br />
        <Link className="link" to="/">홈에서 매장 만들기·입장하기</Link>
      </p>
    </section>
  )
}
