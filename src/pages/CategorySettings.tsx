import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { fetchApprovedMembers, type MemberOption } from '../lib/members'
import { supabase, toKoreanError } from '../lib/supabase'
import { CATEGORY_SELECT, ZONE_SELECT, type Category, type Zone } from '../lib/types'
import { useStore } from '../store/StoreProvider'

/** 점주: 카테고리 이름·임박 기준·담당자(인수인계)·구역 관리 */
export default function CategorySettings() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const { active, isOwner, loading } = useStore()
  const [category, setCategory] = useState<Category | null>(null)
  const [zones, setZones] = useState<Zone[]>([])
  const [productCount, setProductCount] = useState<Record<string, number>>({})
  const [members, setMembers] = useState<MemberOption[]>([])
  const [name, setName] = useState('')
  const [warnDays, setWarnDays] = useState('')
  const [newZone, setNewZone] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  const storeId = active?.store_id
  const load = useCallback(async () => {
    if (!categoryId || !storeId) return
    const [c, z, p, m] = await Promise.all([
      supabase.from('categories').select(CATEGORY_SELECT).eq('id', categoryId).single(),
      supabase.from('zones').select(ZONE_SELECT).eq('category_id', categoryId).order('sort_order'),
      supabase.from('products').select('zone_id').eq('category_id', categoryId),
      fetchApprovedMembers(storeId),
    ])
    if (c.error) return setError(toKoreanError(c.error.message))
    const cat = c.data as unknown as Category
    setCategory(cat)
    setName(cat.name)
    setWarnDays(String(cat.warn_days))
    setZones((z.data ?? []) as Zone[])
    const counts: Record<string, number> = {}
    for (const row of p.data ?? []) counts[row.zone_id] = (counts[row.zone_id] ?? 0) + 1
    setProductCount(counts)
    setMembers(m)
  }, [categoryId, storeId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className="empty">불러오는 중…</p>
  if (!active || !isOwner) return <Navigate to={`/shelf/${categoryId}`} replace />
  if (!category) return <main className="page">{error ? <p className="alert alert-error">{error}</p> : <p className="empty">불러오는 중…</p>}</main>

  /** 저장 후 잠깐 "저장했어요"를 보여줘요 */
  const done = (msg: string, err: { message: string } | null) => {
    if (err) return setError(toKoreanError(err.message))
    setError('')
    setSaved(msg)
    setTimeout(() => setSaved(''), 1500)
    load()
  }

  const saveBasics = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('categories')
      .update({ name: name.trim(), warn_days: Number(warnDays) }).eq('id', category.id)
    done('저장했어요', error)
  }

  const changeAssignee = async (assigneeId: string) => {
    const { error } = await supabase.from('categories')
      .update({ assignee_id: assigneeId || null }).eq('id', category.id)
    done('담당자를 바꿨어요', error)
  }

  const addZone = async (e: FormEvent) => {
    e.preventDefault()
    if (!newZone.trim()) return
    const { error } = await supabase.from('zones').insert({
      store_id: active.store_id, category_id: category.id, name: newZone.trim(),
      sort_order: Math.max(-1, ...zones.map((z) => z.sort_order)) + 1,
    })
    if (!error) setNewZone('')
    done('구역을 추가했어요', error)
  }

  const deleteZone = async (zone: Zone) => {
    const n = productCount[zone.id] ?? 0
    const msg = n > 0
      ? `${zone.name} 구역과 상품 ${n}개를 삭제할까요? 되돌릴 수 없어요.`
      : `${zone.name} 구역을 삭제할까요?`
    if (!confirm(msg)) return
    const { error } = await supabase.from('zones').delete().eq('id', zone.id)
    done('구역을 삭제했어요', error)
  }

  const deleteCategory = async () => {
    if (!confirm(`${category.name} 카테고리와 모든 구역·상품을 삭제할까요? 되돌릴 수 없어요.`)) return
    const { error } = await supabase.from('categories').delete().eq('id', category.id)
    if (error) return setError(toKoreanError(error.message))
    navigate('/shelf', { replace: true })
  }

  return (
    <main className="page">
      <Link className="back" to={`/shelf/${category.id}`}>← {category.name}</Link>
      <h1 className="page-title">매대 설정</h1>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {saved && <p className="alert alert-info" role="status">{saved}</p>}

      <section className="card">
        <h2 className="section-title">담당자</h2>
        {!category.assignee_id && <p className="alert alert-warn" style={{ marginBottom: 12 }}>담당자가 없어요. 지정해 주세요.</p>}
        <select className="input" style={{ width: '100%' }} value={category.assignee_id ?? ''}
          onChange={(e) => changeAssignee(e.target.value)}>
          <option value="">담당자 없음</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.display_name}{m.role === 'owner' ? ' (점주)' : ''}
            </option>
          ))}
        </select>
        <p className="hint" style={{ marginTop: 8 }}>담당자는 이 매대의 상품을 등록·수정할 수 있어요. 알바가 바뀌면 여기서 넘겨주세요.</p>
      </section>

      <form className="card form" onSubmit={saveBasics}>
        <h2 className="section-title" style={{ margin: 0 }}>기본 정보</h2>
        <label className="field">
          <span className="label">카테고리 이름</span>
          <input className="input" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          <span className="label">임박 기준 (일)</span>
          <input className="input" type="number" inputMode="numeric" min={1} max={365}
            value={warnDays} onChange={(e) => setWarnDays(e.target.value)} required />
        </label>
        <button className="btn btn-primary btn-block">저장</button>
      </form>

      <section className="card">
        <h2 className="section-title">구역</h2>
        <div className="list">
          {zones.map((z) => (
            <div className="list-item" key={z.id}>
              <div>
                <p className="list-name">{z.name}</p>
                <p className="list-meta">상품 {productCount[z.id] ?? 0}개</p>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => deleteZone(z)}>삭제</button>
            </div>
          ))}
        </div>
        <form className="btn-row" style={{ marginTop: 12 }} onSubmit={addZone}>
          <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="새 구역 (예: E)" maxLength={10}
            value={newZone} onChange={(e) => setNewZone(e.target.value)} />
          <button className="btn btn-ghost">추가</button>
        </form>
      </section>

      <button className="btn btn-danger btn-block" onClick={deleteCategory}>카테고리 삭제</button>
    </main>
  )
}
