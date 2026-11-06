import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/** user_type: 가입 후 고른 점주/알바 (첫 화면 안내용). 아직 안 골랐으면 null */
export type Profile = { id: string; display_name: string; user_type: 'owner' | 'staff' | null }

type AuthState = {
  session: Session | null
  profile: Profile | null
  /** 로그인했는데 프로필을 아직 못 불러왔으면 false */
  profileLoaded: boolean
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileFor, setProfileFor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      setProfileFor(null)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, user_type')
      .eq('id', userId)
      .maybeSingle()
    setProfile(data as Profile | null)
    setProfileFor(userId)
  }, [userId])

  useEffect(() => {
    refreshProfile()
  }, [refreshProfile])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, profileLoaded: !userId || profileFor === userId, loading, refreshProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있어요')
  return ctx
}
