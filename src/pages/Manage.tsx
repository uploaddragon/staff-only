import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { formatDateTime, formatDays } from '../lib/days'
import { supabase, toKoreanError } from '../lib/supabase'
import { useStore } from '../store/StoreProvider'

type Member = {
  user_id: string
  role: 'owner' | 'staff'
  status: 'pending' | 'approved' | 'rejected' | 'removed'
  work_days: number[]
  requested_at: string
  profiles: { display_name: string } | null
}

/** 점주 전용: 초대코드, 입장 요청 승인, 멤버 관리 */
export default function Manage() {
  const { active, isOwner, loading, refresh } = useStore()
  const storeId = active?.store_id
  const [members, setMembers] = useState<Member[]>([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!storeId) return
    const { data, error } = await supabase
      .from('store_members')
      .select('user_id, role, status, work_days, requested_at, profiles(display_name)')
      .eq('store_id', storeId)
      .in('status', ['pending', 'approved'])
      .order('requested_at')
    if (error) setError(toKoreanError(error.message))
    else setMembers(data as unknown as Member[])
  }, [storeId])

  useEffect(() => {
    load()
  }, [load])

  // 매장 정보를 다 불러온 뒤에 점주인지 판단해요 (새로고침 시 튕김 방지)
  if (loading) return <p className="empty">불러오는 중…</p>
  if (!active || !isOwner) return <Navigate to="/settings" replace />

  /** RPC를 부르고 목록을 다시 불러와요 */
  const run = async (key: string, fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusyId(key)
    setError('')
    const { error } = await fn()
    setBusyId(null)
    if (error) setError(toKoreanError(error.message))
    await load()
  }

  const decide = (userId: string, approve: boolean) =>
    run(userId, () =>
      supabase.rpc('decide_join_request', { p_store_id: active.store_id, p_user_id: userId, p_approve: approve }),
    )

  const remove = (m: Member) => {
    if (!confirm(`${m.profiles?.display_name ?? '이 직원'}님의 매장 접근을 해제할까요?`)) return
    run(m.user_id, () => supabase.rpc('remove_member', { p_store_id: active.store_id, p_user_id: m.user_id }))
  }

  const regenerate = async () => {
    if (!confirm('새 초대코드를 만들까요? 지금 코드는 더 이상 쓸 수 없어요.')) return
    await run('code', () => supabase.rpc('regenerate_invite_code', { p_store_id: active.store_id }))
    await refresh()
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(active.invite_code ?? '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 복사가 막힌 환경이면 화면의 숫자를 보고 알려주면 돼요
    }
  }

  const pending = members.filter((m) => m.status === 'pending')
  const approved = members.filter((m) => m.status === 'approved')

  return (
    <main className="page">
      <Link className="back" to="/settings">← 설정</Link>
      <div>
        <h1 className="page-title">매장 관리</h1>
        <p className="page-sub">{active.store_name}</p>
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      <section className="card stack">
        <h2 className="section-title" style={{ margin: 0 }}>초대코드</h2>
        <p className="invite-code">{active.invite_code}</p>
        <div className="btn-row">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={copy}>
            {copied ? '복사했어요' : '복사'}
          </button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={regenerate} disabled={busyId === 'code'}>
            새 코드 발급
          </button>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">
          입장 요청 {pending.length > 0 && <span className="badge">{pending.length}</span>}
        </h2>
        {pending.length === 0 ? (
          <p className="muted">새 요청이 없어요.</p>
        ) : (
          <div className="list">
            {pending.map((m) => (
              <div className="list-item" key={m.user_id}>
                <div>
                  <p className="list-name">{m.profiles?.display_name}</p>
                  <p className="list-meta">{formatDateTime(m.requested_at)} 요청</p>
                </div>
                <div className="btn-row">
                  <button className="btn btn-ghost btn-sm" disabled={busyId === m.user_id}
                    onClick={() => decide(m.user_id, false)}>거절</button>
                  <button className="btn btn-primary btn-sm" disabled={busyId === m.user_id}
                    onClick={() => decide(m.user_id, true)}>승인</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">멤버 {approved.length}명</h2>
        <div className="list">
          {approved.map((m) => (
            <div className="list-item" key={m.user_id}>
              <div>
                <p className="list-name">
                  {m.profiles?.display_name}{' '}
                  {m.role === 'owner' && <span className="badge">점주</span>}
                </p>
                <p className="list-meta">근무 {formatDays(m.work_days)}</p>
              </div>
              {m.role === 'staff' && (
                <button className="btn btn-danger btn-sm" disabled={busyId === m.user_id}
                  onClick={() => remove(m)}>접근 해제</button>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
