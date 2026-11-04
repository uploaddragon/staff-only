import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import type { Membership } from '../store/StoreProvider'
import { isDueToday, todaySeoul } from './dates'
import { supabase, toKoreanError } from './supabase'
import { CATEGORY_SELECT, PRODUCT_SELECT, sortProducts, type Category, type Product } from './types'

export type DueItem = { product: Product; category: Category; zoneName: string }

/**
 * 홈 "오늘 뺄 상품"
 * - 알바: 내가 담당인 매대만 / 점주: 모든 매대
 * - 내 근무 요일로 계산해요 (lib/dates.ts isDueToday)
 */
export function useTodayList(store: Membership) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [items, setItems] = useState<DueItem[]>([])
  const [myCategories, setMyCategories] = useState<Category[]>([])
  const [unassigned, setUnassigned] = useState<Category[]>([])
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  const { store_id: storeId, role, work_days: workDays } = store
  const reload = useCallback(async () => {
    const [c, p, z] = await Promise.all([
      supabase.from('categories').select(CATEGORY_SELECT).eq('store_id', storeId),
      supabase.from('products').select(PRODUCT_SELECT).eq('store_id', storeId).eq('out_of_stock', false),
      supabase.from('zones').select('id, name').eq('store_id', storeId),
    ])
    const err = c.error ?? p.error ?? z.error
    if (err) {
      setError(toKoreanError(err.message))
      setLoaded(true)
      return
    }
    const categories = (c.data ?? []) as unknown as Category[]
    const mine = role === 'owner' ? categories : categories.filter((x) => x.assignee_id === userId)
    const zoneNames = new Map((z.data ?? []).map((x) => [x.id, x.name]))
    const today = todaySeoul()

    const due: DueItem[] = []
    for (const product of sortProducts((p.data ?? []) as Product[])) {
      const category = mine.find((x) => x.id === product.category_id)
      if (!category || !product.earliest_expiry) continue
      if (isDueToday(product.earliest_expiry, category.warn_days, today, workDays)) {
        due.push({ product, category, zoneName: zoneNames.get(product.zone_id) ?? '' })
      }
    }
    setError('')
    setItems(due)
    setMyCategories(mine)
    setUnassigned(categories.filter((x) => !x.assignee_id))
    setLoaded(true)
    // workDays는 배열이라 내용이 바뀔 때만 다시 불러오도록 문자열로 비교해요
  }, [storeId, role, userId, workDays.join(',')])

  useEffect(() => {
    reload()
  }, [reload])

  return { items, myCategories, unassigned, error, loaded, reload }
}
