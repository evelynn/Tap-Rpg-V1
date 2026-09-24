// 배치 틀 그리기(art:template). 생성기에 입력으로 주는 1536×1024(또는 1024×1536) 틀 PNG 3종과 규격 JSON.
//   grid        — 단색 #FF00FF 캔버스 + 칸 밖 여백에만 안내 눈금(#00FFFF). 칸 안에는 아무것도 없다
//   placeholder — grid + 쓰는 칸마다 합격 기준 그림(정규화 원본 프레임)을 ×S 최근접 확대해 지면선·중심에 놓은 것
//   silhouette  — placeholder의 그림을 단색 회색으로 칠한 것
// 눈금: 열·행 경계(길이 24, 두께 2) · 칸 가로 중심 열(길이 12, 폭 S) · 지면선 행(길이 12, 높이 S, 발 최하단 화소 바로 아래 행)
//       · 나는 적의 부양선(길이 8). 격자에서 4화소 떨어진 여백에 그린다. 가로 여백이 없는 띠는 위·아래 눈금만.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { decodePng } from './png'
import { encodeIndexedPng } from './png-write'
import { blit, createRaster, crop, fillRect, hexRgb, upscale, type Raster } from './raster'
import {
  cellSpecs,
  computeLayout,
  resolveSheet,
  SpecError,
  type Layout,
  type LoadedSpecs,
  type PlaceholderSpec,
  type ResolvedSheet,
} from './template-spec'

const GAP = 4
const LONG = 24
const SHORT = 12

export interface FigureStats {
  bottom: number
  top: number
  medianX: number
  height: number
}

