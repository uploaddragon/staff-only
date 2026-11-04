import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useStore } from '../store/StoreProvider'
import { supabase, toKoreanError } from './supabase'
import { CATEGORY_SELECT, PRODUCT_SELECT, ZONE_SELECT, type Category, type Product, type Zone } from './types'

/** 카테고리 하나의 정보·구역·상품을 함께 불러와요 (매대 상세, 첫 등록, 상품 수정에서 써요) */
export function useCategory(categoryId: string | undefined) {
  const { session } = useAuth()
  const { isOwner } = useStore()
  const [category, setCategory] = useState<Category | null>(null)
  const [zones, setZones] = useState<Zone[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    if (!categoryId) return
    const [c, z, p] = await Promise.all([
      supabase.from('categories').select(CATEGORY_SELECT).eq('id', categoryId).maybeSingle(),
      supabase.from('zones').select(ZONE_SELECT).eq('category_id', categoryId).order('sort_order').order('name'),
      supabase.from('products').select(PRODUCT_SELECT).eq('category_id', categoryId),
    ])
    const err = c.error ?? z.error ?? p.error
    if (err) setError(toKoreanError(err.message))
    else if (!c.data) setError('매대를 찾을 수 없어요.')
    else {
      setError('')
      setCategory(c.data as unknown as Category)
      setZones((z.data ?? []) as Zone[])
      setProducts((p.data ?? []) as Product[])
    }
    setLoaded(true)
  }, [categoryId])

  useEffect(() => {
    reload()
  }, [reload])

  /** 점주이거나 이 카테고리 담당자면 상품을 고칠 수 있어요 */
  const canEdit = isOwner || (!!category && category.assignee_id === session?.user.id)

  return { category, zones, products, error, loaded, reload, canEdit, setProducts, setZones }
}
