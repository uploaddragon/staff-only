import { useCallback, useEffect, useState } from 'react'
import { isImminent, todaySeoul } from './dates'
import { supabase, toKoreanError } from './supabase'
import { CATEGORY_SELECT, type Category } from './types'

export type ShelfSummary = { category: Category; imminent: number; expired: number; total: number }
export type RecentLog = {
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

/** ⑥ 점주 관리 화면용: 매대별 임박·기간 지남 수, 담당자 없는 매대, 최근 처리 기록 */
export function useOwnerOverview(storeId: string | undefined) {
  const [shelves, setShelves] = useState<ShelfSummary[]>([])
  const [logs, setLogs] = useState<RecentLog[]>([])
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (!storeId) return
    const [c, p, l] = await Promise.all([
      supabase.from('categories').select(CATEGORY_SELECT).eq('store_id', storeId).order('created_at'),
      supabase.from('products').select('category_id, earliest_expiry').eq('store_id', storeId),
      supabase
        .from('process_logs')
        .select('id, product_name, category_name, zone_name, processed_at, old_expiry, new_expiry, out_of_stock, disposed, processor:profiles(display_name)')
        .eq('store_id', storeId)
        .order('processed_at', { ascending: false })
        .limit(5),
    ])
    const err = c.error ?? p.error ?? l.error
    if (err) return setError(toKoreanError(err.message))
    const today = todaySeoul()
    const categories = (c.data ?? []) as unknown as Category[]
    setShelves(
      categories.map((category) => {
        const mine = (p.data ?? []).filter((x) => x.category_id === category.id)
        return {
          category,
          total: mine.length,
          expired: mine.filter((x) => x.earliest_expiry && x.earliest_expiry < today).length,
          imminent: mine.filter((x) => x.earliest_expiry && x.earliest_expiry >= today && isImminent(x.earliest_expiry, category.warn_days, today)).length,
        }
      }),
    )
    setLogs((l.data ?? []) as unknown as RecentLog[])
    setError('')
  }, [storeId])

  useEffect(() => {
    reload()
  }, [reload])

  return { shelves, logs, error, reload }
}
