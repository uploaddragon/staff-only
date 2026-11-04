/** .env가 없을 때 보이는 안내 화면 */
export default function SetupNeeded() {
  return (
    <main className="auth">
      <h1 className="page-title">Supabase 연결이 필요해요</h1>
      <div className="card" style={{ lineHeight: 1.7 }}>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li><code>.env.example</code>을 복사해서 <code>.env</code>로 이름을 바꿔요.</li>
          <li>Supabase의 Project URL과 anon key를 붙여넣어요.</li>
          <li>개발 서버를 껐다가 다시 켜요 (<code>npm run dev</code>).</li>
        </ol>
      </div>
    </main>
  )
}
