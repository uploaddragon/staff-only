import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import NoStore from '../components/NoStore'
import { EmptyState, Skeleton } from '../components/States'
import { formatShort } from '../lib/dates'
import { formatDateTime } from '../lib/days'
import { supabase, toKoreanError } from '../lib/supabase'
import { useStore } from '../store/StoreProvider'

type Action = 'pulled' | 'sold' | 'disposed'

type Log = {
  id: string
  product_id: string | null
  product_name: string
  category_name: string
  zone_name: string
  processed_at: string
  old_expiry: string | null
  new_expiry: string | null
  out_of_stock: boolean
  action: Action
  processor: { display_name: string } | null
}

type ProductInfo = { name: string; earliest_expiry: string | null; out_of_stock: boolean }

const PAGE = 50

export const ACTION_LABEL: Record<Action, string> = { pulled: '빼둠', sold: '판매', disposed: '폐기' }
const ACTION_BADGE: Record<Action, string> = { pulled: 'badge-gray', sold: 'badge', disposed: 'badge-danger' }
const FILTERS: { value: Action | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pulled', label: '빼둠' },
  { value: 'sold', label: '판매' },
  { value: 'disposed', label: '폐기' },
]

/** "11월 4일 (수)" 서울 기준 날짜 묶음 제목 */
const dayKey = (iso: string) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(iso))

/**
 * 처리 히스토리: 누가, 언제, 어떤 상품을 (이전 날짜 → 새 날짜), 어떻게(빼둠·판매·폐기)
 * - 전체: 상품 이름 검색, 처리 종류 필터, 더 보기
 * - 상품별: /history?product=<id> (기록을 누르거나 처리·수정 화면의 링크로 들어와요)
 */
