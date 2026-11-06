import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ddayLabel, formatShort, isImminent, todaySeoul } from '../lib/dates'
import { supabase, toKoreanError } from '../lib/supabase'
import { sortProducts } from '../lib/types'
import { useCategory } from '../lib/useCategory'
import { useStore } from '../store/StoreProvider'

/** ② 매대 상세: 구역 탭, 유통기한 빠른 순 목록, 임박 강조 */
export default function CategoryDetail() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const { isOwner } = useStore()
  const { category, zones, products, error, loaded, canEdit, reload } = useCategory(categoryId)
  const [zoneFilter, setZoneFilter] = useState<string>('all')

  if (!loaded) return <p className="empty">불러오는 중…</p>
  if (!category) return <main className="page"><p className="alert alert-error">{error}</p></main>

  const today = todaySeoul()
  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? ''
  const shown = sortProducts(zoneFilter === 'all' ? products : products.filter((p) => p.zone_id === zoneFilter))
  const imminentCount = products.filter((p) => p.earliest_expiry && isImminent(p.earliest_expiry, category.warn_days, today)).length
  const zonesDone = zones.filter((z) => z.setup_done).length
  const setupIncomplete = zones.length > 0 && zonesDone < zones.length
  const registerZone = zoneFilter === 'all' ? '' : `?zone=${zoneFilter}`

  return (
    <main className="page">
      <Link className="back" to="/shelf">← 매대</Link>
      <div className="row">
        <div>
          <h1 className="page-title">{category.name}</h1>
          <p className="page-sub">
            {category.assignee ? `담당 ${category.assignee.display_name}` : <span className="text-warn">담당자 없음</span>}
            {' · '}임박 기준 {category.warn_days}일
          </p>
        </div>
        {isOwner && <Link className="btn btn-ghost btn-sm btn-link" to={`/shelf/${category.id}/settings`}>설정</Link>}
      </div>

      <CategoryMemo categoryId={category.id} memo={category.memo} canEdit={canEdit} onSaved={reload} />

      {setupIncomplete && canEdit && (
        <Link className="banner banner-info" to={`/shelf/${category.id}/register`}>
          <span>첫 등록 {zonesDone}/{zones.length} 구역 완료 · 이어서 등록하기</span>
          <span aria-hidden="true">›</span>
        </Link>
      )}

      <div className="segmented" role="tablist" aria-label="구역">
        <button role="tab" aria-selected={zoneFilter === 'all'} className={zoneFilter === 'all' ? 'on' : ''}
          onClick={() => setZoneFilter('all')}>전체</button>
        {zones.map((z) => (
          <button key={z.id} role="tab" aria-selected={zoneFilter === z.id} className={zoneFilter === z.id ? 'on' : ''}
            onClick={() => setZoneFilter(z.id)}>{z.name}</button>
        ))}
      </div>

      {imminentCount > 0 && zoneFilter === 'all' && (
        <p className="alert alert-error">임박 상품 {imminentCount}개 · 할인 스티커를 붙이고 빼 주세요</p>
      )}

      <section className="card card-list">
        {shown.length === 0 ? (
          <p className="empty">등록된 상품이 없어요.</p>
        ) : (
          shown.map((p) => {
            const imminent = !!p.earliest_expiry && isImminent(p.earliest_expiry, category.warn_days, today)
            return (
              <button key={p.id} className={`product-row${imminent ? ' imminent' : ''}${p.out_of_stock ? ' soldout' : ''}`}
                disabled={!canEdit} onClick={() => navigate(`/shelf/${category.id}/products/${p.id}`)}>
                <span className="zone-chip">{zoneName(p.zone_id)}</span>
                <span className="product-name">
                  {p.name}
                  {p.memo && <span className="product-sub">📝 {p.memo}</span>}
                </span>
                {p.earliest_expiry ? (
                  <span className="product-date">
                    <span>{formatShort(p.earliest_expiry)}</span>
                    <span className="dday">{ddayLabel(p.earliest_expiry, today)}</span>
                  </span>
                ) : (
                  <span className="product-date muted">재고 없음</span>
                )}
              </button>
            )
          })
        )}
      </section>

      {canEdit && (
        <Link className="btn btn-primary btn-block btn-link sticky-action" to={`/shelf/${category.id}/register${registerZone}`}>
          + 상품 추가
        </Link>
      )}
    </main>
  )
}

/** 매대 메모: 누구나 읽고, 점주·담당자는 눌러서 고칠 수 있어요 */
function CategoryMemo({ categoryId, memo, canEdit, onSaved }: {
  categoryId: string
  memo: string | null
  canEdit: boolean
  onSaved: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(memo ?? '')
  const [error, setError] = useState('')

  if (!memo && !canEdit) return null

  const save = async () => {
    const { error } = await supabase.rpc('set_category_memo', { p_category_id: categoryId, p_memo: text })
    if (error) return setError(toKoreanError(error.message))
    setError('')
    setEditing(false)
    await onSaved()
  }

  if (editing) {
    return (
      <section className="card stack">
        <label className="field">
          <span className="label">매대 메모</span>
          <textarea className="input textarea" rows={3} maxLength={500} autoFocus
            placeholder="예: 신상품은 C 구역 맨 아래 칸에 진열" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <div className="btn-row">
          <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => { setText(memo ?? ''); setEditing(false) }}>취소</button>
          <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={save}>저장</button>
        </div>
      </section>
    )
  }

  return (
    <button type="button" className="memo" disabled={!canEdit} onClick={() => setEditing(true)}>
      <span aria-hidden="true">📝</span>
      <span className={memo ? '' : 'muted'}>{memo ?? '매대 메모 남기기 (진열 위치, 인수인계 등)'}</span>
    </button>
  )
}