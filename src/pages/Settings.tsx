import { useAuth } from '../auth/AuthProvider'

export default function Settings() {
  const { session, profile, signOut } = useAuth()
  return (
    <main className="page">
      <h1 className="page-title">설정</h1>
      <section className="card">
        <div className="row">
          <div>
            <p style={{ fontWeight: 600 }}>{profile?.display_name ?? '이름 없음'}</p>
            <p className="muted">{session?.user.email}</p>
          </div>
        </div>
      </section>
      <button className="btn btn-ghost btn-block" onClick={signOut}>로그아웃</button>
    </main>
  )
}
