import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** .env가 아직 설정되지 않았으면 false (안내 화면을 보여줘요) */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'missing-anon-key',
  // pkce: 구글·카카오 로그인 후 돌아올 때 주소의 ?code= 로 세션을 받아요
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } },
)

export type OAuthProvider = 'google' | 'kakao'

/** 구글·카카오 로그인 페이지로 이동해요. 처음이면 그대로 가입돼요. */
export function signInWithProvider(provider: OAuthProvider) {
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  })
}

/** 가입 없이 게스트로 시작해요 (Supabase 익명 로그인). 나중에 설정에서 계정을 연결할 수 있어요. */
export function signInAsGuest() {
  return supabase.auth.signInAnonymously({ options: { data: { display_name: '게스트' } } })
}

/** 게스트 계정에 구글·카카오를 연결해요. 연결하면 같은 계정·데이터로 계속 써요. */
export function linkProvider(provider: OAuthProvider) {
  return supabase.auth.linkIdentity({
    provider,
    options: { redirectTo: `${window.location.origin}/settings` },
  })
}

/** Supabase 오류를 사용자에게 보여줄 한국어 문장으로 바꿔요 */
export function toKoreanError(message: string): string {
  // DB 함수가 직접 보낸 한국어 메시지는 그대로 보여줘요
  if (/[가-힣]/.test(message)) return message
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return '이메일 또는 비밀번호가 맞지 않아요.'
  if (m.includes('user already registered')) return '이미 가입된 이메일이에요. 로그인해 주세요.'
  if (m.includes('email not confirmed')) return '이메일 인증이 아직 안 됐어요. 받은편지함을 확인해 주세요.'
  if (m.includes('password should be at least')) return '비밀번호는 6자 이상이어야 해요.'
  if (m.includes('unable to validate email') || m.includes('invalid format'))
    return '이메일 형식을 확인해 주세요.'
  if (m.includes('anonymous sign-ins are disabled')) return '게스트 시작이 아직 설정되지 않았어요. 이메일·구글·카카오로 시작해 주세요.'
  if (m.includes('manual linking is disabled')) return '계정 연결이 아직 설정되지 않았어요. 잠시 후 다시 시도해 주세요.'
  if (m.includes('identity is already linked') || m.includes('identity_already_exists'))
    return '이 계정은 이미 다른 스태프온리 계정에 연결돼 있어요. 그 계정으로 로그인해 주세요.'
  if (m.includes('already been registered') || m.includes('email address already'))
    return '이미 가입된 이메일이에요. 다른 이메일을 쓰거나 그 계정으로 로그인해 주세요.'
  if (m.includes('rate limit')) return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'
  if (m.includes('failed to fetch')) return '서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.'
  return `문제가 생겼어요: ${message}`
}
