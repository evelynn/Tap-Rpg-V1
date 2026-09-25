// 띠(장면 4칸·배경 층) 찾기와 정규화. 띠는 정규화가 잘라 내고 다시 뽑으므로 위치·캔버스 크기는 내용에서 찾는다.
//   띠 찾기(findBand): 그림 화소(배경 열쇠가 아닌 화소)가 우세한 행 = 그 행 그림 화소 수가 가장 많은 행의 절반 이상.
//            우세한 첫 행 ~ 끝 행이 세로 범위, 그 안에서 그림 화소가 절반 이상인 첫 열 ~ 끝 열이 가로 범위(찾은 띠).
//   비율 맞춤(fitBand): 늘리지 않고 잘라서 규격 비율(가로/세로)에 맞춘다. 바닥(지면선)은 언제나 남긴다.
//            높으면 위(천장·하늘)를 잘라 낸다. partial 층은 하늘 자리가 비므로 높이 = 가로 / 비율로 위로 늘린다.
//            넓으면 이어 붙는 배경(tile)만 가로로 자른다 — 창의 왼쪽 열들과 오른쪽 열들의 색 차이(이음 점수)가 가장 작은 창.
//            칸이 여럿인 장면은 가로로 자르면 칸이 잘리므로 자르지 않고 넘는 비율(excess)을 알린다(문이 aspect_tol 넘으면 실패).
//   정규화: 맞춘 띠를 논리 크기로 면적 평균(상자) 재표본. 그림 화소가 절반 이상인 칸만 불투명(알파 2값),
//            색은 그림 화소의 면적 가중 평균. 팔레트가 있으면 가장 가까운 팔레트 색으로 스냅하고,
//            palette null이면 색을 그대로 둔다(풍부한 배경을 포스터화하지 않는다 — D71 품질 기준).
//            fit stretch(옛 방식)는 자르지 않고 찾은 띠 전체를 가로·세로 다른 배율로 뽑는다.
import { colorDistance, isBackground, Snapper, type KeyOptions, type PaletteEntry, type SourceImage } from './normalize'
import { createRaster, type Raster } from './raster'

export type StripFill = 'opaque' | 'partial'

/** 이미지 화소 사각형 [x, x+w) × [y, y+h) */
export interface BandRect {
  x: number
  y: number
  w: number
  h: number
}

/** 비율 맞춘 띠. 사각형(x, y, w, h)이 정규화가 쓸 띠다. partial 띠는 y가 음수일 수 있다(맞춤 실패, fits false) */
export interface Band extends BandRect {
  /** 내용에서 찾은 띠(자르기 전) */
  raw: BandRect
  /** 위에서 잘라 낸 행(찾은 띠 기준, partial은 그림이 우세한 행 기준) */
  cropTop: number
  /** 가로로 잘라 낸 왼쪽·오른쪽 열 */
  cropLeft: number
  cropRight: number
  /** 가로로 잘랐을 때 이음 점수(창 양 끝 열의 평균 색 거리, 0 ~ 약 765). 안 잘랐으면 null */
  seam: number | null
  /** 가로로 못 자르는 띠가 규격보다 넓은 비율(찾은 폭 / 규격 비율 폭 − 1). 아니면 0 */
  excess: number
  /** 맞춘 띠가 이미지 안에 있다 */
  fits: boolean
}

/** 내용에서 띠를 찾는다(자르기 전). fg[i] = 1이면 그림 화소. 그림이 없으면 null */
export function findBand(fg: Uint8Array, W: number, H: number): BandRect | null {
  const rowN = new Int32Array(H)
  let maxRow = 0
  for (let y = 0; y < H; y++) {
    let n = 0
    for (let x = 0; x < W; x++) n += fg[y * W + x]!
    rowN[y] = n
    if (n > maxRow) maxRow = n
  }
  if (maxRow === 0) return null
  let ya = -1
  let yb = -1
  for (let y = 0; y < H; y++) {
    if (rowN[y]! * 2 < maxRow) continue
    if (ya < 0) ya = y
    yb = y
  }
  const rh = yb - ya + 1
  const colN = new Int32Array(W)
  for (let y = ya; y <= yb; y++) for (let x = 0; x < W; x++) colN[x]! += fg[y * W + x]!
  let xa = -1
  let xb = -1
  for (let x = 0; x < W; x++) {
    if (colN[x]! * 2 < rh) continue
    if (xa < 0) xa = x
    xb = x
  }
  if (xa < 0) return null
  return { x: xa, y: ya, w: xb - xa + 1, h: rh }
}

