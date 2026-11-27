// 사진에서 유통기한 읽기 (Supabase Edge Function, Deno)
// - 앱이 줄인 JPEG 사진(base64)을 보내면 Google Cloud Vision이 글자를 읽고,
//   parse.ts의 규칙으로 그중 유통기한·소비기한 날짜를 골라 YYYY-MM-DD로 돌려줘요.
// - API 키(GOOGLE_VISION_API_KEY)는 Supabase의 Edge Function 비밀값에만 두고, 앱 코드나 Git에는 절대 넣지 않아요.
// - 로그인한 사람만, 횟수 제한(read_expiry_quota: 1인 하루 100번, 전체 한 달 900번)을 지나야 불러요.
//   Cloud Vision 무료 구간(월 1,000장)을 넘지 않게 하려는 거예요.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { pickExpiry } from './parse.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// 사진은 앱에서 1280px 이하 JPEG로 줄여 보내요. 이보다 크면 받지 않아요 (약 3MB)
const MAX_BASE64 = 4_000_000

const QUOTA_MESSAGE: Record<string, string> = {
  daily: '오늘 사진 인식 횟수를 다 썼어요. 날짜를 직접 입력해 주세요.',
  monthly: '이번 달 사진 인식 무료 횟수를 다 썼어요. 다음 달 1일부터 다시 쓸 수 있어요.',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: '지원하지 않는 요청이에요.' }, 405)

  // 로그인한 사람인지 확인해요 (앱이 보낸 로그인 토큰으로)
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return json({ error: '로그인이 필요해요.' }, 401)

  let image = ''
  let today = ''
  try {
    const body = await req.json()
    image = String(body.image ?? '')
    today = /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10)
  } catch {
    return json({ error: '사진을 읽지 못했어요.' }, 400)
  }
  if (!image || image.length > MAX_BASE64) return json({ error: '사진이 없거나 너무 커요.' }, 400)

  const key = Deno.env.get('GOOGLE_VISION_API_KEY')
  if (!key) return json({ error: '사진 인식 설정이 아직 안 됐어요.' }, 500)

  // 횟수 확인 (넘으면 Vision을 부르지 않아요 → 요금이 생기지 않아요)
  const { data: quota, error: quotaError } = await supabase.rpc('read_expiry_quota')
  if (quotaError) return json({ error: '사용량을 확인하지 못했어요.' }, 500)
  if (quota !== 'ok') return json({ error: QUOTA_MESSAGE[quota] ?? QUOTA_MESSAGE.daily }, 429)

  let text = ''
  try {
    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: image },
          features: [{ type: 'TEXT_DETECTION' }],
          imageContext: { languageHints: ['ko', 'en'] },
        }],
      }),
    })
    const data = await res.json()
    if (!res.ok || data.responses?.[0]?.error) {
      const status = data.error?.status ?? data.responses?.[0]?.error?.status
      // 키가 틀렸거나(INVALID_ARGUMENT), API를 안 켰거나 결제 계정이 없으면(PERMISSION_DENIED) 전체 요청이 실패해요
      const setupProblem = status === 'PERMISSION_DENIED' || (status === 'INVALID_ARGUMENT' && data.error)
      if (setupProblem) return json({ error: '사진 인식 설정을 확인해 주세요 (Vision API 키·사용 설정).' }, 500)
      if (status === 'RESOURCE_EXHAUSTED') return json({ error: '지금 요청이 많아요. 잠시 후 다시 찍어 주세요.' }, 429)
      return json({ error: '사진 인식 서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' }, 502)
    }
    text = data.responses?.[0]?.fullTextAnnotation?.text ?? data.responses?.[0]?.textAnnotations?.[0]?.description ?? ''
  } catch {
    return json({ error: '사진 인식 서버에 연결하지 못했어요.' }, 502)
  }

  if (!text.trim()) return json({ found: false, note: '글자를 찾지 못했어요. 날짜 부분이 잘 보이게 가까이 찍어 주세요.' })
  const picked = pickExpiry(text, today)
  if (picked.iso === null) return json({ found: false, note: picked.note })
  return json({ found: true, expiry: picked.iso, raw_text: picked.raw })
})
