import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import ExpiryInput from '../components/ExpiryInput'
import { formatShort, parseYYMMDD } from '../lib/dates'
import { supabase, toKoreanError } from '../lib/supabase'
import { PRODUCT_SELECT, type Product } from '../lib/types'
import { useCategory } from '../lib/useCategory'

/** ⑤ 첫 등록: 구역을 골라 "상품명 + 가장 빠른 유통기한"을 연속으로 입력해요 */
export default function Register() {
  const { categoryId } = useParams()
  const [params, setParams] = useSearchParams()
  const { category, zones, products, loaded, canEdit, setProducts, setZones } = useCategory(categoryId)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)

  if (!loaded) return <p className="empty">불러오는 중…</p>
  if (!category || !canEdit) return <Navigate to={`/shelf/${categoryId}`} replace />

  // 구역: 주소의 ?zone= 값 → 아직 안 끝난 첫 구역 → 첫 구역
  const zone = zones.find((z) => z.id === params.get('zone')) ?? zones.find((z) => !z.setup_done) ?? zones[0]
  if (!zone) {
    return (
      <main className="page">
        <Link className="back" to={`/shelf/${category.id}`}>← {category.name}</Link>
        <p className="empty">구역이 없어요. 점주가 매대 설정에서 구역을 추가해야 해요.</p>
      </main>
    )
  }

  const inZone = products.filter((p) => p.zone_id === zone.id)
  const recent = [...inZone].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
  const doneCount = zones.filter((z) => z.setup_done).length
  const iso = parseYYMMDD(date)
  const canSubmit = name.trim().length > 0 && iso !== null && !busy

  const selectZone = (id: string) => {
    setParams({ zone: id }, { replace: true })
    setError('')
    nameRef.current?.focus()
  }

  const onSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!name.trim()) return nameRef.current?.focus()
    if (!iso) return dateRef.current?.focus()
    setBusy(true)
    setError('')
    const { data, error } = await supabase
      .from('products')
      .insert({ store_id: category.store_id, category_id: category.id, zone_id: zone.id, name: name.trim(), earliest_expiry: iso })
      .select(PRODUCT_SELECT)
      .single()
    setBusy(false)
    if (error) return setError(toKoreanError(error.message))
    setProducts((list) => [...list, data as Product])
    setName('')
    setDate('')
    nameRef.current?.focus()
  }

  const remove = async (p: Product) => {
    if (!confirm(`${p.name}을(를) 삭제할까요?`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) return setError(toKoreanError(error.message))
    setProducts((list) => list.filter((x) => x.id !== p.id))
  }

  const toggleDone = async () => {
    const next = !zone.setup_done
    const { error } = await supabase.from('zones').update({ setup_done: next }).eq('id', zone.id)
    if (error) return setError(toKoreanError(error.message))
    setZones((list) => list.map((z) => (z.id === zone.id ? { ...z, setup_done: next } : z)))
    // 완료하면 다음 미완료 구역으로 넘어가요
    if (next) {
      const nextZone = zones.find((z) => z.id !== zone.id && !z.setup_done)
      if (nextZone) selectZone(nextZone.id)
    }
  }

  return (
    <main className="page">
      <Link className="back" to={`/shelf/${category.id}`}>← {category.name}</Link>
      <div>
        <h1 className="page-title">상품 등록</h1>
        <p className="page-sub">매대에서 가장 빠른 유통기한만 적어요</p>
      </div>

      <section className="card stack">
        <div className="row">
          <span className="label">첫 등록 진행률</span>
          <span className="label">{doneCount}/{zones.length} 구역</span>
        </div>
        <div className="progress" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={zones.length}>
          <div style={{ width: `${zones.length ? (doneCount / zones.length) * 100 : 0}%` }} />
        </div>
        <div className="segmented" role="tablist" aria-label="구역 선택">
          {zones.map((z) => {
            const n = products.filter((p) => p.zone_id === z.id).length
            return (
              <button key={z.id} role="tab" aria-selected={z.id === zone.id} className={z.id === zone.id ? 'on' : ''}
                onClick={() => selectZone(z.id)}>
                {z.setup_done ? '✓ ' : ''}{z.name} <small>{n}</small>
              </button>
            )
          })}
        </div>
      </section>

      <form className="card form" onSubmit={onSubmit}>
        <h2 className="section-title" style={{ margin: 0 }}>{zone.name} 구역</h2>
        <label className="field">
          <span className="label">상품명</span>
          <input ref={nameRef} className="input" placeholder="예: 신라면" maxLength={40} autoFocus
            enterKeyHint="next" value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                dateRef.current?.focus()
              }
            }} />
        </label>
        <ExpiryInput inputRef={dateRef} label="가장 빠른 유통기한" value={date} onChange={setDate} onEnter={() => onSubmit()} />
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={!canSubmit}>
          {busy ? '추가 중…' : '추가하고 다음 상품'}
        </button>
      </form>

      <section className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <h2 className="section-title" style={{ margin: 0 }}>{zone.name} 구역 등록 {inZone.length}개</h2>
        </div>
        {recent.length === 0 ? (
          <p className="muted">아직 없어요. 위에서 첫 상품을 입력해 주세요.</p>
        ) : (
          <div className="list">
            {recent.map((p) => (
              <div className="list-item" key={p.id}>
                <div>
                  <p className="list-name">{p.name}</p>
                  <p className="list-meta">{p.earliest_expiry ? formatShort(p.earliest_expiry) : '재고 없음'}</p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(p)}>삭제</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <button className={`btn btn-block ${zone.setup_done ? 'btn-ghost' : 'btn-primary'}`} onClick={toggleDone}>
        {zone.setup_done ? `${zone.name} 구역 완료 취소` : `${zone.name} 구역 등록 완료`}
      </button>
    </main>
  )
}
