// 생성 원본(큰 RGB/RGBA PNG, 단색 배경, N열 × M행 등간격 격자) → 게임 규격 시트(논리 칸, 알파 2값, 팔레트 색).
//   1 배경 열쇠: 알파 < 기준 또는 열쇠 색(#FF00FF)과 가까운 화소
//   2 칸 배정: 전경 화소를 8방향 덩어리로 묶고, 덩어리 무게중심이 든 격자 칸에 준다
//     (생성 그림은 발끝·칼끝이 격자선을 조금 넘는다 — 격자선으로 자르면 이웃 칸에 조각이 생긴다)
//   3 원본 화소 → 가장 가까운 팔레트 색 번호
//   4 블록(원본 화소 scale개 = 논리 화소 1개) 다수결: 불투명이 절반 이상이면 불투명, 색은 최다 번호
//   5 외톨이 화소 제거 → 정렬 이동 → 칸 안에 놓기(칸 밖은 버리고 센다)
// 기준 시트는 칸마다 격자 기준점(위상)과 이동을 계산한다. 레이어는 기준 시트의 축척·기준점·이동을 그대로 쓴다
// — 레이어를 따로 정렬하지 않는다(따로 정렬하면 칸마다 어긋난다).
// 규격 수치(칸 크기·지면선·중심)는 대응표(docs/art/imagegen.map.json)가 가진다. 이 파일에는 알고리즘만 있다.
import { formatHex } from './manifest'
import type { AlignSpec, RowSpec } from './imagegen-map'
import { createRaster, type Raster } from './raster'

export interface PaletteEntry {
  hex: string
  r: number
  g: number
  b: number
  /** 매니페스트 palettes의 묶음 이름(skin, hair …) */
  group: string
}

/** 가중 RGB 거리(redmean). 0 ~ 약 765 */
export function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const rm = (r1 + r2) / 2
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db)
}

/** 가장 가까운 팔레트 색 찾기(같은 RGB는 한 번만 계산한다) */
export class Snapper {
  private readonly cache = new Map<number, number>()
  constructor(readonly colors: PaletteEntry[]) {
    if (colors.length === 0) throw new Error('팔레트가 비었다')
  }

  nearest(r: number, g: number, b: number): number {
    const key = (r << 16) | (g << 8) | b
    const hit = this.cache.get(key)
    if (hit !== undefined) return hit
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < this.colors.length; i++) {
      const c = this.colors[i]!
      const d = colorDistance(r, g, b, c.r, c.g, c.b)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    this.cache.set(key, best)
    return best
  }
}

export interface KeyOptions {
  /** 배경 열쇠 색. null이면 알파로만 가른다 */
  key: [number, number, number] | null
  /** 열쇠 색과의 RGB 유클리드 거리가 이 값 이하면 배경 */
  tolerance: number
  /** 알파가 이 값 미만이면 배경 */
  alphaThreshold: number
  /**
   * 자홍 번짐 제거. min(R, B) − G가 이 값 이상이면 배경으로 본다(열쇠 #FF00FF와 섞인 테두리 화소).
   * 기본 팔레트에서 이 조건에 걸리는 색은 효과 보라 #8E4FA3뿐이다. null이면 끈다
   */
  despill: number | null
}

export function isBackground(rgba: Uint8Array, o: number, k: KeyOptions): boolean {
  if (rgba[o + 3]! < k.alphaThreshold) return true
  if (k.despill !== null && Math.min(rgba[o]!, rgba[o + 2]!) - rgba[o + 1]! >= k.despill) return true
  if (k.key === null) return false
  const dr = rgba[o]! - k.key[0]
  const dg = rgba[o + 1]! - k.key[1]
  const db = rgba[o + 2]! - k.key[2]
  return dr * dr + dg * dg + db * db <= k.tolerance * k.tolerance
}

export interface SourceImage {
  width: number
  height: number
  rgba: Uint8Array
}

