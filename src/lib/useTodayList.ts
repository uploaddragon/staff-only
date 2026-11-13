import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import type { Membership } from '../store/StoreProvider'
import { addDays, isDueToday, isImminent, todaySeoul, warnDateOf } from './dates'
import { supabase, toKoreanError } from './supabase'
import { CATEGORY_SELECT, sortProducts, type Category, type Product } from './types'

export type DueItem = { product: Product; category: Category; zoneName: string }

/** 다가오는 임박: 빼는 날(임박일)별로 묶어요 */
export type UpcomingDay = { date: string; items: DueItem[] }

/** 내 매대 한눈에 보기 */
export type ShelfCard = {
  category: Category
  inStock: number
  outOfStock: number
  imminent: number
  zonesDone: number
  zones: number
}

/** 앞으로 며칠까지 미리 보여줄지 */
const UPCOMING_DAYS = 7

/**
 * 홈 데이터
 * - 오늘 뺄 상품 / 기간 지난 상품 / 다가오는 임박(7일) / 내 매대 요약 / 오늘 처리한 개수
 * - 알바: 내가 담당인 매대만, 점주: 모든 매대
 * - 내 근무 요일로 계산해요 (lib/dates.ts isDueToday)
 */
export function useTodayList(store: Membership) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [items, setItems] = useState<DueItem[]>([])
  /** 유통기한이 이미 지난 상품 (홈 맨 위에서 따로 처리 상태를 물어봐요) */
  const [expired, setExpired] = useState<DueItem[]>([])
  const [upcoming, setUpcoming] = useState<UpcomingDay[]>([])
  const [shelves, setShelves] = useState<ShelfCard[]>([])
  const [processedToday, setProcessedToday] = useState(0)
  const [myCategories, setMyCategories] = useState<Category[]>([])
  const [unassigned, setUnassigned] = useState<Category[]>([])
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  const { store_id: storeId, role } = store
  // 점주는 근무 요일 없이 "오늘까지 임박한 상품"만 봐요
  const workDays = role === 'owner' ? [] : store.work_days
  const reload = useCallback(async () => {
    const today = todaySeoul()
    let logs = supabase
      .from('process_logs')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .gte('processed_at', `${today}T00:00:00+09:00`)
    // 알바는 내가 처리한 것만, 점주는 매장 전체
    if (role !== 'owner' && userId) logs = logs.eq('processed_by', userId)

    const [c, p, z, l] = await Promise.all([
      supabase.from('categories').select(CATEGORY_SELECT).eq('store_id', storeId).order('created_at'),
      supabase.from('products').select('id, category_id, zone_id, name, earliest_expiry, out_of_stock, memo, updated_at').eq('store_id', storeId),
      supabase.from('zones').select('id, name, category_id, setup_done').eq('store_id', storeId),
      logs,
    ])
    const err = c.error ?? p.error ?? z.error ?? l.error
    if (err) {
      setError(toKoreanError(err.message))
      setLoaded(true)
      return
    }
    const categories = (c.data ?? []) as unknown as Category[]
    const mine = role === 'owner' ? categories : categories.filter((x) => x.assignee_id === userId)
    const zones = z.data ?? []
    const zoneNames = new Map(zones.map((x) => [x.id, x.name]))
    const products = (p.data ?? []) as Product[]
    const horizon = addDays(today, UPCOMING_DAYS)

    const due: DueItem[] = []
    const past: DueItem[] = []
    const soon = new Map<string, DueItem[]>()
    for (const product of sortProducts(products)) {
      const category = mine.find((x) => x.id === product.category_id)
      if (!category || !product.earliest_expiry || product.out_of_stock) continue
      const item = { product, category, zoneName: zoneNames.get(product.zone_id) ?? '' }
      if (product.earliest_expiry < today) past.push(item)
      else if (isDueToday(product.earliest_expiry, category.warn_days, today, workDays)) due.push(item)
      else {
        const warn = warnDateOf(product.earliest_expiry, category.warn_days)
        if (warn <= horizon) soon.set(warn, [...(soon.get(warn) ?? []), item])
      }
    }

    setError('')
    setItems(due)
    setExpired(past)
    setUpcoming([...soon.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, list]) => ({ date, items: list })))
    setShelves(
      mine.map((category) => {
        const list = products.filter((x) => x.category_id === category.id)
        const catZones = zones.filter((x) => x.category_id === category.id)
        return {
          category,
          inStock: list.filter((x) => !x.out_of_stock).length,
          outOfStock: list.filter((x) => x.out_of_stock).length,
          imminent: list.filter((x) => x.earliest_expiry && isImminent(x.earliest_expiry, category.warn_days, today)).length,
          zonesDone: catZones.filter((x) => x.setup_done).length,
          zones: catZones.length,
        }
      }),
    )
    setProcessedToday(l.count ?? 0)
    setMyCategories(mine)
    setUnassigned(categories.filter((x) => !x.assignee_id))
    setLoaded(true)
    // workDays는 배열이라 내용이 바뀔 때만 다시 불러오도록 문자열로 비교해요
  }, [storeId, role, userId, workDays.join(',')])

  useEffect(() => {
    reload()
  }, [reload])

  return { items, expired, upcoming, shelves, processedToday, myCategories, unassigned, error, loaded, reload }
}
