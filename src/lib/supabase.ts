import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** .env가 아직 설정되지 않았으면 false (안내 화면을 보여줘요) */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'missing-anon-key',
  { auth: { persistSession: true, autoRefreshToken: true } },
)

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
  if (m.includes('rate limit')) return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'
  if (m.includes('failed to fetch')) return '서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.'
  return `문제가 생겼어요: ${message}`
}