/** 알파 > 0 화소의 최하단·최상단 행과 x 중앙값 */
export function figureStats(r: Raster): FigureStats | null {
  const xs: number[] = []
  let top = Infinity
  let bottom = -Infinity
  for (let y = 0; y < r.height; y++) {
    for (let x = 0; x < r.width; x++) {
      if (r.rgba[(y * r.width + x) * 4 + 3]! === 0) continue
      xs.push(x)
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  if (xs.length === 0) return null
  xs.sort((a, b) => a - b)
  return { bottom, top, medianX: xs[Math.floor((xs.length - 1) / 2)]!, height: bottom - top + 1 }
}

class SourceCache {
  private readonly cache = new Map<string, Raster>()
  constructor(private readonly root: string) {}
  get(rel: string): Raster {
    let r = this.cache.get(rel)
    if (r === undefined) {
      const abs = resolve(this.root, rel)
      if (!existsSync(abs)) {
        throw new SpecError(`자리표시 원본이 없다: ${rel} — 먼저 정규화하라(pnpm art:normalize, v04는 대응표 docs/art/imagegen.v04.map.json을 인자로)`)
      }
      const img = decodePng(readFileSync(abs))
      r = { width: img.width, height: img.height, rgba: img.rgba }
      this.cache.set(rel, r)
    }
    return r
  }
}

/** 칸 하나의 자리표시 그림(논리 칸 크기 래스터). 원본 프레임을 규격 지면선(− lift)·중심으로 옮긴다 */
function placeholderCell(sheet: ResolvedSheet, spec: PlaceholderSpec, frame: number, lift: number, sources: SourceCache): { cell: Raster; from: [number, number]; stats: FigureStats | null } {
  const src = sources.get(spec.source)
  const from = spec.frames !== undefined ? spec.frames[Math.min(frame, spec.frames.length - 1)]! : (spec.frame ?? [0, 0])
  const [scw, sch] = spec.cell
  const piece = crop(src, from[0] * scw, from[1] * sch, scw, sch)
  const stats = figureStats(piece)
  const [cw, ch] = sheet.cell
  const out = createRaster(cw, ch)
  if (stats === null) return { cell: out, from, stats }
  let dx: number
  let dy: number
  if (sheet.align === 'ground' && sheet.bottom !== null && sheet.center_x !== null) {
    dx = sheet.center_x - stats.medianX
    dy = sheet.bottom - lift - stats.bottom
  } else {
    const off = spec.offset ?? [Math.floor((cw - scw) / 2), Math.floor((ch - sch) / 2)]
    dx = off[0]
    dy = off[1]
  }
  blit(out, piece, dx, dy)
  return { cell: out, from, stats }
}

function drawGuides(canvas: Raster, sheet: ResolvedSheet, layout: Layout, guide: [number, number, number]): void {
  const { S, x0, y0, gridW, gridH } = layout
  const [W, H] = layout.canvas
  const x1 = x0 + gridW
  const y1 = y0 + gridH
  const [cw, ch] = sheet.cell
  // 여백이 눈금 최소 길이(4)보다 좁으면 그 방향 눈금은 생략한다(띠의 가로 여백 0)
  const hasTop = y0 >= GAP + 4
  const hasSide = x0 >= GAP + 4
  const lenV = (want: number): number => Math.min(want, y0 - GAP)
  const lenH = (want: number): number => Math.min(want, x0 - GAP)
  const vTick = (x: number, w: number, len: number): void => {
    const xa = Math.max(0, Math.min(W - w, x))
    fillRect(canvas, xa, y0 - GAP - len, w, len, guide)
    fillRect(canvas, xa, y1 + GAP, w, len, guide)
  }
  const hTick = (y: number, h: number, len: number): void => {
    const ya = Math.max(0, Math.min(H - h, y))
    fillRect(canvas, x0 - GAP - len, ya, len, h, guide)
    fillRect(canvas, x1 + GAP, ya, len, h, guide)
  }
  if (hasTop) {
    for (let c = 0; c <= sheet.cols; c++) vTick(x0 + c * cw * S - 1, 2, lenV(LONG))
    if (sheet.align === 'ground' && sheet.center_x !== null) {
      for (let c = 0; c < sheet.cols; c++) vTick(x0 + (c * cw + sheet.center_x) * S, Math.max(2, S), lenV(SHORT))
    }
  }
  if (hasSide) {
    for (let r = 0; r <= sheet.rows.length; r++) hTick(y0 + r * ch * S - 1, 2, lenH(LONG))
    if (sheet.align === 'ground' && sheet.ground_y !== null) {
      for (let r = 0; r < sheet.rows.length; r++) {
        const gy = Math.min(sheet.ground_y, ch - 1)
        hTick(y0 + (r * ch + gy) * S, Math.max(2, S), lenH(SHORT))
        // 나는 적: 최하단 화소 바로 아래 행(부양선)도 짧게
        if (sheet.bottom !== null && sheet.bottom + 1 !== sheet.ground_y) {
          hTick(y0 + (r * ch + sheet.bottom + 1) * S, Math.max(2, S), lenH(8))
        }
      }
    }
  }
}

export interface TemplateCellJson {
  col: number
  row: number
  action: string
  frame: number | null
  label: string | null
  used: boolean
  /** 틀 이미지 화소 [x, y, w, h] */
  rect: [number, number, number, number]
  /** 기대 최하단 논리 행과 그 행의 이미지 y 범위 [y0, y1) */
  bottom: number | null
  bottom_px: [number, number] | null
  /** 가로 중심 논리 열과 이미지 x 범위 [x0, x1) */
  center_x: number | null
  center_px: [number, number] | null
  height: number | null
  lift: number
  placeholder_frame: [number, number] | null
}

export interface TemplateJson {
  name: string
  family: string
  note?: string
  canvas: [number, number]
  orientation: 'landscape' | 'portrait'
  S: number
  cell: [number, number]
  cell_px: [number, number]
  grid: { cols: number; rows: number; x0: number; y0: number; width: number; height: number }
  align: 'ground' | 'none'
  ground_y: number | null
  ground_y_px: number[] | null
  bottom: number | null
  center_x: number | null
  margin: number
  fill: 'opaque' | 'partial' | null
  ground_band: boolean
  key_color: string
  guide_color: string
  gate: ResolvedSheet['gate']
  rows: { row: number; action: string; frames: number; labels: string[]; lift: number[]; height: (number | null)[]; note?: string }[]
  used_cells: number
  empty_cells: number
  placeholder: { source: string; height: number | null; note: string } | null
  files: { grid: string; placeholder: string | null; silhouette: string | null }
  cells: TemplateCellJson[]
}

export interface RenderedTemplate {
  json: TemplateJson
  grid: Raster
  placeholder: Raster | null
  silhouette: Raster | null
}

export function renderTemplate(specs: LoadedSpecs, name: string, sources = new SourceCache(specs.root)): RenderedTemplate {
  const sheet = resolveSheet(specs, name)
  const layout = computeLayout(specs, sheet)
  const cells = cellSpecs(sheet, layout)
  const { colors } = specs.file
  const key = hexRgb(colors.key)
  const guide = hexRgb(colors.guide)
  const grey = hexRgb(colors.silhouette)
  const [W, H] = layout.canvas
  const grid = createRaster(W, H)
  fillRect(grid, 0, 0, W, H, key)
  drawGuides(grid, sheet, layout, guide)

  let placeholder: Raster | null = null
  let silhouette: Raster | null = null
  const frames = new Map<string, [number, number]>()
  let placeholderHeight: number | null = null
  if (sheet.placeholder !== null) {
    placeholder = { width: W, height: H, rgba: grid.rgba.slice() }
    silhouette = { width: W, height: H, rgba: grid.rgba.slice() }
    for (const c of cells) {
      if (!c.used) continue
      const rowSpec = sheet.rows[c.row]!
      if (rowSpec.placeholder === null) continue
      const { cell, from, stats } = placeholderCell(sheet, rowSpec.placeholder, c.frame!, c.lift, sources)
      frames.set(`${c.col},${c.row}`, from)
      if (placeholderHeight === null && stats !== null) placeholderHeight = stats.height
      const big = upscale(cell, layout.S)
      blit(placeholder, big, c.x, c.y)
      for (let i = 0; i < big.width * big.height; i++) {
        if (big.rgba[i * 4 + 3]! === 0) continue
        big.rgba[i * 4] = grey[0]
        big.rgba[i * 4 + 1] = grey[1]
        big.rgba[i * 4 + 2] = grey[2]
      }
      blit(silhouette, big, c.x, c.y)
    }
  }

  const S = layout.S
  const json: TemplateJson = {
    name,
    family: sheet.family,
    ...(sheet.note === undefined ? {} : { note: sheet.note }),
    canvas: layout.canvas,
    orientation: layout.orientation,
    S,
    cell: sheet.cell,
    cell_px: [sheet.cell[0] * S, sheet.cell[1] * S],
    grid: { cols: sheet.cols, rows: sheet.rows.length, x0: layout.x0, y0: layout.y0, width: layout.gridW, height: layout.gridH },
    align: sheet.align,
    ground_y: sheet.ground_y,
    ground_y_px: sheet.ground_y === null ? null : sheet.rows.map((r) => layout.y0 + (r.row * sheet.cell[1] + sheet.ground_y!) * S),
    bottom: sheet.bottom,
    center_x: sheet.center_x,
    margin: sheet.margin,
    fill: sheet.fill,
    ground_band: sheet.groundBand,
    key_color: colors.key,
    guide_color: colors.guide,
    gate: sheet.gate,
    rows: sheet.rows.map((r) => ({
      row: r.row, action: r.action, frames: r.frames, labels: r.labels, lift: r.lift, height: r.height,
      ...(r.note === undefined ? {} : { note: r.note }),
    })),
    used_cells: cells.filter((c) => c.used).length,
    empty_cells: cells.filter((c) => !c.used).length,
    placeholder: sheet.placeholder === null ? null : {
      source: sheet.placeholder.source,
      height: placeholderHeight,
      note: '자리표시는 크기·위치 기준일 뿐이다. 생성기는 그 자리에 새로 그린다(자세는 행 동작을 따른다)',
    },
    files: {
      grid: `${name}.grid.png`,
      placeholder: placeholder === null ? null : `${name}.placeholder.png`,
      silhouette: silhouette === null ? null : `${name}.silhouette.png`,
    },
    cells: cells.map((c) => ({
      col: c.col,
      row: c.row,
      action: c.action,
      frame: c.frame,
      label: c.label,
      used: c.used,
      rect: [c.x, c.y, c.w, c.h],
      bottom: c.bottom,
      bottom_px: c.bottom === null ? null : [c.y + c.bottom * S, c.y + (c.bottom + 1) * S],
      center_x: c.center ? sheet.center_x : null,
      center_px: c.center ? [c.x + sheet.center_x! * S, c.x + (sheet.center_x! + 1) * S] : null,
      height: c.height,
      lift: c.lift,
      placeholder_frame: frames.get(`${c.col},${c.row}`) ?? null,
    })),
  }
  return { json, grid, placeholder, silhouette }
}

/** 틀 PNG(인덱스 색 — 단색 면이라 작다)와 JSON을 outDir에 쓴다. 쓴 파일 경로 목록 */
export function writeTemplate(t: RenderedTemplate, outDir: string): string[] {
  mkdirSync(outDir, { recursive: true })
  const written: string[] = []
  const put = (file: string, r: Raster): void => {
    const p = join(outDir, file)
    writeFileSync(p, encodeIndexedPng(r.width, r.height, r.rgba))
    written.push(p)
  }
  put(t.json.files.grid, t.grid)
  if (t.placeholder !== null && t.json.files.placeholder !== null) put(t.json.files.placeholder, t.placeholder)
  if (t.silhouette !== null && t.json.files.silhouette !== null) put(t.json.files.silhouette, t.silhouette)
  const jp = join(outDir, `${t.json.name}.json`)
  writeFileSync(jp, JSON.stringify(t.json, null, 2) + '\n')
  written.push(jp)
  return written
}

export { SourceCache }
