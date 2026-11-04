/** 근무 요일: DB에는 0=일 … 6=토로 저장하고, 화면에는 월요일부터 보여줘요 */
export const WEEK_DAYS = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' },
]

/** [2, 4] → "화·목" */
export function formatDays(days: number[]): string {
  if (days.length === 0) return '미설정'
  return WEEK_DAYS.filter((d) => days.includes(d.value)).map((d) => d.label).join('·')
}

/** "11월 4일 14:05" (서울 기준) */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}