export interface FitOptions {
  fill: StripFill
  /** 규격 가로 / 세로(예: 512×64 → 8) */
  aspect: number
  /** 가로로 잘라도 되는 띠(이어 붙는 배경 층). 칸이 여럿인 장면은 false */
  tile: boolean
  /** 이음 점수를 잴 창 양 끝 열 수 */
  seamCols?: number
}

/**
 * 찾은 띠를 잘라서 규격 비율에 맞춘다(늘리지 않는다). img·fg는 이음 점수에만 쓴다.
 * 바닥 행은 언제나 남긴다. 가로 자르기는 tile일 때만.
 */
export function fitBand(raw: BandRect, img: SourceImage, fg: Uint8Array, o: FitOptions): Band {
  const bottom = raw.y + raw.h - 1
  let x = raw.x
  let w = raw.w
  let h: number
  let cropTop = 0
  let cropLeft = 0
  let cropRight = 0
  let seam: number | null = null
  let excess = 0
  const cutX = (wantW: number, rows: [number, number]): void => {
    const best = seamWindow(img, fg, raw.x, raw.w, wantW, rows, o.seamCols ?? 4)
    cropLeft = best.x - raw.x
    cropRight = raw.w - wantW - cropLeft
    x = best.x
    w = wantW
    seam = best.score
  }
  const hFor = (width: number): number => Math.max(1, Math.round(width / o.aspect))
  if (o.fill === 'opaque') {
    h = hFor(w)
    if (h < raw.h) {
      cropTop = raw.h - h
    } else if (h > raw.h) {
      const wantW = Math.max(1, Math.round(raw.h * o.aspect))
      if (o.tile) cutX(wantW, [raw.y, bottom])
      else excess = raw.w / wantW - 1
      h = raw.h
    }
  } else {
    // 하늘 자리가 비는 층: 높이는 가로로 정하고, 그림이 우세한 행이 그보다 높으면 위를 자른다
    h = hFor(w)
    if (raw.h > h) cropTop = raw.h - h
    else if (h > bottom + 1 && o.tile) {
      // 규격 높이가 이미지 위를 넘는다: 이미지 높이에 맞는 폭으로 가로를 자른다
      h = bottom + 1
      cutX(Math.max(1, Math.round(h * o.aspect)), [Math.max(0, bottom - raw.h + 1), bottom])
    }
  }
  const y = bottom - h + 1
  return { x, y, w, h, raw, cropTop, cropLeft, cropRight, seam, excess, fits: y >= 0 }
}

/**
 * 폭 wantW 창 가운데 이음 점수가 가장 작은 것. 점수 = 창 왼쪽 k열과 오른쪽 k열(같은 순서)의 화소별 색 거리 평균
 * (한쪽만 그림이면 765). 같은 점수면 가운데에 가까운 창.
 */
function seamWindow(img: SourceImage, fg: Uint8Array, x0: number, w: number, wantW: number, rows: [number, number], k: number): { x: number; score: number } {
  const W = img.width
  const d = img.rgba
  const kk = Math.max(1, Math.min(k, Math.floor(wantW / 2)))
  const mid = x0 + (w - wantW) / 2
  let best = { x: x0, score: Infinity }
  for (let s = x0; s <= x0 + w - wantW; s++) {
    let sum = 0
    let n = 0
    for (let y = rows[0]; y <= rows[1]; y++) {
      for (let i = 0; i < kk; i++) {
        const a = y * W + s + i
        const b = y * W + s + wantW - kk + i
        const fa = fg[a] === 1
        const fb = fg[b] === 1
        if (!fa && !fb) continue
        sum += fa !== fb ? 765 : colorDistance(d[a * 4]!, d[a * 4 + 1]!, d[a * 4 + 2]!, d[b * 4]!, d[b * 4 + 1]!, d[b * 4 + 2]!)
        n++
      }
    }
    const score = n === 0 ? 0 : sum / n
    if (score < best.score - 1e-9 || (Math.abs(score - best.score) <= 1e-9 && Math.abs(s - mid) < Math.abs(best.x - mid))) best = { x: s, score }
  }
  return { x: best.x, score: Math.round(best.score * 10) / 10 }
}

/** 배경 열쇠가 아닌 화소 = 1 */
export function foreground(img: SourceImage, key: KeyOptions): Uint8Array {
  const fg = new Uint8Array(img.width * img.height)
  for (let i = 0; i < fg.length; i++) fg[i] = isBackground(img.rgba, i * 4, key) ? 0 : 1
  return fg
}

