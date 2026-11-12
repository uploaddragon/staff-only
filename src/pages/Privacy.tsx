import { Link } from 'react-router-dom'

const CONTACT_EMAIL = 'uploaddragon0723@gmail.com'
const EFFECTIVE_DATE = '2026년 11월 12일'

/** 개인정보처리방침 (로그인 없이 볼 수 있어요. 구글·카카오 로그인 앱 등록에 필요해요) */
export default function Privacy() {
  return (
    <main className="page legal">
      <Link className="back" to="/">← 스태프온리</Link>
      <div>
        <h1 className="page-title">개인정보처리방침</h1>
        <p className="page-sub">시행일 {EFFECTIVE_DATE}</p>
      </div>

      <section className="card stack">
        <p>
          스태프온리(이하 "서비스")는 매장 점주와 직원이 매대 상품의 유통기한과 매장 공지를 함께 관리하는 서비스예요.
          서비스는 이용자의 개인정보를 소중히 여기며, 아래와 같이 처리해요.
        </p>
      </section>

      <section className="card stack">
        <h2 className="section-title">1. 수집하는 정보</h2>
        <ul>
          <li><b>계정 정보:</b> 이메일 주소, 이름(매장에서 보일 이름), 가입 유형(점주/직원)</li>
          <li><b>소셜 로그인 정보:</b> 구글·카카오로 로그인하면 해당 서비스가 제공하는 이름(닉네임), 이메일, 프로필 사진 주소, 계정 식별값</li>
          <li><b>서비스 이용 정보:</b> 소속 매장과 역할, 근무 요일, 등록한 상품·유통기한·메모, 처리 기록(누가·언제·무엇을 처리했는지), 공지와 공지 확인 기록</li>
          <li><b>자동 생성 정보:</b> 로그인 시각 등 인증 기록</li>
        </ul>
      </section>

      <section className="card stack">
        <h2 className="section-title">2. 이용 목적</h2>
        <ul>
          <li>회원 식별과 로그인</li>
          <li>매장 입장 요청·승인 등 매장 멤버 관리</li>
          <li>유통기한 임박 상품 안내, 처리 기록과 인수인계</li>
          <li>공지 전달과 확인 여부 표시</li>
        </ul>
        <p>광고나 마케팅에 사용하지 않고, 판매하지 않아요.</p>
      </section>

      <section className="card stack">
        <h2 className="section-title">3. 다른 사람에게 보이는 정보</h2>
        <p>
          같은 매장의 승인된 멤버끼리는 이름, 처리 기록, 공지를 볼 수 있어요.
          점주는 직원의 근무 요일과 공지 확인 여부를 볼 수 있어요. 다른 매장 사람은 볼 수 없어요.
        </p>
      </section>

      <section className="card stack">
        <h2 className="section-title">4. 처리 위탁과 국외 이전</h2>
        <p>서비스 운영을 위해 아래 업체의 서비스를 이용해요.</p>
        <ul>
          <li><b>Supabase Inc.</b> — 회원 인증과 데이터베이스 보관 (데이터 보관 위치: 호주 시드니 리전)</li>
          <li><b>Vercel Inc.</b> — 웹 서비스 제공(호스팅)</li>
          <li><b>Google LLC, (주)카카오</b> — 이용자가 선택한 경우 소셜 로그인</li>
        </ul>
        <p>정보는 서비스 이용 중 인터넷을 통해 위 업체의 서버로 전송·보관돼요.</p>
      </section>

      <section className="card stack">
        <h2 className="section-title">5. 보관 기간과 파기</h2>
        <p>
          회원 탈퇴를 요청하면 계정 정보를 지체 없이 삭제해요. 다만 매장 운영 기록(처리 기록 등)은 매장의 인수인계를 위해
          작성자 이름이 지워진 상태로 남을 수 있어요. 점주가 매장이나 매대·공지를 삭제하면 관련 정보도 함께 삭제돼요.
        </p>
      </section>

      <section className="card stack">
        <h2 className="section-title">6. 이용자의 권리</h2>
        <p>
          이용자는 언제든 자신의 개인정보 열람·수정·삭제와 처리 정지를 요청할 수 있어요.
          이름과 가입 유형은 앱의 설정 화면에서 직접 바꿀 수 있고, 그 밖의 요청은 아래 연락처로 보내 주세요.
        </p>
      </section>

      <section className="card stack">
        <h2 className="section-title">7. 안전성 확보 조치</h2>
        <ul>
          <li>모든 통신은 HTTPS로 암호화해요.</li>
          <li>데이터베이스 행 단위 접근 제어(RLS)로 같은 매장의 승인된 멤버만 매장 정보를 볼 수 있게 해요.</li>
          <li>비밀번호는 인증 서비스(Supabase Auth)가 암호화해 보관하며 서비스 운영자도 볼 수 없어요.</li>
        </ul>
      </section>

      <section className="card stack">
        <h2 className="section-title">8. 문의</h2>
        <p>개인정보 보호 책임자: 스태프온리 운영자</p>
        <p>이메일: <a className="link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        <p className="hint">이 방침이 바뀌면 시행일과 함께 이 페이지에 알려 드려요.</p>
      </section>
    </main>
  )
}
