import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase, toKoreanError } from './supabase'

export type Notice = {
  id: string
  store_id: string
  title: string
  body: string
  is_required: boolean
  created_at: string
  author: { display_name: string } | null
  /** 알바에게는 본인 기록만, 점주에게는 전체 기록이 와요 (RLS) */
  notice_reads: { user_id: string; read_at: string }[]
}

export type NoticeView = Notice & {
  readByMe: boolean
  readCount: number
  targetCount: number
}

// 공지↔프로필 연결이 두 갈래(작성자, 확인 기록)라 작성자 쪽 외래키를 직접 지정해요
export const NOTICE_SELECT =
  'id, store_id, title, body, is_required, created_at, author:profiles!notices_author_id_fkey(display_name), notice_reads(user_id, read_at)'

/** 매장 공지 목록 + 내 확인 여부 + 확인 인원 */
export function useNotices(storeId: string | undefined) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [notices, setNotices] = useState<NoticeView[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (!storeId) return
    const [n, s] = await Promise.all([
      supabase.from('notices').select(NOTICE_SELECT).eq('store_id', storeId).order('created_at', { ascending: false }),
      supabase.rpc('notice_read_summary', { p_store_id: storeId }),
    ])
    if (n.error || s.error) {
      setError(toKoreanError((n.error ?? s.error)!.message))
      setLoaded(true)
      return
    }
    const summary = new Map(
      ((s.data ?? []) as { notice_id: string; read_count: number; target_count: number }[]).map((r) => [r.notice_id, r]),
    )
    setNotices(
      ((n.data ?? []) as unknown as Notice[]).map((x) => ({
        ...x,
        readByMe: x.notice_reads.some((r) => r.user_id === userId),
        readCount: summary.get(x.id)?.read_count ?? 0,
        targetCount: summary.get(x.id)?.target_count ?? 0,
      })),
    )
    setError('')
    setLoaded(true)
  }, [storeId, userId])

  useEffect(() => {
    reload()
  }, [reload])

  // 앱으로 돌아오면 새 공지를 다시 확인해요
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  return { notices, loaded, error, reload }
}

/** '확인했어요' */
export async function markNoticeRead(noticeId: string) {
  return supabase.rpc('mark_notice_read', { p_notice_id: noticeId })
}

/** "11월 4일" (서울 기준) */
export const noticeDate = (iso: string) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(new Date(iso))
