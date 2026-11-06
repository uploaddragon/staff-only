import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatDateTime } from '../lib/days'
import { fetchApprovedMembers, type MemberOption } from '../lib/members'
import { supabase, toKoreanError } from '../lib/supabase'
import { markNoticeRead, NOTICE_SELECT, noticeDate, type Notice } from '../lib/useNotices'
import { useAuth } from '../auth/AuthProvider'
import { useStore } from '../store/StoreProvider'

/** 공지 상세: 알바는 '확인했어요', 점주는 확인한 사람·안 한 사람 */
export default function NoticeDetail() {
  const { noticeId } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { isOwner } = useStore()
  const [notice, setNotice] = useState<Notice | null>(null)
  const [staff, setStaff] = useState<MemberOption[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!noticeId) return
    const { data, error } = await supabase.from('notices').select(NOTICE_SELECT).eq('id', noticeId).maybeSingle()
    if (error || !data) return setError(error ? toKoreanError(error.message) : '공지를 찾을 수 없어요.')
    const n = data as unknown as Notice
    setNotice(n)
    if (isOwner) setStaff((await fetchApprovedMembers(n.store_id)).filter((m) => m.role === 'staff'))
  }, [noticeId, isOwner])

  useEffect(() => {
    load()
  }, [load])

  if (!notice) {
    return <main className="page">{error ? <p className="alert alert-error">{error}</p> : <p className="empty">불러오는 중…</p>}</main>
  }

  const readByMe = notice.notice_reads.some((r) => r.user_id === session?.user.id)
  const readAt = new Map(notice.notice_reads.map((r) => [r.user_id, r.read_at]))
  const readStaff = staff.filter((m) => readAt.has(m.user_id))
  const unreadStaff = staff.filter((m) => !readAt.has(m.user_id))

  const confirm = async () => {
    const { error } = await markNoticeRead(notice.id)
    if (error) return setError(toKoreanError(error.message))
    await load()
  }

  const remove = async () => {
    if (!window.confirm('이 공지를 삭제할까요? 확인 기록도 함께 지워져요.')) return
    const { error } = await supabase.from('notices').delete().eq('id', notice.id)
    if (error) return setError(toKoreanError(error.message))
    navigate('/notices', { replace: true })
  }

  return (
    <main className="page">
      <Link className="back" to="/notices">← 공지</Link>

      <section className={`card stack${notice.is_required ? ' notice-required' : ''}`}>
        <div className="row">
          {notice.is_required ? <span className="badge badge-danger">필독</span> : <span className="badge badge-gray">일반</span>}
          <span className="list-meta">{noticeDate(notice.created_at)} · {notice.author?.display_name ?? '점주'}</span>
        </div>
        <h1 className="notice-title">{notice.title}</h1>
        {notice.body && <p className="notice-body">{notice.body}</p>}
        {!isOwner && notice.is_required && (
          readByMe
            ? <p className="alert alert-info">확인했어요 · {formatDateTime(readAt.get(session!.user.id)!)}</p>
            : <button className="btn btn-primary btn-block" onClick={confirm}>확인했어요</button>
        )}
      </section>

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {isOwner && notice.is_required && (
        <section className="card">
          <h2 className="section-title">확인 현황 {readStaff.length}/{staff.length}명</h2>
          {unreadStaff.length > 0 && (
            <>
              <p className="label">아직 안 봤어요</p>
              <div className="list" style={{ marginBottom: 12 }}>
                {unreadStaff.map((m) => (
                  <div className="list-item" key={m.user_id}><span className="list-name text-warn">{m.display_name}</span></div>
                ))}
              </div>
            </>
          )}
          {readStaff.length > 0 && (
            <>
              <p className="label">확인했어요</p>
              <div className="list">
                {readStaff.map((m) => (
                  <div className="list-item" key={m.user_id}>
                    <span className="list-name">{m.display_name}</span>
                    <span className="list-meta">{formatDateTime(readAt.get(m.user_id)!)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {staff.length === 0 && <p className="muted">아직 직원이 없어요.</p>}
        </section>
      )}

      {isOwner && (
        <div className="btn-row">
          <Link className="btn btn-ghost btn-link" style={{ flex: 1 }} to={`/notices/${notice.id}/edit`}>수정</Link>
          <button className="btn btn-danger" style={{ flex: 1 }} onClick={remove}>삭제</button>
        </div>
      )}
    </main>
  )
}
