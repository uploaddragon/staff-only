import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, toKoreanError } from '../lib/supabase'
import { useStore } from '../store/StoreProvider'

export default function CreateStore() {
  const navigate = useNavigate()
  const { refresh, selectStore } = useStore()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<{ name: string; invite_code: string } | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { data, error } = await supabase.rpc('create_store', { p_name: name })
    setBusy(false)
    if (error) return setError(toKoreanError(error.message))
    selectStore(data.id)
    await refresh()
    setCreated({ name: data.name, invite_code: data.invite_code })
  }

  if (created) {
    return (
      <main className="page">
        <h1 className="page-title">매장을 만들었어요</h1>
        <section className="card stack">
          <p className="muted center">{created.name} 초대코드</p>
          <p className="invite-code">{created.invite_code}</p>
          <p className="hint center">알바에게 이 코드를 알려주세요. 설정 → 매장 관리에서 다시 볼 수 있어요.</p>
        </section>
        <button className="btn btn-primary btn-block" onClick={() => navigate('/')}>홈으로</button>
      </main>
    )
  }

  return (
    <main className="page">
      <Link className="back" to="/">← 뒤로</Link>
      <div>
        <h1 className="page-title">매장 만들기</h1>
        <p className="page-sub">점주가 한 번만 만들면 돼요</p>
      </div>
      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span className="label">매장 이름</span>
          <input className="input" placeholder="예: GS더프레시 ○○점" maxLength={30} autoFocus
            value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy || !name.trim()}>
          {busy ? '만드는 중…' : '매장 만들기'}
        </button>
      </form>
    </main>
  )
}
