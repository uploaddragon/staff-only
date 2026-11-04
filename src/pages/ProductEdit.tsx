import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import ExpiryInput from '../components/ExpiryInput'
import { parseYYMMDD, toYYMMDD } from '../lib/dates'
import { supabase, toKoreanError } from '../lib/supabase'
import { useCategory } from '../lib/useCategory'

/** 상품 정보 고치기 (잘못 입력한 이름·날짜·구역, 재고 없음) */
export default function ProductEdit() {
  const { categoryId, productId } = useParams()
  const navigate = useNavigate()
  const { category, zones, products, loaded, canEdit } = useCategory(categoryId)
  const product = products.find((p) => p.id === productId)
  const [name, setName] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [date, setDate] = useState('')
  const [outOfStock, setOutOfStock] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!product) return
    setName(product.name)
    setZoneId(product.zone_id)
    setDate(product.earliest_expiry ? toYYMMDD(product.earliest_expiry) : '')
    setOutOfStock(product.out_of_stock)
  }, [product])

  const back = `/shelf/${categoryId}`
  if (!loaded) return <p className="empty">불러오는 중…</p>
  if (!category || !canEdit || !product) return <Navigate to={back} replace />

  const iso = parseYYMMDD(date)
  const valid = name.trim().length > 0 && (outOfStock || iso !== null)

  const onSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!valid) return
    setBusy(true)
    const { error } = await supabase.from('products').update({
      name: name.trim(),
      zone_id: zoneId,
      out_of_stock: outOfStock,
      earliest_expiry: outOfStock ? null : iso,
    }).eq('id', product.id)
    setBusy(false)
    if (error) return setError(toKoreanError(error.message))
    navigate(back)
  }

  const remove = async () => {
    if (!confirm(`${product.name}을(를) 매대에서 삭제할까요?`)) return
    const { error } = await supabase.from('products').delete().eq('id', product.id)
    if (error) return setError(toKoreanError(error.message))
    navigate(back)
  }

  return (
    <main className="page">
      <Link className="back" to={back}>← {category.name}</Link>
      <h1 className="page-title">상품 수정</h1>
      <form className="card form" onSubmit={onSubmit}>
        <label className="field">
          <span className="label">상품명</span>
          <input className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          <span className="label">구역</span>
          <select className="input" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={outOfStock} onChange={(e) => setOutOfStock(e.target.checked)} />
          <span>재고 없음 (다음 입고 때 날짜 입력)</span>
        </label>
        {!outOfStock && <ExpiryInput label="가장 빠른 유통기한" value={date} onChange={setDate} onEnter={() => onSubmit()} />}
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={!valid || busy}>{busy ? '저장 중…' : '저장'}</button>
      </form>
      <button className="btn btn-danger btn-block" onClick={remove}>상품 삭제</button>
    </main>
  )
}