/** [x0, x1) × [y0, y1) */
export interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** 등간격 격자의 칸 사각형(행 우선). 나눗셈이 정수가 아니면 반올림 경계를 쓴다 */
export function cellRects(width: number, height: number, cols: number, rows: number): Rect[] {
  const out: Rect[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        x0: Math.round((c * width) / cols),
        x1: Math.round(((c + 1) * width) / cols),
        y0: Math.round((r * height) / rows),
        y1: Math.round(((r + 1) * height) / rows),
      })
    }
  }
  return out
}

export interface Ownership {
  /** 화소마다 주인 칸 번호(행 우선), -1 = 배경 */
  owner: Int16Array
  /** 칸마다 주인인 화소의 bbox. 없으면 null */
  boxes: (Rect | null)[]
}

/** 전경 화소를 8방향 덩어리로 묶어 무게중심이 든 칸에 배정한다 */
export function assignCells(img: SourceImage, key: KeyOptions, cols: number, rows: number): Ownership {
  const { width: W, height: H } = img
  const owner = new Int16Array(W * H).fill(-1)
  const fg = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) fg[i] = isBackground(img.rgba, i * 4, key) ? 0 : 1
  const boxes: (Rect | null)[] = new Array<Rect | null>(cols * rows).fill(null)
  const seen = new Uint8Array(W * H)
  const stack = new Int32Array(W * H)
  const comp: number[] = []
  for (let start = 0; start < W * H; start++) {
    if (!fg[start] || seen[start]) continue
    let sp = 0
    stack[sp++] = start
    seen[start] = 1
    comp.length = 0
    let sx = 0
    let sy = 0
    while (sp > 0) {
      const p = stack[--sp]!
      comp.push(p)
      const px = p % W
      const py = (p - px) / W
      sx += px
      sy += py
      for (let dy = -1; dy <= 1; dy++) {
        const y = py + dy
        if (y < 0 || y >= H) continue
        for (let dx = -1; dx <= 1; dx++) {
          const x = px + dx
          if (x < 0 || x >= W) continue
          const n = y * W + x
          if (!fg[n] || seen[n]) continue
          seen[n] = 1
          stack[sp++] = n
        }
      }
    }
    const cx = Math.min(cols - 1, Math.floor(((sx / comp.length + 0.5) * cols) / W))
    const cy = Math.min(rows - 1, Math.floor(((sy / comp.length + 0.5) * rows) / H))
    const cell = cy * cols + cx
    let box = boxes[cell] ?? null
    for (const p of comp) {
      owner[p] = cell
      const x = p % W
      const y = (p - x) / W
      if (box === null) box = { x0: x, y0: y, x1: x + 1, y1: y + 1 }
      else {
        if (x < box.x0) box.x0 = x
        if (y < box.y0) box.y0 = y
        if (x >= box.x1) box.x1 = x + 1
        if (y >= box.y1) box.y1 = y + 1
      }
    }
    boxes[cell] = box
  }
  return { owner, boxes }
}

/** 한 칸의 화소를 팔레트 번호로 바꾼 것. -1 = 배경 또는 다른 칸 소유 */
export interface LabelMap {
  rect: Rect
  w: number
  h: number
  labels: Int16Array
}

export function labelCell(img: SourceImage, own: Ownership, cell: number, snapper: Snapper): LabelMap {
  const rect = own.boxes[cell] ?? { x0: 0, y0: 0, x1: 0, y1: 0 }
  const w = rect.x1 - rect.x0
  const h = rect.y1 - rect.y0
  const labels = new Int16Array(w * h).fill(-1)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (rect.y0 + y) * img.width + rect.x0 + x
      if (own.owner[p] !== cell) continue
      labels[y * w + x] = snapper.nearest(img.rgba[p * 4]!, img.rgba[p * 4 + 1]!, img.rgba[p * 4 + 2]!)
    }
  }
  return { rect, w, h, labels }
}

