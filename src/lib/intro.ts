const KEY = 'staffonly.introSeen'

/** 서비스 소개를 이미 봤나? (저장소를 못 쓰는 환경이면 봤다고 보고 넘어가요) */
export function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}

export function markIntroSeen() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // 저장 못 해도 이번엔 그냥 넘어가요
  }
}
