import { useRef, useState, type Ref } from 'react'
import { formatLong, parseYYMMDD, todaySeoul, toYYMMDD } from '../lib/dates'
import { readExpiryFromPhoto } from '../lib/readExpiry'
import Icon from './Icon'

type Props = {
  value: string
  onChange: (value: string) => void
  onEnter?: () => void
  inputRef?: Ref<HTMLInputElement>
  label?: string
  autoFocus?: boolean
}

/**
 * 유통기한 6자리(YYMMDD) 입력. 숫자 키패드가 뜨고, 아래에 읽은 날짜를 보여줘요.
 * 카메라 버튼으로 포장 사진을 찍으면 날짜를 읽어 미리 채워요 (사람이 확인한 뒤 저장).
 */
export default function ExpiryInput({ value, onChange, onEnter, inputRef, label = '유통기한', autoFocus }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState(false)
  const [photo, setPhoto] = useState<{ value: string; raw: string } | null>(null) // 사진에서 읽은 값
  const [photoError, setPhotoError] = useState('')
  const iso = parseYYMMDD(value)
  const past = iso !== null && iso < todaySeoul()
  const fromPhoto = photo !== null && photo.value === value // 직접 고치면 사진 안내는 사라져요

  let hint = '숫자 6자리 (예: 261203) · 카메라로 찍어도 돼요'
  let tone = ''
  if (reading) hint = '사진에서 날짜를 읽는 중…'
  else if (photoError) {
    hint = photoError
    tone = ' hint-error'
  } else if (value.length === 6) {
    if (!iso) {
      hint = '없는 날짜예요. 다시 확인해 주세요.'
      tone = ' hint-error'
    } else {
      hint = formatLong(iso) + (past ? ' · 이미 지난 날짜예요' : '')
      tone = past ? ' hint-warn' : ' hint-ok'
    }
  }

  const onPhoto = async (file: File | undefined) => {
    if (!file) return
    setReading(true)
    setPhotoError('')
    const result = await readExpiryFromPhoto(file)
    setReading(false)
    if (!result.ok) return setPhotoError(result.message)
    const next = toYYMMDD(result.iso)
    setPhoto({ value: next, raw: result.raw })
    onChange(next)
  }

  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="expiry-row">
        <input
          ref={inputRef}
          className="input input-date"
          aria-label={label}
          inputMode="numeric"
          pattern="[0-9]*"
          enterKeyHint="done"
          maxLength={6}
          placeholder="YYMMDD"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            setPhotoError('')
            onChange(e.target.value.replace(/\D/g, '').slice(0, 6))
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onEnter?.()
            }
          }}
        />
        <button type="button" className="btn btn-ghost camera-btn" disabled={reading}
          aria-label="사진으로 유통기한 읽기" onClick={() => fileRef.current?.click()}>
          {reading ? <span className="spinner" aria-hidden="true" /> : <Icon name="camera" size={22} />}
        </button>
        {/* capture: 폰에서는 바로 후면 카메라가 열려요 */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
          onChange={(e) => {
            onPhoto(e.target.files?.[0])
            e.target.value = '' // 같은 사진을 다시 골라도 동작하게
          }} />
      </div>
      <span className={`hint${tone}`} aria-live="polite">{hint}</span>
      {fromPhoto && !reading && (
        <p className="alert alert-warn photo-check">
          📷 사진에서 읽은 날짜예요{photo.raw ? ` ("${photo.raw}")` : ''}. 포장과 같은지 꼭 확인해 주세요.
        </p>
      )}
    </div>
  )
}