export interface StripSpec {
  /** 논리 크기 [가로, 세로](예: 장면 512×64, 배경 256×64) */
  size: [number, number]
  fill: StripFill
  /** null = 색을 그대로 둔다 */
  palette: PaletteEntry[] | null
  /** crop(기본) = 잘라서 비율 맞춤 · stretch = 찾은 띠 전체를 가로·세로 다른 배율로 뽑는다(옛 방식) */
  fit?: 'crop' | 'stretch'
  /** 가로로 잘라도 되는 띠(배경 층). 기본 false */
  tile?: boolean
  /** crop: 가로로 못 자르는 띠가 이 비율까지 넓으면 조금 눌러 뽑고, 넘으면 거절한다. 기본 0.02 */
  aspectTol?: number
}

export interface StripReport {
  source_size: [number, number]
  size: [number, number]
  fill: StripFill
  fit: 'crop' | 'stretch'
  tile: boolean
  /** 내용에서 찾은 띠 [x, y, w, h](자르기 전) */
  band_found: [number, number, number, number]
  /** 뽑은 띠 [x, y, w, h](이미지 화소) */
  band: [number, number, number, number]
  /** 위에서 자른 행 · 가로로 자른 [왼쪽, 오른쪽] 열 · 이음 점수 */
  crop_top: number
  crop_x: [number, number]
  seam: number | null
  /** 뽑은 띠 가로·세로 비율 · 규격 비율 */
  aspect: number
  aspect_expected: number
  /** 논리 화소 1개 = 원본 [가로, 세로] 화소 */
  scale: [number, number]
  /** 가로 축척 / 세로 축척. 1이 아니면 그림이 가로(>1이면 가로로 눌림, <1이면 늘어남)로 비틀린다 */
  anisotropy: number
  /** 뽑은 띠 밖 그림 화소(잘라 버렸다) */
  outside_pixels: number
  opaque: number
  transparent: number
  /** 쓴 색 수 */
  color_count: number
  /** 색 수가 256 이하일 때만 */
  colors: string[] | null
  palette_snapped: boolean
  notes: string[]
}

