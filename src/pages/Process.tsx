import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ExpiryInput from '../components/ExpiryInput'
import Icon from '../components/Icon'
import { ddayLabel, formatLong, formatShort, isDueToday, parseYYMMDD, todaySeoul, warnDateOf } from '../lib/dates'
import { supabase, toKoreanError } from '../lib/supabase'
import { CATEGORY_SELECT, PRODUCT_SELECT, type Category, type Product } from '../lib/types'
import { useStore } from '../store/StoreProvider'
import type { ProcessedState } from './Home'
import { Skeleton } from '../components/States'

/**
 * 무엇을 했나: 빼둠(할인 스티커) / 판매 완료(빼기 전에 다 팔림) / 폐기
 * 판매 완료는 기한 전 상품에서만, 폐기는 기한이 지난 상품에서만 골라요.
 */
type Action = 'pulled' | 'sold' | 'disposed'

/**
 * ③ 처리: 빼두기 완료 또는 판매 완료 → 남은 것 중 다음으로 빠른 날짜(또는 재고 없음) → 처리 완료
 * 유통기한이 이미 지났으면 "빼뒀어요 / 폐기했어요" 중에 골라요.
 * 한 화면에서 15초 안에 끝나는 게 목표예요.
 */
export default function Process() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const { active } = useStore()
  const [product, setProduct] = useState<Product | null>(null)
  const [category, setCategory] = useState<Category | null>(null)
  const [zoneName, setZoneName] = useState('')
  const [action, setAction] = useState<Action | null>(null)
  const [date, setDate] = useState('')
  const [outOfStock, setOutOfStock] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const dateRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!productId) return
    ;(async () => {
      const { data: p, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('id', productId).maybeSingle()
      if (error || !p) return setError(error ? toKoreanError(error.message) : '상품을 찾을 수 없어요.')
      const [c, z] = await Promise.all([
        supabase.from('categories').select(CATEGORY_SELECT).eq('id', p.category_id).single(),
        supabase.from('zones').select('name').eq('id', p.zone_id).single(),
      ])
      setProduct(p as Product)
      setCategory(c.data as unknown as Category)
      setZoneName(z.data?.name ?? '')
    })()
  }, [productId])

  if (!product || !category) {
    return <main className="page">{error ? <p className="alert alert-error">{error}</p> : <Skeleton />}</main>
  }

  const today = todaySeoul()
  const old = product.earliest_expiry
  const iso = parseYYMMDD(date)
  const expired = !!old && old < today
  const ready = action !== null && (outOfStock || iso !== null) && !busy
  const workDays = active?.role === 'owner' ? [] : active?.work_days ?? []

  // 새 날짜 안내: 이전 날짜보다 빠르거나, 새 날짜도 오늘 뺄 대상이면 알려줘요
  let dateNote = ''
  if (iso && iso < today) dateNote = '이미 지난 날짜예요. 맞는지 확인해 주세요.'
  else if (iso && old && iso < old) dateNote = '이전 기록보다 빠른 날짜예요. 맞는지 확인해 주세요.'
  else if (iso && isDueToday(iso, category.warn_days, today, workDays))
    dateNote = '이 날짜도 오늘 뺄 대상이에요. 처리 후 목록에 다시 나와요.'

  const choose = (next: Action) => {
    const value = action === next ? null : next
    setAction(value)
    if (value && !outOfStock) setTimeout(() => dateRef.current?.focus(), 0)
  }

  const submit = async () => {
    if (!ready) return
    setBusy(true)
    setError('')
    const { data, error } = await supabase.rpc('process_product', {
      p_product_id: product.id,
      p_new_expiry: outOfStock ? null : iso,
      p_out_of_stock: outOfStock,
      p_action: action,
    })
    setBusy(false)
    if (error) return setError(toKoreanError(error.message))
    const state: ProcessedState = { processed: { logId: data.id, name: product.name } }
    navigate('/', { replace: true, state })
  }

  return (
    <main className="page">
      <Link className="back" to="/">← 홈</Link>

      <section className="card stack">
        <div className="row">
          <p className="muted">{category.name} · {zoneName} 구역</p>
          <Link className="link-sub" to={`/history?product=${product.id}`}><Icon name="history" size={16} /> 히스토리</Link>
        </div>
        <h1 className="page-title">{product.name}</h1>
        {old ? (
          <div className="record">
            <div>
              <p className="label">현재 기록</p>
              <p className="record-date">{formatShort(old)} <span className="dday">{ddayLabel(old, today)}</span></p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="label">임박일</p>
              <p className="record-sub">{formatShort(warnDateOf(old, category.warn_days))}</p>
            </div>
          </div>
        ) : (
          <p className="muted">재고 없음 상태예요.</p>
        )}
        {product.memo && <p className="memo-inline">📝 {product.memo}</p>}
      </section>

      {expired ? (
        <>
          <p className="alert alert-error" role="alert">
            유통기한이 {ddayLabel(old!, today).replace('D+', '')}일 지났어요. 어떻게 처리했나요?
          </p>
          <div className="choice-row" role="radiogroup" aria-label="처리 방법">
            <ActionCard on={action === 'pulled'} onClick={() => choose('pulled')}
              title="빼뒀어요" desc="할인 스티커 붙이고 따로 뺌" />
            <ActionCard on={action === 'disposed'} onClick={() => choose('disposed')}
              title="폐기했어요" desc="팔 수 없어서 버림" />
          </div>
        </>
      ) : (
        <div className="choice-row" role="radiogroup" aria-label="처리 방법">
          <ActionCard on={action === 'pulled'} onClick={() => choose('pulled')}
            title="빼두기 완료" desc="할인 스티커 붙이고 따로 뺌" />
          <ActionCard on={action === 'sold'} onClick={() => choose('sold')}
            title="판매 완료" desc="빼기 전에 다 팔렸어요" />
        </div>
      )}

      <section className="card form">
        <div className="btn-row">
          <button type="button" className={`btn btn-sm${!outOfStock ? ' btn-primary' : ' btn-ghost'}`} style={{ flex: 1 }}
            onClick={() => { setOutOfStock(false); setTimeout(() => dateRef.current?.focus(), 0) }}>다음 날짜 입력</button>
          <button type="button" className={`btn btn-sm${outOfStock ? ' btn-primary' : ' btn-ghost'}`} style={{ flex: 1 }}
            onClick={() => setOutOfStock(true)}>재고 없음</button>
        </div>
        {outOfStock ? (
          <p className="hint">남은 재고가 없어요. 다음 입고 때 매대에서 날짜를 다시 입력해 주세요.</p>
        ) : (
          <>
            <ExpiryInput inputRef={dateRef} label="남은 상품 중 가장 빠른 유통기한" value={date} onChange={setDate} onEnter={submit} />
            {dateNote && <p className="alert alert-warn">{dateNote}</p>}
          </>
        )}
      </section>

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      <button className="btn btn-primary btn-block sticky-action" disabled={!ready} onClick={submit}>
        {busy ? '처리 중…' : !action ? '먼저 처리 방법을 골라 주세요' : '처리 완료'}
      </button>
      {iso && !outOfStock && action && <p className="hint center">{formatLong(iso)}로 바꿔요</p>}
    </main>
  )
}

function ActionCard({ on, onClick, title, desc }: { on: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={`check-card${on ? ' on' : ''}`} onClick={onClick}>
      <span className="check-box" aria-hidden="true">{on ? '✓' : ''}</span>
      <span>
        <span className="check-title">{title}</span>
        <span className="check-desc">{desc}</span>
      </span>
    </button>
  )
}
