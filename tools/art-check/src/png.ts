// PNG 최소 해석기 — Node 22 내장 모듈(node:zlib)만 쓴다.
// 시그니처 → IHDR → PLTE·tRNS → IDAT inflate → 스캔라인 필터 복원 → 8비트 RGBA 정규화.
// Adam7 인터레이스는 지원하지 않는다(에셋 규격에서 쓰지 않는다).
import { inflateSync } from 'node:zlib'

export interface PngImage {
  width: number
  height: number
  bitDepth: number
  colorType: number
  /** PLTE 색 수. 인덱스 PNG가 아니면 0 */
  paletteSize: number
  hasTrns: boolean
  /** width * height * 4 바이트. 8비트 RGBA로 정규화한 화소 */
  rgba: Uint8Array
}

export class PngError extends Error {
  override name = 'PngError'
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
// 색 타입 → 화소당 표본 수
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }
// 회색 비트깊이 → 0~255 확대 계수
const GRAY_SCALE: Record<number, number> = { 1: 255, 2: 85, 4: 17, 8: 1 }

function u32(b: Uint8Array, o: number): number {
  return ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0
}

function chunkType(b: Uint8Array, o: number): string {
  return String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!)
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

// 스캔라인 필터를 행 단위로 되돌린다. raw = (1 + stride) * height 바이트
function unfilter(raw: Uint8Array, height: number, stride: number, bpp: number): Uint8Array {
  const out = new Uint8Array(height * stride)
  let pos = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[pos]!
    pos += 1
    const line = pos
    const cur = y * stride
    const prev = cur - stride
    for (let x = 0; x < stride; x++) {
      const v = raw[line + x]!
      const a = x >= bpp ? out[cur + x - bpp]! : 0
      const b = y > 0 ? out[prev + x]! : 0
      const c = x >= bpp && y > 0 ? out[prev + x - bpp]! : 0
      let r: number
      switch (filter) {
        case 0: r = v; break
        case 1: r = v + a; break
        case 2: r = v + b; break
        case 3: r = v + ((a + b) >> 1); break
        case 4: r = v + paeth(a, b, c); break
        default: throw new PngError(`알 수 없는 스캔라인 필터 ${filter}(행 ${y})`)
      }
      out[cur + x] = r & 0xff
    }
    pos += stride
  }
  return out
}

// 한 행의 표본을 원값 그대로 꺼낸다(비트깊이 1·2·4·8·16 지원)
function readSamples(line: Uint8Array, count: number, bitDepth: number): Uint16Array {
  const out = new Uint16Array(count)
  if (bitDepth === 8) {
    for (let i = 0; i < count; i++) out[i] = line[i]!
    return out
  }
  if (bitDepth === 16) {
    for (let i = 0; i < count; i++) out[i] = (line[i * 2]! << 8) | line[i * 2 + 1]!
    return out
  }
  const mask = (1 << bitDepth) - 1
  const per = 8 / bitDepth
  for (let i = 0; i < count; i++) {
    const byte = line[Math.floor(i / per)]!
    const shift = 8 - bitDepth * ((i % per) + 1)
    out[i] = (byte >> shift) & mask
  }
  return out
}

export function decodePng(buf: Uint8Array): PngImage {
  if (buf.length < 8) throw new PngError('파일이 8바이트보다 짧다')
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== SIGNATURE[i]) throw new PngError('PNG 시그니처가 아니다')
  }

  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = -1
  let interlace = 0
  let plte: Uint8Array | null = null
  let trns: Uint8Array | null = null
  const idat: Uint8Array[] = []
  let sawIhdr = false
  let off = 8

  while (off + 8 <= buf.length) {
    const len = u32(buf, off)
    const type = chunkType(buf, off + 4)
    if (off + 12 + len > buf.length) throw new PngError(`청크 ${type}의 길이 ${len}이 파일 끝을 넘는다`)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      if (len !== 13) throw new PngError(`IHDR 길이가 ${len}이다(13이어야 한다)`)
      width = u32(data, 0)
      height = u32(data, 4)
      bitDepth = data[8]!
      colorType = data[9]!
      interlace = data[12]!
      sawIhdr = true
    } else if (type === 'PLTE') {
      plte = data
    } else if (type === 'tRNS') {
      trns = data
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    off += 12 + len
  }

  if (!sawIhdr) throw new PngError('IHDR 청크가 없다')
  if (width <= 0 || height <= 0) throw new PngError(`크기가 잘못됐다: ${width}×${height}`)
  if (interlace !== 0) throw new PngError('Adam7 인터레이스 PNG는 지원하지 않는다')
  const channels = CHANNELS[colorType]
  if (channels === undefined) throw new PngError(`알 수 없는 색 타입 ${colorType}`)
  if (colorType === 3 && plte === null) throw new PngError('인덱스 PNG인데 PLTE 청크가 없다')
  if (idat.length === 0) throw new PngError('IDAT 청크가 없다')

  const raw = inflateSync(Buffer.concat(idat))
  const bitsPerPixel = channels * bitDepth
  const stride = Math.ceil((width * bitsPerPixel) / 8)
  const bpp = Math.max(1, Math.ceil(bitsPerPixel / 8))
  const need = (stride + 1) * height
  if (raw.length < need) throw new PngError(`IDAT 길이가 모자라다: ${raw.length} < ${need}`)

  const lines = unfilter(raw, height, stride, bpp)
  const rgba = new Uint8Array(width * height * 4)
  const grayScale = GRAY_SCALE[bitDepth] ?? 1
  const paletteSize = plte === null ? 0 : Math.floor(plte.length / 3)

  for (let y = 0; y < height; y++) {
    const line = lines.subarray(y * stride, (y + 1) * stride)
    const samples = readSamples(line, width * channels, bitDepth)
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      const s = x * channels
      if (colorType === 3) {
        const idx = samples[s]!
        if (idx >= paletteSize) throw new PngError(`팔레트 인덱스 ${idx}가 PLTE 범위를 넘는다`)
        rgba[o] = plte![idx * 3]!
        rgba[o + 1] = plte![idx * 3 + 1]!
        rgba[o + 2] = plte![idx * 3 + 2]!
        rgba[o + 3] = trns !== null && idx < trns.length ? trns[idx]! : 255
      } else if (colorType === 0 || colorType === 4) {
        const v = bitDepth === 16 ? samples[s]! >> 8 : samples[s]! * grayScale
        rgba[o] = v
        rgba[o + 1] = v
        rgba[o + 2] = v
        rgba[o + 3] = colorType === 4 ? (bitDepth === 16 ? samples[s + 1]! >> 8 : samples[s + 1]!) : 255
      } else {
        const shift = bitDepth === 16
        rgba[o] = shift ? samples[s]! >> 8 : samples[s]!
        rgba[o + 1] = shift ? samples[s + 1]! >> 8 : samples[s + 1]!
        rgba[o + 2] = shift ? samples[s + 2]! >> 8 : samples[s + 2]!
        rgba[o + 3] = colorType === 6 ? (shift ? samples[s + 3]! >> 8 : samples[s + 3]!) : 255
      }
    }
  }

  return { width, height, bitDepth, colorType, paletteSize, hasTrns: trns !== null, rgba }
}
