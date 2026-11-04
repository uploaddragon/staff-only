// 임시 앱 아이콘(초록 배경 + 흰 체크) PNG를 만들어요. 실행: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

// 점 p에서 선분 a-b까지의 거리
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function makeIcon(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  const stroke = size * 0.075
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size
      const d = Math.min(
        segDist(u, v, 0.28, 0.52, 0.43, 0.67),
        segDist(u, v, 0.43, 0.67, 0.73, 0.35),
      ) * size
      const a = Math.max(0, Math.min(1, stroke - d + 0.5)) // 안티앨리어싱
      const i = y * (size * 4 + 1) + 1 + x * 4
      raw[i] = Math.round(0x16 + (255 - 0x16) * a)
      raw[i + 1] = Math.round(0xa3 + (255 - 0xa3) * a)
      raw[i + 2] = Math.round(0x4a + (255 - 0x4a) * a)
      raw[i + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) writeFileSync(`public/icon-${size}.png`, makeIcon(size))
console.log('public/icon-192.png, public/icon-512.png 생성 완료')