export interface StripResult {
  raster: Raster
  report: StripReport
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000
const hex = (rgb: number): string => `#${rgb.toString(16).padStart(6, '0').toUpperCase()}`

/**
 * 띠를 찾아 비율을 맞추고(fit crop) 논리 크기로 면적 평균 재표본한다.
 * 출력 칸 (ox, oy)는 원본 [x + ox·sx, x + (ox+1)·sx) × [y + oy·sy, y + (oy+1)·sy)를 겹친 면적으로 가중해 덮는다.
 */
export function normalizeStrip(img: SourceImage, spec: StripSpec, key: KeyOptions): StripResult {
  const [OW, OH] = spec.size
  const W = img.width
  const H = img.height
  const fit = spec.fit ?? 'crop'
  const tile = spec.tile ?? false
  const fg = foreground(img, key)
  const aspectExpected = OW / OH
  const raw = findBand(fg, W, H)
  if (raw === null) throw new Error('띠를 찾지 못했다: 배경 열쇠가 아닌 화소가 없다')
  const notes: string[] = []
  let band: BandRect
  let cropTop = 0
  let cropX: [number, number] = [0, 0]
  let seam: number | null = null
  if (fit === 'crop') {
    const b = fitBand(raw, img, fg, { fill: spec.fill, aspect: aspectExpected, tile })
    const tol = spec.aspectTol ?? 0.02
    if (b.excess > tol) {
      throw new Error(`띠 ${raw.w}×${raw.h}(비율 ${round3(raw.w / raw.h)})가 규격 ${round3(aspectExpected)}보다 ${Math.round(b.excess * 100)}% 넓다 — 칸이 여럿인 띠는 가로로 자르지 않는다(tile 아님). 다시 그리거나 fit stretch로 뽑는다`)
    }
    if (!b.fits) throw new Error(`규격 비율로 잡은 띠 위쪽 ${-b.y}화소가 이미지 밖이다(가로로 자를 수 없는 띠)`)
    band = b
    cropTop = b.cropTop
    cropX = [b.cropLeft, b.cropRight]
    seam = b.seam
    if (cropTop > 0) notes.push(`위에서 ${cropTop}행을 잘라 비율 ${round3(aspectExpected)}에 맞췄다(바닥 행 ${raw.y + raw.h - 1} 유지)`)
    if (cropX[0] + cropX[1] > 0) notes.push(`가로로 왼쪽 ${cropX[0]} · 오른쪽 ${cropX[1]}열을 잘랐다(이음 점수 ${seam}, 창 양 끝 4열의 평균 색 거리)`)
    if (b.excess > 0) notes.push(`띠가 규격보다 ${round3(b.excess * 100)}% 넓어 가로로 그만큼 눌러 뽑는다(허용 ${Math.round(tol * 100)}%)`)
  } else if (spec.fill === 'opaque') {
    band = raw
  } else {
    const h = Math.max(1, Math.round(raw.w / aspectExpected))
    band = { x: raw.x, y: raw.y + raw.h - h, w: raw.w, h }
    if (band.y < 0) notes.push(`규격 비율로 잡은 띠 위쪽 ${-band.y}화소가 이미지 밖이다(투명으로 둔다)`)
  }
  const sx = band.w / OW
  const sy = band.h / OH
  const anisotropy = sx / sy
  if (Math.abs(anisotropy - 1) > 0.02) {
    notes.push(`띠 ${band.w}×${band.h}의 비율 ${round3(band.w / band.h)}이 규격 ${round3(aspectExpected)}과 달라 가로 축척 ${round3(sx)} · 세로 축척 ${round3(sy)}로 뽑는다 — 그림이 가로로 ×${round3(1 / anisotropy)} ${anisotropy > 1 ? '눌린다' : '늘어난다'}`)
  }
  if (sx < 1 || sy < 1) notes.push(`띠가 논리 크기보다 작다(축척 ${round3(sx)}×${round3(sy)}) — 원본 화소를 늘려 쓴다`)

  let outside = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!fg[y * W + x]) continue
      if (x < band.x || x >= band.x + band.w || y < band.y || y >= band.y + band.h) outside++
    }
  }
  if (outside > 0) notes.push(`뽑은 띠 밖 그림 화소 ${outside}개를 버렸다(자른 행·열 포함)`)

  const out = createRaster(OW, OH)
  const snapper = spec.palette === null ? null : new Snapper(spec.palette)
  const colors = new Set<number>()
  let opaque = 0
  for (let oy = 0; oy < OH; oy++) {
    const y0 = band.y + oy * sy
    const y1 = y0 + sy
    for (let ox = 0; ox < OW; ox++) {
      const x0 = band.x + ox * sx
      const x1 = x0 + sx
      let area = 0
      let fgArea = 0
      let r = 0
      let g = 0
      let b = 0
      for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0)
        if (wy <= 0) continue
        for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
          const wx = Math.min(x + 1, x1) - Math.max(x, x0)
          if (wx <= 0) continue
          const a = wx * wy
          area += a
          if (x < 0 || y < 0 || x >= W || y >= H || !fg[y * W + x]) continue
          const o = (y * W + x) * 4
          fgArea += a
          r += a * img.rgba[o]!
          g += a * img.rgba[o + 1]!
          b += a * img.rgba[o + 2]!
        }
      }
      if (fgArea * 2 < area || fgArea === 0) continue
      let rgb: [number, number, number] = [Math.round(r / fgArea), Math.round(g / fgArea), Math.round(b / fgArea)]
      if (snapper !== null) {
        const c = snapper.colors[snapper.nearest(...rgb)]!
        rgb = [c.r, c.g, c.b]
      }
      const o = (oy * OW + ox) * 4
      out.rgba[o] = rgb[0]
      out.rgba[o + 1] = rgb[1]
      out.rgba[o + 2] = rgb[2]
      out.rgba[o + 3] = 255
      colors.add((rgb[0] << 16) | (rgb[1] << 8) | rgb[2])
      opaque++
    }
  }
  const transparent = OW * OH - opaque
  if (spec.fill === 'opaque' && transparent > 0) notes.push(`불투명 띠인데 투명 칸 ${transparent}개(그림 화소가 절반 미만)`)
  return {
    raster: out,
    report: {
      source_size: [W, H],
      size: [OW, OH],
      fill: spec.fill,
      fit,
      tile,
      band_found: [raw.x, raw.y, raw.w, raw.h],
      band: [band.x, band.y, band.w, band.h],
      crop_top: cropTop,
      crop_x: cropX,
      seam,
      aspect: round3(band.w / band.h),
      aspect_expected: round3(aspectExpected),
      scale: [round3(sx), round3(sy)],
      anisotropy: round3(anisotropy),
      outside_pixels: outside,
      opaque,
      transparent,
      color_count: colors.size,
      colors: colors.size <= 256 ? [...colors].sort((a, c) => a - c).map(hex) : null,
      palette_snapped: snapper !== null,
      notes,
    },
  }
}
