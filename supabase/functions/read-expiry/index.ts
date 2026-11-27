// 사진에서 유통기한 읽기 (Supabase Edge Function, Deno)
// - 앱이 줄인 JPEG 사진(base64)을 보내면 Claude가 포장에 찍힌 유통기한·소비기한을 찾아 YYYY-MM-DD로 돌려줘요.
// - API 키(ANTHROPIC_API_KEY)는 Supabase의 Edge Function 비밀값에만 두고, 앱 코드나 Git에는 절대 넣지 않아요.
// - 로그인한 사람만, 하루 횟수 제한(read_expiry_quota)을 지나야 불러요.
import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// 사진은 앱에서 1280px 이하 JPEG로 줄여 보내요. 이보다 크면 받지 않아요 (약 3MB)
const MAX_BASE64 = 4_000_000

const SCHEMA = {
  type: 'object',
  properties: {
    found: { type: 'boolean', description: '유통기한 또는 소비기한 날짜를 읽었으면 true' },
    expiry: { type: 'string', description: '읽은 날짜 YYYY-MM-DD. 못 찾았으면 빈 문자열' },
    raw_text: { type: 'string', description: '포장에 찍힌 날짜 글자 그대로. 못 찾았으면 빈 문자열' },
    note: { type: 'string', description: '못 찾았거나 애매할 때 짧은 한국어 이유. 아니면 빈 문자열' },
  },
  required: ['found', 'expiry', 'raw_text', 'note'],
  additionalProperties: false,
}

const prompt = (today: string) => `한국 마트·편의점 상품 포장 사진이에요. 포장에 인쇄된 유통기한(또는 소비기한) 날짜를 찾아 주세요.

규칙:
- "유통기한", "소비기한", "까지", "EXP", "BEST BEFORE" 옆의 날짜가 답이에요.
- "제조일자", "제조", "MFG", "PROD"처럼 만든 날짜는 답이 아니에요. 제조일만 보이면 found=false로 하고 note에 "제조일만 보여요"라고 적어 주세요.
- 연도가 두 자리면 20을 붙여요 (26.12.15 → 2026-12-15). 8자리 숫자(20261215)도 날짜예요.
- 날짜가 여러 개면 유통기한·소비기한 표시에 가장 가까운 것을 골라요.
- 흐리거나 잘려서 확실하지 않은 숫자는 추측하지 말고 found=false로 해 주세요.
- 오늘은 ${today}예요. 날짜 계산에 참고만 하세요.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: '지원하지 않는 요청이에요.' }, 405)

  // 로그인한 사람인지 확인해요 (앱이 보낸 로그인 토큰으로)
  const auth = req.headers.get('Authorization') ?? ''
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
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

  // 하루 사용 횟수 확인 (넘으면 내일 다시)
  const { data: allowed, error: quotaError } = await supabase.rpc('read_expiry_quota')
  if (quotaError) return json({ error: '사용량을 확인하지 못했어요.' }, 500)
  if (!allowed) return json({ error: '오늘 사진 인식 횟수를 다 썼어요. 날짜를 직접 입력해 주세요.' }, 429)

  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 2000,
      // 정책상 거절되면 같은 요청을 다른 모델로 자동으로 다시 시도해요
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: prompt(today) },
          ],
        },
      ],
    })

    if (response.stop_reason === 'refusal') return json({ found: false, note: '이 사진은 읽을 수 없어요.' })
    const text = response.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text') return json({ found: false, note: '날짜를 찾지 못했어요.' })
    const result = JSON.parse(text.text) as { found: boolean; expiry: string; raw_text: string; note: string }

    // 형식이 이상하면 못 찾은 걸로 처리해요 (앱에서도 한 번 더 확인해요)
    if (!result.found || !/^\d{4}-\d{2}-\d{2}$/.test(result.expiry)) {
      return json({ found: false, note: result.note || '날짜를 찾지 못했어요.' })
    }
    return json({ found: true, expiry: result.expiry, raw_text: result.raw_text })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: '지금 요청이 많아요. 잠시 후 다시 찍어 주세요.' }, 429)
    if (e instanceof Anthropic.AuthenticationError) return json({ error: '사진 인식 설정이 아직 안 됐어요.' }, 500)
    if (e instanceof Anthropic.APIError) return json({ error: '사진 인식 서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' }, 502)
    return json({ error: '사진을 읽지 못했어요.' }, 500)
  }
})
