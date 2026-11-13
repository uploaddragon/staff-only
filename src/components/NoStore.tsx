import { Link } from 'react-router-dom'
import { EmptyState } from './States'

/** 승인된 매장이 없을 때 매대·공지 탭에 보여줘요 */
export default function NoStore() {
  return (
    <EmptyState icon="store" title="매장에 들어가면 볼 수 있어요"
      desc="점주라면 매장을 만들고, 직원이라면 초대코드로 입장해 주세요."
      action={<Link className="btn btn-primary btn-sm btn-link" to="/">매장 만들기·입장하기</Link>} />
  )
}
