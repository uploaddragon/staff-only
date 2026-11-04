import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import NoStore from '../components/NoStore'
import { isImminent } from '../lib/dates'
import { supabase, toKoreanError } from '../lib/supabase'
import { CATEGORY_SELECT, type Category } from '../lib/types'
import { useStore } from '../store/StoreProvider'

type Summary = { total: number; imminent: number; zonesDone: number; zones: number }

export default function Shelf() {
  const { active, isOwner } = useStore()
  const storeId = active?.store_id
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [summary, setSummary] = useState<Record<string, Summary>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    if (!storeId) return
    ;(async () => {
      const [cats, prods, zones] = await Promise.all([
        supabase.from('categories').select(CATEGORY_SELECT).eq('store_id', storeId).order('created_at'),
        supabase.from('products').select('category_id, earliest_expiry').eq('store_id', storeId),
        supabase.from('zones').select('category_id, setup_done').eq('store_id', storeId),
      ])
      const err = cats.error ?? prods.error ?? zones.error
      if (err) return setError(toKoreanError(err.message))
      const list = cats.data as unknown as Category[]
      const s: Record<string, Summary> = {}
      for (const c of list) s[c.id] = { total: 0, imminent: 0, zonesDone: 0, zones: 0 }
      for (const p of prods.data ?? []) {
        const c = list.find((x) => x.id === p.category_id)
        if (!c) continue
        s[c.id].total++
        if (p.earliest_expiry && isImminent(p.earliest_expiry, c.warn_days)) s[c.id].imminent++
      }
      for (const z of zones.data ?? []) {
        if (!s[z.category_id]) continue
        s[z.category_id].zones++
        if (z.setup_done) s[z.category_id].zonesDone++
      }
      setCategories(list)
      setSummary(s)
    })()
  }, [storeId])

  if (!active) {
    return (
      <main className="page">
        <h1 className="page-title">매대</h1>
        <NoStore />
      </main>
    )
  }

  return (
    <main className="page">
      <div className="row">
        <h1 className="page-title">매대</h1>
        {isOwner && <Link className="btn btn-ghost btn-sm btn-link" to="/shelf/new">+ 카테고리</Link>}
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {categories === null && !error && <p className="empty">불러오는 중…</p>}

      {categories?.length === 0 && (
        <section className="card">
          <p className="empty">
            아직 매대가 없어요.
            <br />
            {isOwner ? '오른쪽 위 "+ 카테고리"로 봉지라면 같은 매대를 만들어 주세요.' : '점주가 매대를 만들면 여기에 보여요.'}
          </p>
        </section>
      )}

      {categories?.map((c) => {
        const s = summary[c.id]
        const setupInProgress = s && s.zones > 0 && s.zonesDone < s.zones
        return (
          <Link key={c.id} className="choice" to={`/shelf/${c.id}`}>
            <div className="row">
              <p className="choice-title">{c.name}</p>
              {s && s.imminent > 0 && <span className="badge badge-danger">임박 {s.imminent}</span>}
            </div>
            <p className="choice-desc">
              {c.assignee ? `담당 ${c.assignee.display_name}` : <span className="text-warn">담당자 없음</span>}
              {' · '}임박 기준 {c.warn_days}일 · 상품 {s?.total ?? 0}개
            </p>
            {setupInProgress && (
              <p className="choice-desc">첫 등록 {s.zonesDone}/{s.zones} 구역 완료</p>
            )}
          </Link>
        )
      })}
    </main>
  )
}
