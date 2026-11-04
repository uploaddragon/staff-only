import type { Ref } from 'react'
import { formatLong, parseYYMMDD, todaySeoul } from '../lib/dates'

type Props = {
  value: string
  onChange: (value: string) => void
  onEnter?: () => void
  inputRef?: Ref<HTMLInputElement>
  label?: string
  autoFocus?: boolean
}

/** 유통기한 6자리(YYMMDD) 입력. 숫자 키패드가 뜨고, 아래에 읽은 날짜를 보여줘요. */
export default function ExpiryInput({ value, onChange, onEnter, inputRef, label = '유통기한', autoFocus }: Props) {
  const iso = parseYYMMDD(value)
  const past = iso !== null && iso < todaySeoul()

  let hint = '숫자 6자리 (예: 261203)'
  let tone = ''
  if (value.length === 6) {
    if (!iso) {
      hint = '없는 날짜예요. 다시 확인해 주세요.'
      tone = ' hint-error'
    } else {
      hint = formatLong(iso) + (past ? ' · 이미 지난 날짜예요' : '')
      tone = past ? ' hint-warn' : ' hint-ok'
    }
  }

  return (
    <label className="field">
      <span className="label">{label}</span>
      <input
        ref={inputRef}
        className="input input-date"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        maxLength={6}
        placeholder="YYMMDD"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onEnter?.()
          }
        }}
      />
      <span className={`hint${tone}`}>{hint}</span>
    </label>
  )
}