/** 열·행 방향 색 경계 개수. cols[x] = x-1과 x 사이 경계 수 */
function edgeProfiles(m: LabelMap): [Float64Array, Float64Array] {
  const cols = new Float64Array(m.w + 1)
  const rows = new Float64Array(m.h + 1)
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      const v = m.labels[y * m.w + x]!
      if (x > 0 && v !== m.labels[y * m.w + x - 1]) cols[x]! += 1
      if (y > 0 && v !== m.labels[(y - 1) * m.w + x]) rows[y]! += 1
    }
  }
  return [cols, rows]
}

/**
 * 원본 그림의 화소 블록 크기(원본 화소 몇 개가 그림의 한 칸인가)를 잰다.
 * 색 경계 위치의 주기성: 칸마다 경계 분포의 푸리에 크기 |Σ E(x)·e^{2πix/p}| / ΣE 를 p = 2.5~24에서 재고 가장 큰 p.
 * 경계가 200개 미만이면 null. 생성 그림은 격자가 고르지 않아 ±10% 정도의 추정이다.
 */
export function measurePeriod(maps: LabelMap[]): number | null {
  const profiles = maps.filter((m) => m.w > 0).flatMap((m) => edgeProfiles(m))
  const total = profiles.reduce((s, e) => s + e.reduce((a, b) => a + b, 0), 0)
  if (total < 200) return null
  const ps: number[] = []
  const scores: number[] = []
  for (let p = 2.5; p <= 24.0001; p += 0.05) {
    let num = 0
    for (const e of profiles) {
      let re = 0
      let im = 0
      for (let x = 0; x < e.length; x++) {
        const n = e[x]!
        if (n === 0) continue
        re += n * Math.cos((2 * Math.PI * x) / p)
        im += n * Math.sin((2 * Math.PI * x) / p)
      }
      num += Math.hypot(re, im)
    }
    ps.push(p)
    scores.push(num / total)
  }
  // p/2, p/3 같은 배음도 같은 크기로 솟으므로, 최고점의 90% 이상인 극대점 가운데 가장 큰 p를 고른다
  const max = Math.max(...scores)
  let best = ps[scores.indexOf(max)]!
  for (let i = 1; i < ps.length - 1; i++) {
    const s = scores[i]!
    if (s >= 0.9 * max && s >= scores[i - 1]! && s >= scores[i + 1]! && ps[i]! > best) best = ps[i]!
  }
  return Math.round(best * 100) / 100
}

/** 칸 안의 색 경계가 블록 경계에 가장 많이 걸리는 위상 [ox, oy](rect 왼쪽 위 기준, 0 ≤ o < scale, 0.25 단위) */
export function estimatePhase(m: LabelMap, scale: number): [number, number] {
  const pick = (edges: Float64Array): number => {
    let best = 0
    let bestScore = -1
    for (let o = 0; o < scale; o += 0.25) {
      let score = 0
      for (let x = 0; x < edges.length; x++) {
        const n = edges[x]!
        if (n === 0) continue
        let d = (((x - o) % scale) + scale) % scale
        if (d > scale / 2) d = scale - d
        score += n * Math.exp(-(d * d) / (2 * 0.35 * 0.35))
      }
      if (score > bestScore) {
        bestScore = score
        best = o
      }
    }
    return best
  }
  const [cols, rows] = edgeProfiles(m)
  return [pick(cols), pick(rows)]
}

/**
 * 블록 격자. 격자점 (i, j)는 원본 x ∈ [ax + i·s, ax + (i+1)·s)를 덮는다(ax = 기준점).
 * 배열은 격자점 (i0 .. i0+nx-1, j0 .. j0+ny-1)만 담는다.
 */
export interface BlockGrid {
  i0: number
  j0: number
  nx: number
  ny: number
  /** 팔레트 번호, -1 = 투명 */
  idx: Int16Array
  /** 이긴 색이 블록 화소에서 차지한 비율 */
  purity: Float32Array
  /** 이긴 색 원본 화소 평균과 팔레트 색의 거리 */
  error: Float32Array
}

