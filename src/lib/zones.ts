import { supabase } from './supabase'
import type { Zone } from './types'

/** 안 쓰는 다음 알파벳 (A~D가 있으면 E). 26개를 넘으면 "구역27" */
export function nextZoneName(zones: Pick<Zone, 'name'>[]): string {
  return Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))
    .find((letter) => !zones.some((z) => z.name === letter)) ?? `구역${zones.length + 1}`
}

/** 매대에 구역을 하나 더해요 (점주만 가능, DB 권한으로도 막혀 있어요) */
export async function addZone(storeId: string, categoryId: string, zones: Pick<Zone, 'name' | 'sort_order'>[]) {
  const name = nextZoneName(zones)
  const { data, error } = await supabase
    .from('zones')
    .insert({
      store_id: storeId,
      category_id: categoryId,
      name,
      sort_order: Math.max(-1, ...zones.map((z) => z.sort_order)) + 1,
    })
    .select('id, category_id, name, sort_order, setup_done')
    .single()
  return { zone: data as Zone | null, name, error }
}
