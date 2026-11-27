import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/** 안내할 곳: 화면의 data-tour="이름" 요소 */
export type TourStep = { target: string; title: string; desc: string }

type Rect = { top: number; left: number; width: number; height: number }

const PAD = 6 // 강조 테두리를 요소보다 살짝 크게
const GAP = 12 // 강조 영역과 말풍선 사이

const find = (target: string) => document.querySelector<HTMLElement>(`[data-tour="${target}"]`)

/**
 * 코치마크: 화면을 어둡게 덮고 버튼 하나만 밝게 비춘 뒤, 옆에 말풍선으로 설명해요.
 * 지금 화면에 없는 요소(예: 공지가 없을 때의 배너)는 건너뛰어요.
 */
export default function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  // 화면이 그려진 뒤에 실제로 있는 단계만 남겨요
  const [list, setList] = useState<TourStep[] | null>(null)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      const present = steps.filter((s) => find(s.target))
      if (present.length === 0) onClose()
      else setList(present)
    }, 400)
    return () => clearTimeout(t)
  }, [steps, onClose])

  const step = list?.[index]

  const measure = useCallback(() => {
    if (!step) return
    const el = find(step.target)
    if (!el) return setRect(null)
    const r = el.getBoundingClientRect()
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
  }, [step])

  // 단계가 바뀌면 그 요소가 화면 가운데 오게 스크롤하고 위치를 재요
  useLayoutEffect(() => {
    if (!step) return
    const el = find(step.target)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    measure()
    const t = setTimeout(measure, 350) // 부드러운 스크롤이 끝난 뒤 한 번 더
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step, measure])

  // 열려 있는 동안 Esc로 닫을 수 있어요
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!list || !step) return null
  const last = index === list.length - 1
  const next = () => (last ? onClose() : setIndex((i) => i + 1))

  // 말풍선은 아래 공간이 넉넉하면 아래, 아니면 위에
  const vh = window.innerHeight
  const below = !rect || rect.top + rect.height + GAP + 190 < vh || rect.top < vh / 2
  const bubbleStyle = rect
    ? below
      ? { top: Math.min(rect.top + rect.height + GAP, vh - 200) }
      : { bottom: vh - rect.top + GAP }
    : { top: vh / 2 - 80 }

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* 바깥을 눌러도 밑의 버튼이 눌리지 않게 막아요 */}
      <div className="tour-blocker" onClick={next} />
      {rect && <div className="tour-spot" style={rect} aria-hidden="true" />}
      <div className="tour-bubble" style={bubbleStyle}>
        <p className="tour-count">{index + 1} / {list.length}</p>
        <p className="tour-title" id="tour-title">{step.title}</p>
        <p className="tour-desc">{step.desc}</p>
        <div className="tour-actions">
          {!last && <button type="button" className="tour-skip" onClick={onClose}>건너뛰기</button>}
          {index > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIndex((i) => i - 1)}>이전</button>}
          <button type="button" className="btn btn-primary btn-sm" onClick={next} autoFocus>
            {last ? '시작하기' : '다음'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