/** 블록 다수결: 불투명 화소가 블록의 절반 이상이면 불투명, 색은 불투명 화소 가운데 최다 팔레트 번호(같으면 앞 번호) */
export function downsample(img: SourceImage, m: LabelMap, scale: number, anchor: [number, number], snapper: Snapper): BlockGrid {
  const { rect } = m
  const [ax, ay] = anchor
  const lat = (v: number, a: number): number => Math.floor((v + 0.5 - a) / scale)
  const i0 = lat(rect.x0, ax)
  const j0 = lat(rect.y0, ay)
  const nx = m.w === 0 ? 0 : lat(rect.x1 - 1, ax) - i0 + 1
  const ny = m.h === 0 ? 0 : lat(rect.y1 - 1, ay) - j0 + 1
  const L = snapper.colors.length
  const slots = L + 1
  const counts = new Int32Array(nx * ny * slots)
  const blockOf = (x: number, y: number): number => (lat(y, ay) - j0) * nx + (lat(x, ax) - i0)
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      const lab = m.labels[y * m.w + x]!
      counts[blockOf(rect.x0 + x, rect.y0 + y) * slots + (lab < 0 ? L : lab)]! += 1
    }
  }
  const idx = new Int16Array(nx * ny).fill(-1)
  const purity = new Float32Array(nx * ny)
  for (let b = 0; b < nx * ny; b++) {
    let total = 0
    let best = -1
    let bestN = 0
    for (let s = 0; s < L; s++) {
      const n = counts[b * slots + s]!
      total += n
      if (n > bestN) {
        bestN = n
        best = s
      }
    }
    const bg = counts[b * slots + L]!
    total += bg
    if (total === 0 || (total - bg) * 2 < total) continue
    idx[b] = best
    purity[b] = bestN / total
  }
  const sum = new Float64Array(nx * ny * 4)
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      const lab = m.labels[y * m.w + x]!
      const b = blockOf(rect.x0 + x, rect.y0 + y)
      if (lab < 0 || lab !== idx[b]) continue
      const o = ((rect.y0 + y) * img.width + rect.x0 + x) * 4
      sum[b * 4]! += img.rgba[o]!
      sum[b * 4 + 1]! += img.rgba[o + 1]!
      sum[b * 4 + 2]! += img.rgba[o + 2]!
      sum[b * 4 + 3]! += 1
    }
  }
  const error = new Float32Array(nx * ny)
  for (let b = 0; b < nx * ny; b++) {
    const i = idx[b]!
    if (i < 0) continue
    const n = sum[b * 4 + 3]!
    const c = snapper.colors[i]!
    error[b] = colorDistance(sum[b * 4]! / n, sum[b * 4 + 1]! / n, sum[b * 4 + 2]! / n, c.r, c.g, c.b)
  }
  return { i0, j0, nx, ny, idx, purity, error }
}

/** 8방향으로 이어진 불투명 덩어리 가운데 maxSize 화소 이하인 것을 지운다. 지운 화소 수를 돌려준다 */
export function removeSpecks(g: BlockGrid, maxSize = 1): number {
  const seen = new Uint8Array(g.nx * g.ny)
  let removed = 0
  const stack: number[] = []
  for (let start = 0; start < g.idx.length; start++) {
    if (g.idx[start]! < 0 || seen[start]) continue
    const comp: number[] = []
    stack.push(start)
    seen[start] = 1
    while (stack.length > 0) {
      const b = stack.pop()!
      comp.push(b)
      const bx = b % g.nx
      const by = (b - bx) / g.nx
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = bx + dx
          const y = by + dy
          if (x < 0 || y < 0 || x >= g.nx || y >= g.ny) continue
          const n = y * g.nx + x
          if (seen[n] || g.idx[n]! < 0) continue
          seen[n] = 1
          stack.push(n)
        }
      }
    }
    if (comp.length <= maxSize) {
      for (const b of comp) g.idx[b] = -1
      removed += comp.length
    }
  }
  return removed
}

