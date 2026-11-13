import type { ReactNode } from 'react'
import Icon, { type IconName } from './Icon'

/** 빈 상태: 아이콘 + 한 줄 제목 + 설명 + (선택) 다음 행동 */
export function EmptyState({ icon, title, desc, action, tone = 'neutral' }: {
  icon: IconName
  title: string
  desc?: ReactNode
  action?: ReactNode
  tone?: 'neutral' | 'good'
}) {
  return (
    <section className={`empty-state empty-${tone}`}>
      <span className="empty-icon"><Icon name={icon} size={28} /></span>
      <p className="empty-title">{title}</p>
      {desc && <p className="empty-desc">{desc}</p>}
      {action}
    </section>
  )
}

/** 불러오는 동안 보여주는 회색 카드 모양 */
export function Skeleton({ rows = 3, header = true }: { rows?: number; header?: boolean }) {
  return (
    <div className="skeleton-wrap" aria-busy="true" aria-label="불러오는 중">
      {header && <div className="skeleton skeleton-block" />}
      <div className="card card-list">
        {Array.from({ length: rows }, (_, i) => (
          <div className="skeleton-row" key={i}>
            <span className="skeleton skeleton-chip" />
            <span className="skeleton skeleton-line" style={{ width: `${55 - i * 8}%` }} />
            <span className="skeleton skeleton-date" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** 화면 전체를 불러오는 동안 */
export function PageLoading() {
  return <main className="page"><Skeleton /></main>
}

/** 섹션 제목: 아이콘 + 제목 + (선택) 오른쪽 링크 */
export function SectionHeader({ icon, title, right }: { icon: IconName; title: ReactNode; right?: ReactNode }) {
  return (
    <div className="section-header">
      <h2><Icon name={icon} size={18} /> {title}</h2>
      {right}
    </div>
  )
}
