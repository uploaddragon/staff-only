import { supabase } from './supabase'

export type MemberOption = { user_id: string; role: 'owner' | 'staff'; display_name: string }

/** 담당자 선택용: 매장의 승인 멤버 목록 */
export async function fetchApprovedMembers(storeId: string): Promise<MemberOption[]> {
  const { data } = await supabase
    .from('store_members')
    .select('user_id, role, profiles(display_name)')
    .eq('store_id', storeId)
    .eq('status', 'approved')
  const rows = (data ?? []) as unknown as { user_id: string; role: 'owner' | 'staff'; profiles: { display_name: string } | null }[]
  return rows
    .map((r) => ({ user_id: r.user_id, role: r.role, display_name: r.profiles?.display_name ?? '이름 없음' }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name, 'ko'))
}
