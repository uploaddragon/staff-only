/**
 * 날짜는 모두 'YYYY-MM-DD' 문자열로 다뤄요 (DB date 타입과 같아요).
 * 시간대 문제를 피하려고 계산은 UTC 자정 기준으로만 해요. "오늘"은 서울 기준이에요.
 */

const DAY = 86_400_000

const toUTC = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const fromUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** 서울 기준 오늘 */
export function todaySeoul(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}

export const addDays = (iso: string, days: number) => fromUTC(toUTC(iso) + days * DAY)

/** a − b (일) */
export const diffDays = (a: string, b: string) => Math.round((toUTC(a) - toUTC(b)) / DAY)

/** 요일 0=일 … 6=토 */
export const weekdayOf = (iso: string) => new Date(toUTC(iso)).getUTCDay()

/** '261203' → '2026-12-03'. 없는 날짜면 null */
export function parseYYMMDD(input: string): string | null {
  if (!/^\d{6}$/.test(input)) return null
  const y = 2000 + Number(input.slice(0, 2))
  const m = Number(input.slice(2, 4))
  const d = Number(input.slice(4, 6))
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return fromUTC(date.getTime())
}

/** '2026-12-03' → '261203' */
export const toYYMMDD = (iso: string) => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10)

/** '2026-12-03' → '26.12.03' (목록용 짧은 표기) */
export const formatShort = (iso: string) => `${iso.slice(2, 4)}.${iso.slice(5, 7)}.${iso.slice(8, 10)}`

/** '2026-12-03' → '2026년 12월 3일 (목)' */
export function formatLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일 (${'일월화수목금토'[weekdayOf(iso)]})`
}

/** 유통기한까지 남은 날: D-29 / D-day / D+3 */
export function ddayLabel(expiry: string, today = todaySeoul()): string {
  const n = diffDays(expiry, today)
  if (n === 0) return 'D-day'
  return n > 0 ? `D-${n}` : `D+${-n}`
}

/** 임박일 = 유통기한 − 임박 기준일 (이 날 할인 스티커 붙이고 빼요) */
export const warnDateOf = (expiry: string, warnDays: number) => addDays(expiry, -warnDays)

/** 오늘 기준으로 이미 뺄 때가 됐나? */
export const isImminent = (expiry: string, warnDays: number, today = todaySeoul()) =>
  warnDateOf(expiry, warnDays) <= today
