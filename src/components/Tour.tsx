import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * 안내할 곳: 화면의 data-tour="이름" 요소
 * onEnter: 이 단계로 올 때 먼저 할 일 (예: 체험 매장에서 처리 화면으로 바꾸기)
 */
export type TourStep = { target: string; title: string; desc: string; onEnter?: () => void }

type Rect = { top: number; left: number; width: number; height: number }

const PAD = 6 // 강조 테두리를 요소보다 살짝 크게
const GAP = 12 // 강조 영역과 말풍선 사이

const find = (target: string) => document.querySelector<HTMLElement>(`[data-tour="${target}"]`)

/**
 * 코치마크: 화면을 어둡게 덮고 버튼 하나만 밝게 비춘 뒤, 옆에 말풍선으로 설명해요.
 * 요소가 잠깐 기다려도 안 나타나면 그 단계는 건너뛰어요.
 */
export default function Tour({ steps, onClose, doneLabel = '시작하기' }: { steps: TourStep[]; onClose: () => void; doneLabel?: string }) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [ready, setReady] = useState(false) // 지금 단계의 요소를 찾았나
  const step = steps[index]
  const last = index === steps.length - 1

  const measure = useCallback(() => {
    if (!step) return
    const el = find(step.target)
    if (!el) return
    const r = el.getBoundingClientRect()
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
  }, [step])

  // 단계가 바뀌면: 할 일 실행 → 요소가 나타날 때까지 잠깐 기다림 → 가운데로 스크롤 → 위치 재기
  useLayoutEffect(() => {
    if (!step) return
    setReady(false)
    step.onEnter?.()
    let tries = 0
    let timer = 0
    const look = () => {
      const el = find(step.target)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        measure()
        setReady(true)
        timer = window.setTimeout(measure, 350) // 부드러운 스크롤이 끝난 뒤 한 번 더
      } else if (++tries < 15) {
        timer = window.setTimeout(look, 100)
      } else if (index < steps.length - 1) {
        setIndex((i) => i + 1) // 이 화면에 없는 버튼이면 건너뛰어요
      } else {
        onClose()
      }
    }
    timer = window.setTimeout(look, 50)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step, index, steps.length, measure, onClose])

  // 열려 있는 동안 Esc로 닫을 수 있어요
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!step) return null
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
      {ready && rect && <div className="tour-spot" style={rect} aria-hidden="true" />}
      {ready && (
        <div className="tour-bubble" style={bubbleStyle} key={index}>
          <p className="tour-count">{index + 1} / {steps.length}</p>
          <p className="tour-title" id="tour-title">{step.title}</p>
          <p className="tour-desc">{step.desc}</p>
          <div className="tour-actions">
            {!last && <button type="button" className="tour-skip" onClick={onClose}>건너뛰기</button>}
            {index > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIndex((i) => i - 1)}>이전</button>}
            <button type="button" className="btn btn-primary btn-sm" onClick={next} autoFocus>
              {last ? doneLabel : '다음'}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
