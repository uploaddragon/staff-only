import { useState } from 'react'
import { Link } from 'react-router-dom'
import NoStore from '../components/NoStore'
import { toKoreanError } from '../lib/supabase'
import { markNoticeRead, noticeDate, useNotices, type NoticeView } from '../lib/useNotices'
import { useStore } from '../store/StoreProvider'
import { EmptyState, Skeleton } from '../components/States'

/** ⑧ 공지사항: 알바는 필독 카드 + '확인했어요', 점주는 작성과 확인 현황 */
export default function Notices() {
  const { active, isOwner } = useStore()
  const { notices, loaded, error, reload } = useNotices(active?.store_id)
  const [actionError, setActionError] = useState('')

  if (!active) return <main className="page"><h1 className="page-title">공지</h1><NoStore /></main>

  const unreadRequired = isOwner ? [] : notices.filter((n) => n.is_required && !n.readByMe)
  const rest = notices.filter((n) => !unreadRequired.includes(n))

  const confirm = async (n: NoticeView) => {
    const { error } = await markNoticeRead(n.id)
    if (error) setActionError(toKoreanError(error.message))
    await reload()
  }

  return (
    <main className="page">
      <div className="row">
        <h1 className="page-title">공지</h1>
        {isOwner && <Link className="btn btn-primary btn-sm btn-link" to="/notices/new">+ 공지 작성</Link>}
      </div>

      {(error || actionError) && <p className="alert alert-error" role="alert">{error || actionError}</p>}
      {!loaded && <Skeleton />}

      {unreadRequired.map((n) => (
        <section key={n.id} className="card notice-required stack">
          <div className="row">
            <span className="badge badge-danger">필독</span>
            <span className="list-meta">{noticeDate(n.created_at)} · {n.author?.display_name ?? '점주'}</span>
          </div>
          <h2 className="notice-title">{n.title}</h2>
          {n.body && <p className="notice-body">{n.body}</p>}
          <button className="btn btn-primary btn-block" onClick={() => confirm(n)}>확인했어요</button>
          <p className="hint center">확인 {n.readCount}/{n.targetCount}명</p>
        </section>
      ))}

      {loaded && notices.length === 0 && (
        <EmptyState icon="megaphone" title="아직 공지가 없어요"
          desc={isOwner ? '필독으로 올리면 직원이 확인할 때까지 홈에 남고, 누가 봤는지 알 수 있어요.' : '점주가 공지를 올리면 여기에 보여요.'}
          action={isOwner && <Link className="btn btn-primary btn-sm btn-link" to="/notices/new">공지 작성</Link>} />
      )}

      {rest.length > 0 && (
        <section className="card card-list">
          {rest.map((n) => (
            <Link key={n.id} className="notice-row" to={`/notices/${n.id}`}>
              <div className="row">
                <span className="list-name">
                  {n.is_required && <span className="badge badge-danger">필독</span>} {n.title}
                </span>
                <span className="chevron" aria-hidden="true">›</span>
              </div>
              <p className="list-meta">
                {noticeDate(n.created_at)}
                {n.is_required && (isOwner
                  ? <> · 확인 {n.readCount}/{n.targetCount}명{n.readCount < n.targetCount && <span className="text-warn"> · 미확인 {n.targetCount - n.readCount}명</span>}</>
                  : <> · 확인함</>)}
              </p>
            </Link>
          ))}
        </section>
      )}
    </main>
  )
}
