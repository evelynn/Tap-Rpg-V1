// 시험용 최소 PNG 인코더. 검사기 본체는 쓰지 않는다(시험 입력을 코드로 만들기 위한 것).
import { deflateSync } from 'node:zlib'

export interface EncodeOptions {
  width: number
  height: number
  /** 0 회색 · 2 RGB · 3 인덱스 · 6 RGBA */
  colorType: 0 | 2 | 3 | 6
  bitDepth?: number
  /** 표본 바이트. 색 타입에 맞춘 원시값(인덱스 PNG면 인덱스) */
  samples: number[]
  /** 인덱스 PNG의 PLTE. [r, g, b] 목록 */
  palette?: number[][]
  /** 인덱스 PNG의 tRNS */
  trns?: number[]
  /** 행마다 쓸 필터 번호. 적지 않으면 전부 0 */
  filters?: number[]
  interlace?: number
}

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

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 6: 4 }

export function encodePng(o: EncodeOptions): Uint8Array {
  const bitDepth = o.bitDepth ?? 8
  if (bitDepth !== 8) throw new Error('시험 인코더는 8비트만 만든다')
  const channels = CHANNELS[o.colorType]!
  const stride = o.width * channels
  if (o.samples.length !== stride * o.height) {
    throw new Error(`표본 수 ${o.samples.length}가 ${stride * o.height}와 다르다`)
  }

  const raw = new Uint8Array((stride + 1) * o.height)
  for (let y = 0; y < o.height; y++) {
    const filter = o.filters?.[y] ?? 0
    raw[y * (stride + 1)] = filter
    for (let x = 0; x < stride; x++) {
      const v = o.samples[y * stride + x]!
      const a = x >= channels ? o.samples[y * stride + x - channels]! : 0
      const b = y > 0 ? o.samples[(y - 1) * stride + x]! : 0
      const c = x >= channels && y > 0 ? o.samples[(y - 1) * stride + x - channels]! : 0
      let f: number
      switch (filter) {
        case 0: f = v; break
        case 1: f = v - a; break
        case 2: f = v - b; break
        case 3: f = v - ((a + b) >> 1); break
        case 4: f = v - paeth(a, b, c); break
        default: throw new Error(`모르는 필터 ${filter}`)
      }
      raw[y * (stride + 1) + 1 + x] = f & 0xff
    }
  }

  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, o.width)
  view.setUint32(4, o.height)
  ihdr[8] = bitDepth
  ihdr[9] = o.colorType
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = o.interlace ?? 0

  const parts: Uint8Array[] = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
  ]
  if (o.palette !== undefined) {
    parts.push(chunk('PLTE', new Uint8Array(o.palette.flat())))
  }
  if (o.trns !== undefined) {
    parts.push(chunk('tRNS', new Uint8Array(o.trns)))
  }
  parts.push(chunk('IDAT', deflateSync(raw)))
  parts.push(chunk('IEND', new Uint8Array(0)))
  return Buffer.concat(parts)
}

/** RGBA 화소 배열([r,g,b,a] × width*height)로 PNG를 만든다 */
export function rgbaPng(width: number, height: number, pixels: number[]): Uint8Array {
  return encodePng({ width, height, colorType: 6, samples: pixels })
}

/** 한 색으로 채운 칸들을 그리는 편의 함수. cells[i] = [x, y, w, h, r, g, b, a] */
export function canvas(width: number, height: number): {
  fill(x: number, y: number, w: number, h: number, rgba: [number, number, number, number]): void
  png(filters?: number[]): Uint8Array
  samples: number[]
} {
  const samples = new Array<number>(width * height * 4).fill(0)
  return {
    samples,
    fill(x, y, w, h, rgba) {
      for (let j = y; j < y + h; j++) {
        for (let i = x; i < x + w; i++) {
          const o = (j * width + i) * 4
          samples[o] = rgba[0]
          samples[o + 1] = rgba[1]
          samples[o + 2] = rgba[2]
          samples[o + 3] = rgba[3]
        }
      }
    },
    png(filters) {
      return encodePng({ width, height, colorType: 6, samples, filters })
    },
  }
}
