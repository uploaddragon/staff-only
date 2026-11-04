import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CodeInput from '../components/CodeInput'
import { supabase, toKoreanError } from '../lib/supabase'
import { useStore } from '../store/StoreProvider'

export default function JoinStore() {
  const navigate = useNavigate()
  const { refresh } = useStore()
  const [code, setCode] = useState('')
  const [storeName, setStoreName] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // 6자리를 다 입력하면 바로 매장 이름을 확인해요
  useEffect(() => {
    setStoreName(null)
    setError('')
    if (code.length !== 6) return
    let cancelled = false
    supabase.rpc('lookup_store_by_code', { p_code: code }).then(({ data, error }) => {
      if (cancelled) return
      if (error) setError(toKoreanError(error.message))
      else if (!data?.length) setError('초대코드에 맞는 매장이 없어요. 숫자를 다시 확인해 주세요.')
      else setStoreName(data[0].store_name)
    })
    return () => {
      cancelled = true
    }
  }, [code])

  const onRequest = async () => {
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('request_join', { p_code: code })
    if (error) {
      setBusy(false)
      return setError(toKoreanError(error.message))
    }
    await refresh()
    navigate('/')
  }

  return (
    <main className="page">
      <Link className="back" to="/">← 뒤로</Link>
      <div>
        <h1 className="page-title">매장 입장</h1>
        <p className="page-sub">점주에게 받은 초대코드 6자리를 입력하세요</p>
      </div>

      <CodeInput value={code} onChange={setCode} autoFocus />

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {storeName && (
        <section className="card stack">
          <p className="muted">이 매장이 맞나요?</p>
          <p className="page-title" style={{ fontSize: 'var(--text-xl)' }}>{storeName}</p>
          <button className="btn btn-primary btn-block" onClick={onRequest} disabled={busy}>
            {busy ? '요청 중…' : '입장 요청'}
          </button>
          <p className="hint">점주가 승인하면 매장에 들어갈 수 있어요.</p>
        </section>
      )}
    </main>
  )
}
