import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreProvider'

/**
 * 홈 상단 매장 이름. 매장이 여러 개면 눌러서 바로 바꿀 수 있어요.
 * (점주가 여러 매장을 운영하거나, 알바가 두 매장에서 일하는 경우)
 */
export default function StoreSwitcher() {
  const navigate = useNavigate()
  const { memberships, active, selectStore } = useStore()
  const approved = memberships.filter((m) => m.status === 'approved')
  if (!active) return null

  const role = (r: string) => (r === 'owner' ? '점주' : '직원')

  return (
    <label className="store-switcher">
      <span className="sr-only">매장 선택</span>
      <select
        value={active.store_id}
        onChange={(e) => {
          if (e.target.value === '__add') navigate('/settings#stores')
          else selectStore(e.target.value)
        }}
      >
        {approved.map((m) => (
          <option key={m.store_id} value={m.store_id}>{m.store_name} · {role(m.role)}</option>
        ))}
        <option value="__add">+ 다른 매장 입장·만들기</option>
      </select>
    </label>
  )
}
