// 글자 인식(OCR) 결과에서 유통기한 날짜를 골라내는 규칙
// Cloud Vision은 사진의 글자를 전부 돌려주기만 해서, 어느 날짜가 유통기한인지는 여기서 정해요.
//
// 점수 규칙 (높을수록 유통기한일 가능성이 커요)
//  +10  날짜 바로 뒤에 "까지"
//  +6   날짜 앞쪽 가까이에 유통기한·소비기한·EXP·BEST BEFORE
//  -12  날짜 앞쪽 가까이에 있는 표시가 제조일자·MFG·생산
//  +2   여러 날짜 중 가장 늦은 날짜 (유통기한은 제조일보다 뒤니까)
//  -4   1년 넘게 지난 날짜 (제조일일 가능성이 커요)

export type Picked = { iso: string; raw: string } | { iso: null; note: string }

type Candidate = { iso: string; raw: string; start: number; end: number; score: number }

const EXPIRY = /(유\s*통\s*기\s*한|소\s*비\s*기\s*한|품\s*질\s*유\s*지\s*기\s*한|EXP|BEST\s*BEFORE|USE\s*BY|\bBB\b)/gi
const MAKE = /(제\s*조\s*일?|제\s*조\s*일\s*자|생\s*산\s*일?|포\s*장\s*일|MFG|MFD|PROD|PRD)/gi
const NEAR = 30 // 표시와 날짜 사이 거리 (글자 수)

/** 전각 숫자·흔한 오인식을 정리해요 */
function normalize(text: string) {
  return text
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[．。·]/g, '.')
    .replace(/[／]/g, '/')
    .replace(/[－–—]/g, '-')
}

function validDate(y: number, m: number, d: number) {
  if (y < 2000 || y > 2099 || m < 1 || m > 12 || d < 1) return null
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  if (d > last) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** 텍스트에서 날짜처럼 보이는 것을 모두 찾아요 */
function findDates(text: string): Candidate[] {
  const found: Candidate[] = []
  const taken: [number, number][] = []
  const overlaps = (s: number, e: number) => taken.some(([a, b]) => s < b && e > a)
  const push = (iso: string | null, m: RegExpMatchArray) => {
    const start = m.index!
    const end = start + m[0].length
    if (!iso || overlaps(start, end)) return
    taken.push([start, end])
    found.push({ iso, raw: m[0].trim(), start, end, score: 0 })
  }

  // 2026.12.15 / 2026-12-15 / 2026/12/15 / 2026년 12월 15일 / 2026. 12. 15
  for (const m of text.matchAll(/(?<!\d)(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?(?!\d)/g)) {
    push(validDate(+m[1], +m[2], +m[3]), m)
  }
  // 20261215
  for (const m of text.matchAll(/(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)/g)) {
    push(validDate(+m[1], +m[2], +m[3]), m)
  }
  // 26.12.15 / 26-12-15 / 26/12/15
  for (const m of text.matchAll(/(?<!\d)(\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?!\d)/g)) {
    push(validDate(2000 + +m[1], +m[2], +m[3]), m)
  }
  return found
}

/** 날짜 앞쪽 NEAR 글자 안에서 가장 가까운 표시의 종류 */
function nearestLabel(text: string, start: number): 'expiry' | 'make' | null {
  const from = Math.max(0, start - NEAR)
  const before = text.slice(from, start)
  let best: { pos: number; kind: 'expiry' | 'make' } | null = null
  for (const m of before.matchAll(EXPIRY)) if (!best || m.index! > best.pos) best = { pos: m.index!, kind: 'expiry' }
  for (const m of before.matchAll(MAKE)) if (!best || m.index! >= best.pos) best = { pos: m.index!, kind: 'make' }
  return best?.kind ?? null
}

const yearAgo = (today: string) => `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`

/** OCR 텍스트에서 유통기한을 골라요. 확실하지 않으면 못 찾은 걸로 돌려줘요 */
export function pickExpiry(rawText: string, today: string): Picked {
  const text = normalize(rawText)
  const dates = findDates(text)
  if (dates.length === 0) return { iso: null, note: '날짜를 찾지 못했어요. 날짜 부분이 잘 보이게 가까이 찍어 주세요.' }

  const latest = dates.reduce((a, b) => (b.iso > a.iso ? b : a)).iso
  for (const c of dates) {
    const after = text.slice(c.end, c.end + 6)
    if (/^\s*까\s*지/.test(after)) c.score += 10
    const label = nearestLabel(text, c.start)
    if (label === 'expiry') c.score += 6
    if (label === 'make') c.score -= 12
    if (dates.length > 1 && c.iso === latest) c.score += 2
    if (c.iso < yearAgo(today)) c.score -= 4
  }

  dates.sort((a, b) => b.score - a.score || (b.iso > a.iso ? 1 : -1))
  const best = dates[0]
  if (best.score < 0) {
    const onlyMake = dates.every((d) => nearestLabel(text, d.start) === 'make')
    return { iso: null, note: onlyMake ? '제조일만 보여요. 유통기한이 찍힌 쪽을 찍어 주세요.' : '유통기한을 확실히 찾지 못했어요. 직접 입력해 주세요.' }
  }
  // 표시도 없고 날짜가 여러 개인데 점수가 같으면 애매해요
  if (dates.length > 1 && dates[1].score === best.score && dates[1].iso !== best.iso) {
    return { iso: null, note: '날짜가 여러 개라 어느 게 유통기한인지 모르겠어요. 직접 입력해 주세요.' }
  }
  return { iso: best.iso, raw: best.raw }
}
