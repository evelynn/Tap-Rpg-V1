// PNG 최소 기록기 — Node 22 내장 모듈(node:zlib)만 쓴다.
// 정규화 결과(게임 규격 파일)는 인덱스 색 PNG(인덱스 0 = 완전 투명, ASSET_ORDERS 0.1절·A1),
// 검수용 확대본은 RGBA PNG로 쓴다.
import { deflateSync } from 'node:zlib'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

function ihdr(width: number, height: number, colorType: number): Uint8Array {
  const d = new Uint8Array(13)
  const v = new DataView(d.buffer)
  v.setUint32(0, width)
  v.setUint32(4, height)
  d[8] = 8
  d[9] = colorType
  return d
}

// 행마다 필터 0(없음)과 2(위)를 비교해 절댓값 합이 작은 쪽을 쓴다. 넓은 단색 면이 많아 이것으로 충분하다.
function filterRows(data: Uint8Array, height: number, stride: number): Uint8Array {
  const raw = new Uint8Array((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    const cur = y * stride
    let sumNone = 0
    let sumUp = 0
    for (let x = 0; x < stride; x++) {
      const v = data[cur + x]!
      const up = y > 0 ? (v - data[cur - stride + x]!) & 0xff : v
      sumNone += v < 128 ? v : 256 - v
      sumUp += up < 128 ? up : 256 - up
    }
    const useUp = y > 0 && sumUp < sumNone
    const o = y * (stride + 1)
    raw[o] = useUp ? 2 : 0
    for (let x = 0; x < stride; x++) {
      const v = data[cur + x]!
      raw[o + 1 + x] = useUp ? (v - data[cur - stride + x]!) & 0xff : v
    }
  }
  return raw
}

function assemble(parts: Uint8Array[]): Uint8Array {
  return Buffer.concat([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ...parts])
}

/** 8비트 RGBA PNG(색 타입 6). rgba = width*height*4 바이트 */
export function encodeRgbaPng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  if (rgba.length !== width * height * 4) throw new Error(`화소 길이 ${rgba.length}가 ${width}×${height}×4와 다르다`)
  const raw = filterRows(rgba, height, width * 4)
  return assemble([chunk('IHDR', ihdr(width, height, 6)), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))])
}

/**
 * 8비트 인덱스 PNG(색 타입 3). 알파가 0·255 두 값뿐이어야 한다.
 * 인덱스 0 = (0,0,0,0) 완전 투명, 1부터 불투명 색을 처음 나온 순서대로 배정한다. 불투명 색이 255개를 넘으면 거절한다.
 */
export function encodeIndexedPng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  if (rgba.length !== width * height * 4) throw new Error(`화소 길이 ${rgba.length}가 ${width}×${height}×4와 다르다`)
  const index = new Map<number, number>()
  const palette: number[] = [0, 0, 0]
  const data = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const a = rgba[i * 4 + 3]!
    if (a === 0) continue
    if (a !== 255) throw new Error(`인덱스 PNG는 알파 0·255만 담는다(화소 ${i}의 알파 ${a})`)
    const key = (rgba[i * 4]! << 16) | (rgba[i * 4 + 1]! << 8) | rgba[i * 4 + 2]!
    let idx = index.get(key)
    if (idx === undefined) {
      idx = index.size + 1
      if (idx > 255) throw new Error('불투명 색이 255개를 넘어 인덱스 PNG로 쓸 수 없다')
      index.set(key, idx)
      palette.push(rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!)
    }
    data[i] = idx
  }
  const raw = filterRows(data, height, width)
  return assemble([
    chunk('IHDR', ihdr(width, height, 3)),
    chunk('PLTE', new Uint8Array(palette)),
    chunk('tRNS', new Uint8Array([0])),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ])
}
