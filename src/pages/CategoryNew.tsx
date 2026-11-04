import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { fetchApprovedMembers, type MemberOption } from '../lib/members'
import { supabase, toKoreanError } from '../lib/supabase'
import { useStore } from '../store/StoreProvider'

/** "A B C D", "A,B,C,D" → ['A','B','C','D'] (중복 제거) */
const parseZones = (text: string) => [...new Set(text.split(/[\s,]+/).map((z) => z.trim()).filter(Boolean))]

/** 점주: 카테고리(매대) 만들기 */
export default function CategoryNew() {
  const navigate = useNavigate()
  const { active, isOwner, loading } = useStore()
  const [name, setName] = useState('')
  const [warnDays, setWarnDays] = useState('30')
  const [zonesText, setZonesText] = useState('A B C D')
  const [assigneeId, setAssigneeId] = useState('')
  const [members, setMembers] = useState<MemberOption[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const storeId = active?.store_id
  useEffect(() => {
    if (storeId) fetchApprovedMembers(storeId).then(setMembers)
  }, [storeId])

  if (loading) return <p className="empty">불러오는 중…</p>
  if (!active || !isOwner) return <Navigate to="/shelf" replace />

  const zones = parseZones(zonesText)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (zones.length === 0) return setError('구역을 하나 이상 입력해 주세요.')
    setBusy(true)
    setError('')
    const { data: cat, error } = await supabase
      .from('categories')
      .insert({ store_id: active.store_id, name: name.trim(), warn_days: Number(warnDays), assignee_id: assigneeId || null })
      .select('id')
      .single()
    if (error) {
      setBusy(false)
      return setError(toKoreanError(error.message))
    }
    const { error: zErr } = await supabase
      .from('zones')
      .insert(zones.map((z, i) => ({ store_id: active.store_id, category_id: cat.id, name: z, sort_order: i })))
    setBusy(false)
    if (zErr) return setError(toKoreanError(zErr.message))
    navigate(`/shelf/${cat.id}`, { replace: true })
  }

  return (
    <main className="page">
      <Link className="back" to="/shelf">← 매대</Link>
      <h1 className="page-title">카테고리 만들기</h1>
      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span className="label">카테고리 이름</span>
          <input className="input" placeholder="예: 봉지라면" maxLength={30} autoFocus
            value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          <span className="label">구역</span>
          <input className="input" value={zonesText} onChange={(e) => setZonesText(e.target.value)} />
          <span className="hint">띄어쓰기로 구분해요 · {zones.length}개: {zones.join(', ')}</span>
        </label>
        <label className="field">
          <span className="label">임박 기준 (유통기한 며칠 전에 뺄지)</span>
          <input className="input" type="number" inputMode="numeric" min={1} max={365}
            value={warnDays} onChange={(e) => setWarnDays(e.target.value)} required />
        </label>
        <label className="field">
          <span className="label">담당자</span>
          <select className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">나중에 정하기</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name}{m.role === 'owner' ? ' (점주)' : ''}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy || !name.trim()}>
          {busy ? '만드는 중…' : '만들기'}
        </button>
      </form>
    </main>
  )
}
