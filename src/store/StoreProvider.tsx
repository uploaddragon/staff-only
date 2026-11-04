import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase, toKoreanError } from '../lib/supabase'

export type Membership = {
  store_id: string
  store_name: string
  invite_code: string | null // 점주에게만 와요
  role: 'owner' | 'staff'
  status: 'pending' | 'approved' | 'rejected'
  work_days: number[]
}

type StoreState = {
  memberships: Membership[]
  /** 지금 보고 있는 매장 (승인된 매장 중 하나) */
  active: Membership | null
  isOwner: boolean
  loading: boolean
  error: string
  refresh: () => Promise<void>
  selectStore: (storeId: string) => void
}

const ACTIVE_KEY = 'staffonly.activeStore'
const StoreContext = createContext<StoreState | null>(null)

function readActiveId() {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [memberships, setMemberships] = useState<Membership[]>([])
  // 어떤 사용자 기준으로 불러왔는지 기억해요. 로그인 직후처럼 아직 안 불러왔으면 loading이에요.
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<string | null>(readActiveId)

  const refresh = useCallback(async () => {
    if (!userId) {
      setMemberships([])
      setLoadedFor(null)
      return
    }
    const { data, error } = await supabase.rpc('my_memberships')
    if (error) setError(toKoreanError(error.message))
    else {
      setError('')
      setMemberships((data ?? []) as Membership[])
    }
    setLoadedFor(userId)
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const loading = loadedFor !== (userId ?? null)

  // 앱으로 돌아올 때마다 새로 불러와요 (승인 대기 → 승인 반영)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  const approved = memberships.filter((m) => m.status === 'approved')
  const active = approved.find((m) => m.store_id === activeId) ?? approved[0] ?? null

  const selectStore = (storeId: string) => {
    setActiveId(storeId)
    try {
      localStorage.setItem(ACTIVE_KEY, storeId)
    } catch {
      // 저장 못 해도 이번 접속 동안은 유지돼요
    }
  }

  return (
    <StoreContext.Provider
      value={{ memberships, active, isOwner: active?.role === 'owner', loading, error, refresh, selectStore }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore는 StoreProvider 안에서만 쓸 수 있어요')
  return ctx
}
