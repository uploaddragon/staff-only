import { addDays, todaySeoul } from './dates'
import { supabase } from './supabase'

export type ReadExpiryResult = { ok: true; iso: string; raw: string } | { ok: false; message: string }

const MAX_SIDE = 1280 // 글자는 충분히 읽히고 전송은 가볍게

/** 사진을 긴 변 1280px JPEG로 줄여 base64로 바꿔요 (폰 사진은 수 MB라 그대로 보내면 느려요) */
async function toJpegBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}

/**
 * 사진에서 유통기한을 읽어요 (서버 함수 read-expiry → Claude).
 * 읽은 날짜는 입력칸에 미리 채울 뿐이고, 저장 전에 사람이 꼭 확인해요.
 */
export async function readExpiryFromPhoto(file: File): Promise<ReadExpiryResult> {
  let image: string
  try {
    image = await toJpegBase64(file)
  } catch {
    return { ok: false, message: '사진을 열지 못했어요. 다시 찍어 주세요.' }
  }

  const today = todaySeoul()
  const { data, error } = await supabase.functions.invoke('read-expiry', { body: { image, today } })
  if (error) {
    // 서버가 보낸 한국어 안내가 있으면 그대로 보여줘요
    let message = '사진을 읽지 못했어요. 날짜를 직접 입력해 주세요.'
    try {
      const body = await (error as { context?: Response }).context?.json()
      if (body?.error) message = body.error
    } catch {
      // 기본 안내 사용
    }
    return { ok: false, message }
  }

  if (!data?.found) return { ok: false, message: data?.note || '날짜를 찾지 못했어요. 날짜가 잘 보이게 가까이 찍어 주세요.' }
  const iso = String(data.expiry)
  // 터무니없는 날짜는 버려요 (2년 전 ~ 10년 뒤만)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso < addDays(today, -730) || iso > addDays(today, 3650)) {
    return { ok: false, message: '날짜를 확실히 읽지 못했어요. 직접 입력해 주세요.' }
  }
  return { ok: true, iso, raw: String(data.raw_text ?? '') }
}
