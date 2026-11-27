import { useCallback, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'

/**
 * 화면 안내(코치마크)를 봤는지 기기에 기억해요. 계정마다 따로예요.
 * - start-owner / start-staff: 가입 직후, 아직 매장이 없을 때
 * - home-owner / home-staff: 매장에 처음 들어갔을 때 홈
 */
export type TourName = 'start-owner' | 'start-staff' | 'home-owner' | 'home-staff'

const key = (userId: string, name: TourName) => `staffonly.tour.${userId}.${name}`

export function hasSeenTour(userId: string, name: TourName) {
  try {
    return localStorage.getItem(key(userId, name)) === '1'
  } catch {
    return true // 저장소를 못 쓰면 매번 뜨지 않게 봤다고 봐요
  }
}

export function markTourSeen(userId: string, name: TourName) {
  try {
    localStorage.setItem(key(userId, name), '1')
  } catch {
    // 무시
  }
}

export function resetTour(userId: string, name: TourName) {
  try {
    localStorage.removeItem(key(userId, name))
  } catch {
    // 무시
  }
}

/** 이 안내를 보여줘야 하나? 끝내면 다시 안 보여요 */
export function useTour(name: TourName, ready: boolean) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [closed, setClosed] = useState(false)
  const show = ready && !!userId && !closed && !hasSeenTour(userId, name)
  const finish = useCallback(() => {
    if (userId) markTourSeen(userId, name)
    setClosed(true)
  }, [userId, name])
  return { show, finish }
}
