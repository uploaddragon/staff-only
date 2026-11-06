import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { fetchApprovedMembers, type MemberOption } from '../lib/members'
import { supabase, toKoreanError } from '../lib/supabase'
import { useStore } from '../store/StoreProvider'

const MAX_ZONES = 12

/** 4 → ['A','B','C','D'] (이름은 나중에 매대 설정에서 바꿀 수 있어요) */
const zoneNames = (count: number) => Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i))

/** 점주: 카테고리(매대) 만들기 */
export default function CategoryNew() {
  const navigate = useNavigate()
  const { active, isOwner, loading } = useStore()
  const [name, setName] = useState('')
  const [warnDays, setWarnDays] = useState('30')
  const [zoneCount, setZoneCount] = useState(4)
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

  const zones = zoneNames(zoneCount)

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
        <div className="field">
          <span className="label">구역 개수</span>
          <div className="stepper">
            <button type="button" aria-label="구역 하나 빼기" disabled={zoneCount <= 1}
              onClick={() => setZoneCount((n) => n - 1)}>−</button>
            <span className="stepper-value" aria-live="polite">{zoneCount}개</span>
            <button type="button" aria-label="구역 하나 더하기" disabled={zoneCount >= MAX_ZONES}
              onClick={() => setZoneCount((n) => n + 1)}>+</button>
          </div>
          <div className="zone-preview" aria-hidden="true">
            {zones.map((z) => <span key={z} className="zone-chip">{z}</span>)}
          </div>
          <span className="hint">이름은 A, B, C… 순서로 만들어져요. 나중에 매대 설정에서 바꿀 수 있어요.</span>
        </div>
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