/** 격자점 좌표 → 논리 칸 좌표 정수 이동 [dx, dy]. 불투명 블록이 없으면 null */
export function alignShift(g: BlockGrid, align: AlignSpec, cell: [number, number]): [number, number] | null {
  const xs: number[] = []
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let j = 0; j < g.ny; j++) {
    for (let i = 0; i < g.nx; i++) {
      if (g.idx[j * g.nx + i]! < 0) continue
      const x = g.i0 + i
      const y = g.j0 + j
      xs.push(x)
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (xs.length === 0) return null
  if (align.mode === 'ground') {
    xs.sort((a, b) => a - b)
    const median = xs[Math.floor((xs.length - 1) / 2)]!
    return [align.center_x - median, align.bottom - maxY]
  }
  const bw = maxX - minX + 1
  const bh = maxY - minY + 1
  return [Math.floor((cell[0] - bw) / 2) - minX, Math.floor((cell[1] - bh) / 2) - minY]
}

export interface CellTransform {
  col: number
  row: number
  /** 블록 격자 기준점(원본 좌표). null = 기준 시트에서 빈 칸(레이어도 이 칸을 쓰지 않는다) */
  anchor: [number, number] | null
  shift: [number, number] | null
}

export interface SheetTransform {
  sourceSize: [number, number]
  scale: number
  cells: CellTransform[]
}

export interface CellReport {
  col: number
  row: number
  action: string
  expected: 'content' | 'empty'
  /** ok · empty(내용 없음, 레이어의 빈 칸 포함) · missing_content(기준 시트인데 비었다) · unexpected_content(빈 칸이어야 하는데 내용) */
  status: 'ok' | 'empty' | 'missing_content' | 'unexpected_content'
  /** 원본에서 이 칸 소유 화소의 bbox [x0, y0, x1, y1)(격자선을 넘을 수 있다) */
  source_box: [number, number, number, number] | null
  anchor: [number, number] | null
  shift: [number, number] | null
  opaque: number
  /** 이동 뒤 칸 밖으로 나가 버린 논리 화소 */
  dropped_outside: number
  /** 외톨이 화소로 지운 논리 화소 */
  specks_removed: number
  /** 칸 좌표 [x0, y0, x1, y1](끝 포함) */
  bbox: [number, number, number, number] | null
  bbox_center_x: number | null
  colors: string[]
  palette_error: { mean: number; max: number }
  /** 불투명 블록에서 이긴 색이 차지한 평균 비율 */
  block_purity: number
}

export interface SheetReport {
  source_size: [number, number]
  grid: [number, number]
  cell: [number, number]
  /** 원본 칸 크기 / 논리 칸 크기 [가로, 세로] */
  cell_ratio: [number, number]
  scale: number
  scale_origin: 'map' | 'cell_ratio' | 'reference'
  /** 원본 그림에서 잰 화소 블록 크기 */
  art_period: number | null
  notes: string[]
  totals: {
    opaque: number
    dropped_outside: number
    specks_removed: number
    colors: string[]
    palette_error_mean: number
    palette_error_max: number
  }
  cells: CellReport[]
}

export interface SheetSpec {
  grid: [number, number]
  cell: [number, number]
  rows: RowSpec[]
  align: AlignSpec
  /** 대응표가 정한 축척(없으면 칸 비율) */
  scale?: number
}

export interface NormalizeResult {
  raster: Raster
  transform: SheetTransform
  report: SheetReport
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * 시트 하나를 정규화한다.
 * reference가 없으면 기준 시트로 보고 축척·기준점·이동을 계산한다.
 * reference가 있으면(레이어) 그 변환을 그대로 쓴다.
 */
export function normalizeSheet(
  img: SourceImage,
  spec: SheetSpec,
  snapper: Snapper,
  key: KeyOptions,
  reference?: SheetTransform,
): NormalizeResult {
  const [cols, rows] = spec.grid
  const [cw, ch] = spec.cell
  if (reference !== undefined && (reference.sourceSize[0] !== img.width || reference.sourceSize[1] !== img.height)) {
    throw new Error(`레이어 원본 크기 ${img.width}×${img.height}가 기준 시트 원본 ${reference.sourceSize[0]}×${reference.sourceSize[1]}와 다르다`)
  }
  const own = assignCells(img, key, cols, rows)
  const maps = own.boxes.map((_, n) => labelCell(img, own, n, snapper))
  const ratio: [number, number] = [img.width / cols / cw, img.height / rows / ch]
  const notes: string[] = []
  // 레이어는 축척을 물려받으므로 재지 않는다(민머리·면이 넓은 레이어에서는 추정도 흔들린다)
  const period = reference === undefined ? measurePeriod(maps) : null

  let scale: number
  let origin: SheetReport['scale_origin']
  if (reference !== undefined) {
    scale = reference.scale
    origin = 'reference'
  } else if (spec.scale !== undefined) {
    scale = spec.scale
    origin = 'map'
  } else {
    scale = Math.max(ratio[0], ratio[1])
    origin = 'cell_ratio'
  }
  if (Math.abs(ratio[0] / ratio[1] - 1) > 0.02) {
    notes.push(`원본 칸이 정사각 비율이 아니다(가로 ${round2(ratio[0])} · 세로 ${round2(ratio[1])}). 축척은 한 값이어야 해 ${origin === 'cell_ratio' ? '큰 값' : '지정값'} ${round2(scale)}을 쓴다`)
  }
  if (period !== null && Math.abs(period / scale - 1) > 0.15) {
    notes.push(period < scale
      ? `원본 그림의 화소 블록은 약 ${period}인데 축척은 ${round2(scale)}이다 — 원본 화소 ${round2(scale / period)}개가 논리 화소 1개로 합쳐져 가는 선·세부가 빠질 수 있다`
      : `원본 그림의 화소 블록은 약 ${period}인데 축척은 ${round2(scale)}이다 — 원본 화소 1개가 논리 화소 ${round2(period / scale)}개로 늘어 계단이 생길 수 있다`)
  }

  const out = createRaster(cols * cw, rows * ch)
  const cells: CellTransform[] = []
  const reports: CellReport[] = []
  const allColors = new Set<number>()
  let errSum = 0
  let errN = 0
  let errMax = 0

  for (let n = 0; n < cols * rows; n++) {
    const col = n % cols
    const row = Math.floor(n / cols)
    const rowSpec = spec.rows[row]!
    const expected: CellReport['expected'] = col < rowSpec.frames ? 'content' : 'empty'
    const m = maps[n]!
    let anchor: [number, number] | null
    if (reference !== undefined) anchor = reference.cells[n]!.anchor
    else if (m.w === 0) anchor = null
    else {
      const [ox, oy] = estimatePhase(m, scale)
      anchor = [m.rect.x0 + ox, m.rect.y0 + oy]
    }
    // 레이어인데 기준 칸이 비었으면 격자를 칸 원점에 둬서 화소 수만 센다
    const grid = downsample(img, m, scale, anchor ?? [m.rect.x0, m.rect.y0], snapper)
    const specks = removeSpecks(grid, 1)
    let shift: [number, number] | null
    if (reference !== undefined) shift = reference.cells[n]!.shift
    else shift = expected === 'content' ? alignShift(grid, spec.align, spec.cell) : null

    let opaqueBlocks = 0
    for (let b = 0; b < grid.idx.length; b++) if (grid.idx[b]! >= 0) opaqueBlocks++

    const colors = new Set<number>()
    let dropped = 0
    let placed = 0
    let bx0 = Infinity
    let by0 = Infinity
    let bx1 = -Infinity
    let by1 = -Infinity
    let cellErr = 0
    let cellErrMax = 0
    let puritySum = 0
    if (shift !== null) {
      for (let j = 0; j < grid.ny; j++) {
        for (let i = 0; i < grid.nx; i++) {
          const b = j * grid.nx + i
          const p = grid.idx[b]!
          if (p < 0) continue
          const x = grid.i0 + i + shift[0]
          const y = grid.j0 + j + shift[1]
          if (x < 0 || y < 0 || x >= cw || y >= ch) {
            dropped++
            continue
          }
          const c = snapper.colors[p]!
          const o = ((row * ch + y) * out.width + col * cw + x) * 4
          out.rgba[o] = c.r
          out.rgba[o + 1] = c.g
          out.rgba[o + 2] = c.b
          out.rgba[o + 3] = 255
          const rgb = (c.r << 16) | (c.g << 8) | c.b
          colors.add(rgb)
          allColors.add(rgb)
          placed++
          const e = grid.error[b]!
          cellErr += e
          cellErrMax = Math.max(cellErrMax, e)
          puritySum += grid.purity[b]!
          bx0 = Math.min(bx0, x)
          by0 = Math.min(by0, y)
          bx1 = Math.max(bx1, x)
          by1 = Math.max(by1, y)
        }
      }
    }
    errSum += cellErr
    errN += placed
    errMax = Math.max(errMax, cellErrMax)

    let status: CellReport['status']
    if (expected === 'empty') status = opaqueBlocks > 0 ? 'unexpected_content' : 'empty'
    else if (opaqueBlocks === 0) status = reference === undefined ? 'missing_content' : 'empty'
    else status = 'ok'
    if (status === 'unexpected_content') notes.push(`칸 (${col},${row})은 빈 칸이어야 하는데 논리 화소 ${opaqueBlocks}개가 있다(출력에서는 버렸다)`)
    if (status === 'missing_content') notes.push(`칸 (${col},${row})은 내용이 있어야 하는데 비었다`)
    if (reference !== undefined && shift === null && opaqueBlocks > 0 && expected === 'content') {
      notes.push(`칸 (${col},${row}): 기준 시트의 빈 칸에 레이어 내용 ${opaqueBlocks}화소가 있어 버렸다`)
    }
    if (shift !== null && dropped > 0) notes.push(`칸 (${col},${row}): 정렬 뒤 칸 밖으로 나간 논리 화소 ${dropped}개를 버렸다`)

    cells.push({ col, row, anchor, shift })
    reports.push({
      col,
      row,
      action: rowSpec.action,
      expected,
      status,
      source_box: m.w > 0 ? [m.rect.x0, m.rect.y0, m.rect.x1, m.rect.y1] : null,
      anchor: anchor === null ? null : [round2(anchor[0]), round2(anchor[1])],
      shift,
      opaque: placed,
      dropped_outside: shift === null ? 0 : dropped,
      specks_removed: specks,
      bbox: placed > 0 ? [bx0, by0, bx1, by1] : null,
      bbox_center_x: placed > 0 ? (bx0 + bx1) / 2 : null,
      colors: [...colors].sort((a, b) => a - b).map(formatHex),
      palette_error: { mean: placed > 0 ? round2(cellErr / placed) : 0, max: round2(cellErrMax) },
      block_purity: placed > 0 ? round2(puritySum / placed) : 0,
    })
  }

  const report: SheetReport = {
    source_size: [img.width, img.height],
    grid: spec.grid,
    cell: spec.cell,
    cell_ratio: [round2(ratio[0]), round2(ratio[1])],
    scale: round2(scale),
    scale_origin: origin,
    art_period: period,
    notes,
    totals: {
      opaque: reports.reduce((s, r) => s + r.opaque, 0),
      dropped_outside: reports.reduce((s, r) => s + r.dropped_outside, 0),
      specks_removed: reports.reduce((s, r) => s + r.specks_removed, 0),
      colors: [...allColors].sort((a, b) => a - b).map(formatHex),
      palette_error_mean: errN > 0 ? round2(errSum / errN) : 0,
      palette_error_max: round2(errMax),
    },
    cells: reports,
  }
  return { raster: out, transform: { sourceSize: [img.width, img.height], scale, cells }, report }
}
