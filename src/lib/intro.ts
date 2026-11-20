const KEY = 'staffonly.introSeen'

/**
 * 이번 방문에서 서비스 소개를 이미 봤나?
 * 로그인(게스트 포함)이 안 된 채로 앱을 열면 항상 소개부터 보여줘요.
 * 소개 → 로그인 화면으로 넘어간 뒤 같은 방문 안에서는 다시 소개로 돌려보내지 않아요.
 * (sessionStorage라서 앱·탭을 닫으면 지워져요. 저장소를 못 쓰는 환경이면 봤다고 보고 넘어가요)
 */
export function hasSeenIntro(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}

export function markIntroSeen() {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    // 저장 못 해도 이번엔 그냥 넘어가요
  }
}

/** 로그아웃하면 다음 화면도 소개부터 */
export function resetIntro() {
  try {
    sessionStorage.removeItem(KEY)
    localStorage.removeItem(KEY) // 예전 버전이 남긴 값
  } catch {
    // 무시
  }
}
