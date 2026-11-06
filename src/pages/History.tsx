import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import NoStore from '../components/NoStore'
import { formatShort } from '../lib/dates'
import { formatDateTime } from '../lib/days'
import { supabase, toKoreanError } from '../lib/supabase'
import { useStore } from '../store/StoreProvider'

type Log = {
  id: string
  product_name: string
  category_name: string
  zone_name: string
  processed_at: string
  old_expiry: string | null
  new_expiry: string | null
  out_of_stock: boolean
  disposed: boolean
  processor: { display_name: string } | null
}

/** "11월 4일 (수)" 서울 기준 날짜 묶음 제목 */
const dayKey = (iso: string) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(iso))

/** 처리 히스토리: 누가, 언제, 어떤 상품을 (이전 날짜 → 새 날짜) */
export default function History() {
  const { active } = useStore()
  const storeId = active?.store_id
  const [logs, setLogs] = useState<Log[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!storeId) return
    supabase
      .from('process_logs')
      .select('id, product_name, category_name, zone_name, processed_at, old_expiry, new_expiry, out_of_stock, disposed, processor:profiles(display_name)')
      .eq('store_id', storeId)
      .order('processed_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) setError(toKoreanError(error.message))
        else setLogs(data as unknown as Log[])
      })
  }, [storeId])

  if (!active) return <main className="page"><h1 className="page-title">히스토리</h1><NoStore /></main>

  // 날짜별로 묶어요
  const groups: { day: string; logs: Log[] }[] = []
  for (const log of logs ?? []) {
    const day = dayKey(log.processed_at)
    if (groups.at(-1)?.day !== day) groups.push({ day, logs: [] })
    groups.at(-1)!.logs.push(log)
  }

  return (
    <main className="page">
      <Link className="back" to="/">← 홈</Link>
      <div>
        <h1 className="page-title">처리 히스토리</h1>
        <p className="page-sub">최근 100건 · 점주와 직원 모두 볼 수 있어요</p>
      </div>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {logs === null && !error && <p className="empty">불러오는 중…</p>}
      {logs?.length === 0 && <section className="card"><p className="empty">아직 처리한 기록이 없어요.</p></section>}

      {groups.map((g) => (
        <section key={g.day} className="stack">
          <h2 className="label">{g.day}</h2>
          <div className="card card-list">
            {g.logs.map((l) => (
              <div key={l.id} className="log-row">
                <div className="row">
                  <span className="list-name">
                    {l.product_name} {l.disposed && <span className="badge badge-danger">폐기</span>}
                  </span>
                  <span className="list-meta">{formatDateTime(l.processed_at).split(' ').at(-1)}</span>
                </div>
                <p className="log-change">
                  {l.old_expiry ? formatShort(l.old_expiry) : '재고 없음'}
                  <span aria-label="에서"> → </span>
                  {l.out_of_stock ? <span className="text-warn">재고 없음</span> : formatShort(l.new_expiry!)}
                </p>
                <p className="list-meta">{l.processor?.display_name ?? '알 수 없음'} · {l.category_name} {l.zone_name}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
