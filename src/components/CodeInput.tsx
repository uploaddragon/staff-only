import { useState } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

/**
 * 6칸 초대코드 입력. 실제 입력칸은 하나(투명)라서 붙여넣기·지우기가 자연스럽고,
 * 화면에는 6칸으로 보여요.
 */
export default function CodeInput({ value, onChange, autoFocus }: Props) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="code-boxes">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className={`code-box${focused && i === Math.min(value.length, 5) ? ' focus' : ''}`}
          aria-hidden="true"
        >
          {value[i] ?? ''}
        </div>
      ))}
      <input
        className="code-input"
        aria-label="초대코드 6자리"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus={autoFocus}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      />
    </div>
  )
}
