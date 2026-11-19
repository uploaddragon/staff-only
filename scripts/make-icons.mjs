// 앱 아이콘 PNG를 브랜드 로고(public/brand/logo-inverse.svg)로 만들어요.
// 실행: node scripts/make-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const svg = readFileSync('public/brand/logo-inverse.svg', 'utf8')

// maskable(안드로이드 둥근·물방울 아이콘): 잘려도 로고가 남도록 바깥에 여백을 더해요
const maskable = svg
  .replace('viewBox="18 18 72 72"', 'viewBox="9 9 90 90"')
  .replace(/(<svg[^>]*>)/, '$1<rect x="0" y="0" width="108" height="108" fill="#111111"/>')

const render = (source, size, out) => {
  const png = new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng()
  writeFileSync(out, png)
  console.log(`${out} (${size}px)`)
}

render(svg, 192, 'public/icon-192.png')
render(svg, 512, 'public/icon-512.png')
render(svg, 180, 'public/apple-touch-icon.png')
render(maskable, 512, 'public/icon-maskable-512.png')
