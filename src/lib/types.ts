export type Category = {
  id: string
  store_id: string
  name: string
  warn_days: number
  assignee_id: string | null
  assignee: { display_name: string } | null
  memo: string | null
}

export type Zone = {
  id: string
  category_id: string
  name: string
  sort_order: number
  setup_done: boolean
}

export type Product = {
  id: string
  category_id: string
  zone_id: string
  name: string
  earliest_expiry: string | null
  out_of_stock: boolean
  memo: string | null
  updated_at: string
}

/** 카테고리 조회 시 담당자 이름까지 같이 가져와요 */
export const CATEGORY_SELECT = 'id, store_id, name, warn_days, assignee_id, memo, assignee:profiles(display_name)'
export const ZONE_SELECT = 'id, category_id, name, sort_order, setup_done'
export const PRODUCT_SELECT = 'id, category_id, zone_id, name, earliest_expiry, out_of_stock, memo, updated_at'

/** 상품 정렬: 유통기한 빠른 순, 재고 없음은 맨 뒤 */
export function sortProducts(list: Product[]): Product[] {
  return [...list].sort((a, b) => {
    if (a.earliest_expiry === b.earliest_expiry) return a.name.localeCompare(b.name, 'ko')
    if (!a.earliest_expiry) return 1
    if (!b.earliest_expiry) return -1
    return a.earliest_expiry < b.earliest_expiry ? -1 : 1
  })
}