export default function History() {
  const navigate = useNavigate()
  const { active } = useStore()
  const storeId = active?.store_id
  const [params, setParams] = useSearchParams()
  const productId = params.get('product')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('') // 입력이 멈춘 뒤의 검색어
  const [filter, setFilter] = useState<Action | 'all'>('all')
  const [page, setPage] = useState(1)
  const [logs, setLogs] = useState<Log[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [error, setError] = useState('')

  // 타이핑이 멈추면 검색해요
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  // 조건이 바뀌면 첫 페이지부터
  useEffect(() => {
    setPage(1)
  }, [productId, search, filter])

  useEffect(() => {
    if (!storeId) return
    let q = supabase
      .from('process_logs')
      .select('id, product_id, product_name, category_name, zone_name, processed_at, old_expiry, new_expiry, out_of_stock, action, processor:profiles(display_name)')
      .eq('store_id', storeId)
      .order('processed_at', { ascending: false })
      .range(0, page * PAGE - 1)
    if (productId) q = q.eq('product_id', productId)
    else if (search) q = q.ilike('product_name', `%${search}%`)
    if (filter !== 'all') q = q.eq('action', filter)
    let cancelled = false
    q.then(({ data, error }) => {
      if (cancelled) return
      if (error) return setError(toKoreanError(error.message))
      setError('')
      setLogs(data as unknown as Log[])
      setHasMore((data?.length ?? 0) === page * PAGE)
    })
    return () => {
      cancelled = true
    }
  }, [storeId, productId, search, filter, page])

  // 상품별 보기: 상품의 지금 상태도 같이 보여줘요 (상품이 지워졌으면 기록의 이름만)
  useEffect(() => {
    setProduct(null)
    if (!productId) return
    supabase.from('products').select('name, earliest_expiry, out_of_stock').eq('id', productId).maybeSingle()
      .then(({ data }) => setProduct(data as ProductInfo | null))
  }, [productId])

  if (!active) return <main className="page"><h1 className="page-title">히스토리</h1><NoStore /></main>

  // 날짜별로 묶어요
  const groups: { day: string; logs: Log[] }[] = []
  for (const log of logs ?? []) {
    const day = dayKey(log.processed_at)
    if (groups.at(-1)?.day !== day) groups.push({ day, logs: [] })
    groups.at(-1)!.logs.push(log)
  }

  const productName = product?.name ?? logs?.[0]?.product_name ?? '상품'
  const counts = (logs ?? []).reduce((acc, l) => ({ ...acc, [l.action]: (acc[l.action] ?? 0) + 1 }), {} as Partial<Record<Action, number>>)

  return (
    <main className="page">
      {productId
        ? <button className="back back-button" onClick={() => setParams({})}>← 전체 히스토리</button>
        : <Link className="back" to="/">← 홈</Link>}

      {productId ? (
        <section className="card stack">
          <p className="muted">상품 히스토리</p>
          <h1 className="page-title">{productName}</h1>
          {product && (
            <p className="list-meta">
              지금 기록: {product.out_of_stock ? '재고 없음' : product.earliest_expiry ? formatShort(product.earliest_expiry) : '-'}
            </p>
          )}
          {logs && logs.length > 0 && (
            <p className="list-meta">
              처리 {logs.length}{hasMore ? '+' : ''}회
              {(Object.keys(ACTION_LABEL) as Action[]).filter((a) => counts[a]).map((a) => ` · ${ACTION_LABEL[a]} ${counts[a]}`)}
            </p>
          )}
        </section>
      ) : (
        <>
          <div>
            <h1 className="page-title">처리 히스토리</h1>
            <p className="page-sub">점주와 직원 모두 볼 수 있어요 · 기록을 누르면 그 상품만 모아 봐요</p>
          </div>
          <label className="search">
            <Icon name="search" size={18} />
            <span className="sr-only">상품 이름으로 찾기</span>
            <input className="input" type="search" placeholder="상품 이름으로 찾기 (예: 신라면)"
              value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </>
      )}

      <div className="segmented" role="tablist" aria-label="처리 종류">
        {FILTERS.map((f) => (
          <button key={f.value} role="tab" aria-selected={filter === f.value} className={filter === f.value ? 'on' : ''}
            onClick={() => setFilter(f.value)}>{f.label}</button>
        ))}
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {logs === null && !error && <Skeleton />}
      {logs?.length === 0 && (
        search || filter !== 'all'
          ? <EmptyState icon="history" title="조건에 맞는 기록이 없어요" desc="검색어나 처리 종류를 바꿔 보세요." />
          : <EmptyState icon="history" title="아직 처리한 기록이 없어요" desc="오늘 뺄 상품을 처리하면 누가·언제·어떻게 처리했는지 여기에 남아요." />
      )}

      {groups.map((g) => (
        <section key={g.day} className="stack">
          <h2 className="label">{g.day}</h2>
          <div className="card card-list">
            {g.logs.map((l) => {
              const body = (
                <>
                  <div className="row">
                    <span className="list-name">
                      {!productId && l.product_name}{' '}
                      <span className={`badge ${ACTION_BADGE[l.action] ?? 'badge-gray'}`}>{ACTION_LABEL[l.action] ?? '처리'}</span>
                    </span>
                    <span className="list-meta">{formatDateTime(l.processed_at).split(' ').at(-1)}</span>
                  </div>
                  <p className="log-change">
                    {l.old_expiry ? formatShort(l.old_expiry) : '재고 없음'}
                    <span aria-label="에서"> → </span>
                    {l.out_of_stock ? <span className="text-warn">재고 없음</span> : formatShort(l.new_expiry!)}
                  </p>
                  <p className="list-meta">{l.processor?.display_name ?? '알 수 없음'} · {l.category_name} {l.zone_name}</p>
                </>
              )
              // 전체 보기에서는 기록을 누르면 그 상품 히스토리로 (지워진 상품은 누를 수 없어요)
              return !productId && l.product_id ? (
                <button key={l.id} className="log-row log-button" onClick={() => navigate(`/history?product=${l.product_id}`)}>{body}</button>
              ) : (
                <div key={l.id} className="log-row">{body}</div>
              )
            })}
          </div>
        </section>
      ))}

      {hasMore && (
        <button className="btn btn-ghost btn-block" onClick={() => setPage((p) => p + 1)}>더 보기</button>
      )}
    </main>
  )
}
