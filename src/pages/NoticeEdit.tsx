import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { supabase, toKoreanError } from '../lib/supabase'
import { useStore } from '../store/StoreProvider'

/** ⑦ 공지 작성·수정 (점주): 제목, 내용, 필독 토글, 게시 */
export default function NoticeEdit() {
  const { noticeId } = useParams()
  const navigate = useNavigate()
  const { active, isOwner, loading } = useStore()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [required, setRequired] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const editing = !!noticeId

  useEffect(() => {
    if (!noticeId) return
    supabase.from('notices').select('title, body, is_required').eq('id', noticeId).single().then(({ data }) => {
      if (!data) return
      setTitle(data.title)
      setBody(data.body)
      setRequired(data.is_required)
    })
  }, [noticeId])

  if (loading) return <p className="empty">불러오는 중…</p>
  if (!active || !isOwner) return <Navigate to="/notices" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const values = { title: title.trim(), body: body.trim(), is_required: required }
    const { data, error } = editing
      ? await supabase.from('notices').update(values).eq('id', noticeId).select('id').single()
      : await supabase.from('notices').insert({ ...values, store_id: active.store_id }).select('id').single()
    setBusy(false)
    if (error) return setError(toKoreanError(error.message))
    navigate(`/notices/${data.id}`, { replace: true })
  }

  return (
    <main className="page">
      <Link className="back" to={editing ? `/notices/${noticeId}` : '/notices'}>← 취소</Link>
      <h1 className="page-title">{editing ? '공지 수정' : '공지 작성'}</h1>

      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span className="label">제목</span>
          <input className="input" maxLength={60} placeholder="예: 이번 주 금요일 재고 정리" autoFocus
            value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="field">
          <span className="label">내용</span>
          <textarea className="input textarea" rows={6} maxLength={2000}
            value={body} onChange={(e) => setBody(e.target.value)} />
        </label>

        <button type="button" role="switch" aria-checked={required}
          className={`check-card${required ? ' on' : ''}`} onClick={() => setRequired((v) => !v)}>
          <span className="check-box" aria-hidden="true">{required ? '✓' : ''}</span>
          <span>
            <span className="check-title">필독 공지</span>
            <span className="check-desc">직원이 '확인했어요'를 누를 때까지 홈에 배너로 남고, 누가 확인했는지 볼 수 있어요</span>
          </span>
        </button>

        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy || !title.trim()}>
          {busy ? '게시 중…' : editing ? '저장' : '게시'}
        </button>
      </form>
    </main>
  )
}
