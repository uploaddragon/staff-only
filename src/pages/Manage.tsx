import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { formatShort } from '../lib/dates'
import { formatDateTime, formatDays } from '../lib/days'
import { supabase, toKoreanError } from '../lib/supabase'
import { useNotices } from '../lib/useNotices'
import { useOwnerOverview } from '../lib/useOwnerOverview'
import { useStore } from '../store/StoreProvider'

type Member = {
  user_id: string
  role: 'owner' | 'staff'
  status: 'pending' | 'approved' | 'rejected' | 'removed'
  work_days: number[]
  requested_at: string
  profiles: { display_name: string } | null
}

/** ⑥ 점주 관리: 담당자 없는 매대 경고, 입장 요청, 매대별 임박 수, 최근 처리 기록, 필독 확인, 초대코드, 멤버 */
export default function Manage() {
  const { active, isOwner, loading, refresh } = useStore()
  const storeId = active?.store_id
  const [members, setMembers] = useState<Member[]>([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const overview = useOwnerOverview(isOwner ? storeId : undefined)
  const { notices } = useNotices(isOwner ? storeId : undefined)

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
  const unassigned = overview.shelves.filter((s) => !s.category.assignee_id)
  const requiredNotices = notices.filter((n) => n.is_required)

  return (
    <main className="page">
      <Link className="back" to="/settings">← 설정</Link>
      <div>
        <h1 className="page-title">매장 관리</h1>
        <p className="page-sub">{active.store_name}</p>
      </div>

      {(error || overview.error) && <p className="alert alert-error" role="alert">{error || overview.error}</p>}

      {/* 담당자 없는 매대 경고 */}
      {unassigned.map((s) => (
        <Link key={s.category.id} className="banner" to={`/shelf/${s.category.id}/settings`}>
          <span>⚠ {s.category.name} 매대에 담당자가 없어요</span>
          <span aria-hidden="true">지정 ›</span>
        </Link>
      ))}

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
        <h2 className="section-title">매대 현황</h2>
        {overview.shelves.length === 0 ? (
          <p className="muted">아직 매대가 없어요. <Link className="link" to="/shelf/new">매대 만들기</Link></p>
        ) : (
          <div className="list">
            {overview.shelves.map((s) => (
              <Link key={s.category.id} className="list-item list-link" to={`/shelf/${s.category.id}`}>
                <div>
                  <p className="list-name">{s.category.name}</p>
                  <p className="list-meta">
                    {s.category.assignee ? `담당 ${s.category.assignee.display_name}` : <span className="text-warn">담당자 없음</span>} · 상품 {s.total}개
                  </p>
                </div>
                <div className="btn-row">
                  {s.expired > 0 && <span className="badge badge-danger">기간 지남 {s.expired}</span>}
                  <span className={`badge ${s.imminent > 0 ? 'badge-warn' : 'badge-gray'}`}>임박 {s.imminent}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <h2 className="section-title" style={{ margin: 0 }}>최근 처리 기록</h2>
          <Link className="link" to="/history">전체 보기</Link>
        </div>
        {overview.logs.length === 0 ? (
          <p className="muted">아직 처리한 기록이 없어요.</p>
        ) : (
          overview.logs.map((l) => (
            <div key={l.id} className="log-row">
              <div className="row">
                <span className="list-name">{l.product_name} {l.disposed && <span className="badge badge-danger">폐기</span>}</span>
                <span className="list-meta">{formatDateTime(l.processed_at)}</span>
              </div>
              <p className="list-meta">
                {l.old_expiry ? formatShort(l.old_expiry) : '재고 없음'} → {l.out_of_stock ? '재고 없음' : formatShort(l.new_expiry!)}
                {' · '}{l.processor?.display_name ?? '알 수 없음'}
              </p>
            </div>
          ))
        )}
      </section>

      {requiredNotices.length > 0 && (
        <section className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <h2 className="section-title" style={{ margin: 0 }}>필독 공지 확인</h2>
            <Link className="link" to="/notices">공지</Link>
          </div>
          <div className="list">
            {requiredNotices.slice(0, 3).map((n) => (
              <Link key={n.id} className="list-item list-link" to={`/notices/${n.id}`}>
                <span className="list-name">{n.title}</span>
                <span className={n.readCount < n.targetCount ? 'text-warn' : 'list-meta'}>
                  {n.readCount}/{n.targetCount}명
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

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
        <h2 className="section-title">멤버 {approved.length}명</h2>
        <div className="list">
          {approved.map((m) => (
            <div className="list-item" key={m.user_id}>
              <div>
                <p className="list-name">
                  {m.profiles?.display_name}{' '}
                  {m.role === 'owner' && <span className="badge">점주</span>}
                </p>
                {m.role === 'staff' && <p className="list-meta">근무 {formatDays(m.work_days)}</p>}
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
