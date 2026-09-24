// 납품 문(art:gate). 생성기가 틀(art:template)을 받아 그린 PNG를 틀 규격과 대조해 합격·불합격을 가르고,
// 다시 생성할 때 프롬프트에 그대로 붙일 영어 지적문을 만든다.
//   캔버스 모드(기본): 캔버스 크기가 틀과 같아야 하고, 칸 위치는 틀 JSON과 같은 계산(computeLayout)에서 온다.
//   --no-canvas: 틀 없이 만든 옛 납품용. 이미지를 열×행 등간격으로 나눠 칸을 정하고, S는 그림에서 잰 화소 블록 크기(칸별 추정의
//                중앙값, 못 재면 그림 키)로 둔다. 지면선은 같은 행, 가로 중심은 같은 열 칸들의 중앙값(내용에서 추정한 격자선)과 비교한다.
// 그림 화소 = 배경 열쇠(알파·자홍·자홍 번짐)가 아니고 안내 색(#00FFFF)도 아닌 화소. 8방향 덩어리의 무게중심이 든 칸이 주인이다.
import { cellRects, colorDistance, isBackground, type KeyOptions } from './normalize'
import { hexRgb } from './raster'
import {
  cellSpecs,
  computeLayout,
  resolveSheet,
  type CellSpec,
  type GateTolerances,
  type LoadedSpecs,
  type ResolvedSheet,
  type SheetRow,
} from './template-spec'

export interface GateImage {
  width: number
  height: number
  rgba: Uint8Array
}

export interface GateOptions {
  noCanvas: boolean
  rowsOverride?: SheetRow[]
  /** 허용치 덮어쓰기 */
  tolerances?: Partial<GateTolerances>
}

export interface GateFailure {
  code: 'canvas' | 'background' | 'guide' | 'stray' | 'missing' | 'unexpected' | 'bbox' | 'ground' | 'center' | 'height' | 'block' | 'alpha' | 'fill' | 'ground_band'
  cell: [number, number] | null
  message: string
}

export interface GateCell {
  col: number
  row: number
  action: string
  label: string | null
  used: boolean
  pass: boolean
  pixels: number
  /** 이미지 화소 bbox [x0, y0, x1, y1)(끝 제외) */
  bbox: [number, number, number, number] | null
  /** 최하단 차이(논리 화소, +는 기대보다 아래). 캔버스 모드 = 기대 행과, no-canvas = 같은 행 중앙값과 */
  ground_delta: number | null
  /** 가로 중심 차이(논리 화소, +는 오른쪽) */
  center_delta: number | null
  /** 그림 키(논리 화소)와 기준 키 */
  height: number | null
  height_expected: number | null
  /** 이 칸에서 잰 화소 블록 크기(이미지 화소) */
  block: number | null
  /** 그림 속 반투명 비율 */
  partial_alpha: number
  /** 띠: 칸 채움 비율 · 지면 아래 채움 비율 */
  fill: number | null
  ground_fill: number | null
  codes: GateFailure['code'][]
}

export interface GateResult {
  pass: boolean
  spec: string
  mode: 'canvas' | 'no-canvas'
  image: [number, number]
  canvas: [number, number]
  /** 판정에 쓴 논리 화소 1개의 이미지 화소 수 */
  S: number
  S_origin: 'template' | 'figure_height' | 'block' | 'cell_ratio'
  /** 시트 전체에서 잰 화소 블록 크기 */
  block_sheet: number | null
  /** 그림 bbox 밖 영역 가운데 배경 비율 */
  background_ratio: number
  guide_pixels: number
  stray_pixels: number
  specks: number
  tolerances: GateTolerances
  cells: GateCell[]
  failures: GateFailure[]
  feedback: string
}

interface Rect { x: number; y: number; w: number; h: number }

const round1 = (n: number): number => Math.round(n * 10) / 10
const blocks = (n: number): string => `${round1(Math.abs(n))} block${Math.abs(round1(n)) === 1 ? '' : 's'}`

function median(v: number[]): number | null {
  if (v.length === 0) return null
  const s = [...v].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** 칸 이름(영어 지적문용). 0부터 센 (열,행)과 동작 라벨 */
const cellName = (c: { col: number; row: number; label: string | null; action: string }): string =>
  `Cell (${c.col},${c.row}) "${c.label ?? `${c.action} (empty)`}"`

export function runGate(specs: LoadedSpecs, specName: string, img: GateImage, opts: GateOptions): GateResult {
  const sheet: ResolvedSheet = resolveSheet(specs, specName, opts.rowsOverride)
  const tol: GateTolerances = { ...sheet.gate, ...(opts.tolerances ?? {}) }
  const layout = computeLayout(specs, sheet)
  const cellsSpec = cellSpecs(sheet, layout)
  const [cw, ch] = sheet.cell
  const W = img.width
  const H = img.height
  const failures: GateFailure[] = []
  const fail = (code: GateFailure['code'], cell: [number, number] | null, message: string): void => { failures.push({ code, cell, message }) }

  // ── 칸 사각형과 S ──
  const mode: GateResult['mode'] = opts.noCanvas ? 'no-canvas' : 'canvas'
  const canvasOk = W === layout.canvas[0] && H === layout.canvas[1]
  let rects: Rect[]
  let S = layout.S
  let S_origin: GateResult['S_origin'] = 'template'
  if (!opts.noCanvas) {
    if (!canvasOk) {
      fail('canvas', null, `The image must be exactly ${layout.canvas[0]}x${layout.canvas[1]} pixels (the template canvas); the delivery is ${W}x${H}. Keep the template canvas size and grid position unchanged.`)
    }
    rects = cellsSpec.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h }))
  } else {
    rects = cellRects(W, H, sheet.cols, sheet.rows.length).map((r) => ({ x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0 }))
    S = Math.min(rects[0]!.w / cw, rects[0]!.h / ch)
    S_origin = 'cell_ratio'
  }

  // ── 화소 분류 ──
  const k = specs.file.key
  const key: KeyOptions = { key: hexRgb(specs.file.colors.key), tolerance: k.tolerance, alphaThreshold: k.alpha_threshold, despill: k.despill }
  const guide = hexRgb(specs.file.colors.guide)
  const fg = new Uint8Array(W * H)
  let guidePixels = 0
  for (let i = 0; i < W * H; i++) {
    const o = i * 4
    if (isBackground(img.rgba, o, key)) continue
    const dr = img.rgba[o]! - guide[0]
    const dg = img.rgba[o + 1]! - guide[1]
    const db = img.rgba[o + 2]! - guide[2]
    if (dr * dr + dg * dg + db * db <= 80 * 80) {
      guidePixels++
      continue
    }
    fg[i] = 1
  }

  // ── 덩어리 → 칸 ──
  const minSpeck = Math.max(2, Math.floor((S * S) / 2))
  const owner = new Int32Array(W * H).fill(-1) // 칸 번호, -2 = 격자 밖, -3 = 작은 티
  const stack = new Int32Array(W * H)
  const comp: number[] = []
  let stray = 0
  let specks = 0
  const gx0 = opts.noCanvas ? 0 : layout.x0
  const gy0 = opts.noCanvas ? 0 : layout.y0
  const gw = opts.noCanvas ? W : layout.gridW
  const gh = opts.noCanvas ? H : layout.gridH
  const nCells = cellsSpec.length
  const boxes: ([number, number, number, number] | null)[] = new Array(nCells).fill(null)
  const seen = new Uint8Array(W * H)
  for (let start = 0; start < W * H; start++) {
    if (!fg[start] || seen[start]) continue
    let sp = 0
    stack[sp++] = start
    seen[start] = 1
    comp.length = 0
    let sx = 0
    let sy = 0
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity
    while (sp > 0) {
      const p = stack[--sp]!
      comp.push(p)
      const px = p % W
      const py = (p - px) / W
      sx += px
      sy += py
      if (px < bx0) bx0 = px
      if (px > bx1) bx1 = px
      if (py < by0) by0 = py
      if (py > by1) by1 = py
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
    let cell = -3
    if (comp.length >= minSpeck) {
      const cx = sx / comp.length + 0.5
      const cy = sy / comp.length + 0.5
      if (cx < gx0 || cy < gy0 || cx >= gx0 + gw || cy >= gy0 + gh) cell = -2
      else {
        const c = Math.min(sheet.cols - 1, Math.floor(((cx - gx0) * sheet.cols) / gw))
        const r = Math.min(sheet.rows.length - 1, Math.floor(((cy - gy0) * sheet.rows.length) / gh))
        cell = r * sheet.cols + c
        const b = boxes[cell] ?? null
        boxes[cell] = b === null
          ? [bx0, by0, bx1 + 1, by1 + 1]
          : [Math.min(b[0], bx0), Math.min(b[1], by0), Math.max(b[2], bx1 + 1), Math.max(b[3], by1 + 1)]
      }
    }
    if (cell === -2) stray += comp.length
    if (cell === -3) specks++
    for (const p of comp) owner[p] = cell
  }

  // ── 칸별 사실 ──
  interface Facts { pixels: number; bbox: [number, number, number, number] | null; medX: number; interior: number; partial: number; block: number | null; fill: number; groundFill: number | null }
  const facts: Facts[] = cellsSpec.map((c, i) => {
    const b = boxes[i] ?? null
    const rect = rects[i]!
    let pixels = 0
    let interior = 0
    let partial = 0
    let medX = 0
    let block: number | null = null
    if (b !== null) {
      const [x0, y0, x1, y1] = b
      const colCount = new Int32Array(x1 - x0)
      const bw = x1 - x0
      const bh = y1 - y0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const p = y * W + x
          if (owner[p] !== i) continue
          pixels++
          colCount[x - x0]!++
          const o = p * 4
          if (x > 0 && x < W - 1 && y > 0 && y < H - 1 && fg[p - 1] && fg[p + 1] && fg[p - W] && fg[p + W]) {
            interior++
            if (img.rgba[o + 3]! < 255) partial++
          }
        }
      }
      let acc = 0
      for (let x = 0; x < colCount.length; x++) {
        acc += colCount[x]!
        if (acc * 2 >= pixels) { medX = x0 + x; break }
      }
      block = estimateBlock(img, owner, i, x0, y0, bw, bh)
    }
    // 띠 채움: 칸 사각형 안의 그림 화소(주인 무관) 비율
    let fill = 0
    let groundFill: number | null = null
    if (sheet.fill !== null) {
      let n = 0
      let g = 0
      let gn = 0
      const gRow = sheet.ground_y === null ? null : Math.round(sheet.ground_y * (rect.h / ch))
      for (let y = Math.max(0, rect.y); y < Math.min(H, rect.y + rect.h); y++) {
        for (let x = Math.max(0, rect.x); x < Math.min(W, rect.x + rect.w); x++) {
          const on = fg[y * W + x] === 1
          if (on) n++
          if (gRow !== null && y - rect.y >= gRow) { gn++; if (on) g++ }
        }
      }
      fill = n / Math.max(1, rect.w * rect.h)
      groundFill = gRow === null ? null : g / Math.max(1, gn)
    }
    return { pixels, bbox: b, medX, interior, partial, block, fill, groundFill }
  })

  // ── no-canvas: S와 기준 ──
  const allBlocks = facts.map((f) => f.block).filter((b): b is number => b !== null)
  const blockSheet = median(allBlocks)
  if (opts.noCanvas) {
    const ratios: number[] = []
    cellsSpec.forEach((c, i) => {
      const f = facts[i]!
      if (c.used && c.height !== null && f.bbox !== null) ratios.push((f.bbox[3] - f.bbox[1]) / c.height)
    })
    // 논리 화소 = 그림의 화소 블록. 블록을 못 재면 그림 키에서 거꾸로 잰다(그때 키 검사는 칸끼리 비교가 된다)
    const fromHeight = median(ratios)
    if (blockSheet !== null) { S = blockSheet; S_origin = 'block' }
    else if (fromHeight !== null) { S = fromHeight; S_origin = 'figure_height' }
  }
  // no-canvas 기준(내용에서 추정한 격자선): 지면선은 같은 행 칸들의 최하단(+lift) 중앙값, 가로 중심은 같은 열 칸들의 중앙값.
  // 생성 그림의 행·열 간격이 고르지 않아 시트 전체 중앙값과 비교하면 행마다 통째로 어긋난다
  const refBottom = (row: number): number | null => median(cellsSpec.flatMap((c, i) =>
    (c.row === row && c.bottom !== null && facts[i]!.bbox !== null ? [facts[i]!.bbox![3] - 1 - rects[i]!.y + c.lift * S] : [])))
  const refCenter = (col: number): number | null => median(cellsSpec.flatMap((c, i) =>
    (c.col === col && c.center && facts[i]!.bbox !== null ? [facts[i]!.medX - rects[i]!.x] : [])))

  // ── 판정 ──
  const minContent = Math.max(4, Math.round(4 * S * S))
  const cellsOut: GateCell[] = []
  const skipCells = !opts.noCanvas && !canvasOk
  cellsSpec.forEach((c: CellSpec, i) => {
    const f = facts[i]!
    const rect = rects[i]!
    const codes: GateFailure['code'][] = []
    const at: [number, number] = [c.col, c.row]
    const name = cellName(c)
    const bad = (code: GateFailure['code'], msg: string): void => { codes.push(code); fail(code, at, `${name}: ${msg}`) }
    const out: GateCell = {
      col: c.col, row: c.row, action: c.action, label: c.label, used: c.used, pass: true, pixels: f.pixels,
      bbox: f.bbox, ground_delta: null, center_delta: null, height: null, height_expected: c.height, block: f.block,
      partial_alpha: f.interior === 0 ? 0 : f.partial / f.interior,
      fill: sheet.fill === null ? null : f.fill, ground_fill: f.groundFill, codes,
    }
    cellsOut.push(out)
    if (skipCells) return
    if (!c.used) {
      if (f.pixels >= minContent) bad('unexpected', `this cell must stay empty (flat ${specs.file.colors.key} background), but it contains ${f.pixels} px of drawing. Leave it completely empty.`)
      out.pass = codes.length === 0
      return
    }
    if (f.pixels < minContent || f.bbox === null) {
      bad('missing', `the cell is empty or nearly empty (${f.pixels} px). Draw the "${c.label}" frame here.`)
      out.pass = false
      return
    }
    const [bx0, by0, bx1, by1] = f.bbox
    // bbox 안쪽
    const m = sheet.margin * S
    const over: string[] = []
    const left = rect.x + m - bx0
    const right = bx1 - (rect.x + rect.w - m)
    const top = rect.y + m - by0
    const bottom = by1 - (rect.y + rect.h - m)
    if (left > 0) over.push(`left by ${blocks(left / S)}`)
    if (right > 0) over.push(`right by ${blocks(right / S)}`)
    if (top > 0) over.push(`top by ${blocks(top / S)}`)
    if (bottom > 0) over.push(`bottom by ${blocks(bottom / S)}`)
    if (over.length > 0) {
      bad('bbox', `the drawing crosses the cell boundary${sheet.margin > 0 ? ` (keep a ${sheet.margin}-block empty margin inside the cell)` : ''} on the ${over.join(', ')}. Keep every pixel inside its own cell.`)
    }
    // 지면선
    if (c.bottom !== null) {
      let d: number
      if (!opts.noCanvas) d = Math.floor((by1 - 1 - rect.y) / S) - c.bottom
      else d = Math.round((by1 - 1 - rect.y + c.lift * S - refBottom(c.row)!) / S)
      out.ground_delta = d
      if (Math.abs(d) > tol.ground_tol) {
        const line = sheet.bottom !== null && sheet.ground_y !== null && sheet.bottom + 1 !== sheet.ground_y ? 'hover line' : 'ground line'
        const want = c.lift > 0 ? ` (this frame must float exactly ${c.lift} blocks above the ${line})` : ''
        const ref = opts.noCanvas ? `the ${line} of the other frames in this row` : `the ${line}`
        bad('ground', d < 0
          ? `the lowest pixel is ${blocks(-d)} above ${ref}${want}; move the figure down ${blocks(-d)} so the lowest pixel sits directly on the ${line}.`
          : `the lowest pixel is ${blocks(d)} below ${ref}${want}; move the figure up ${blocks(d)} so the lowest pixel sits directly on the ${line}.`)
      }
    }
    // 가로 중심
    if (c.center && sheet.center_x !== null) {
      const d = !opts.noCanvas
        ? (f.medX - rect.x + 0.5) / S - (sheet.center_x + 0.5)
        : (f.medX - rect.x - refCenter(c.col)!) / S
      out.center_delta = round1(d)
      if (Math.abs(d) > tol.center_tol) {
        const ref = opts.noCanvas ? 'the center of the other frames in this column' : 'the center mark'
        bad('center', `the figure's horizontal center is ${blocks(d)} ${d > 0 ? 'right' : 'left'} of ${ref}; move it ${blocks(d)} ${d > 0 ? 'left' : 'right'}.`)
      }
    }
    // 키
    const h = (by1 - by0) / S
    out.height = round1(h)
    if (c.height !== null && Math.abs(h / c.height - 1) > tol.height_tol) {
      bad('height', `the figure is ${round1(h)} blocks tall but must be ${c.height} blocks tall (±${Math.round(tol.height_tol * 100)}%); ${h > c.height ? 'draw it smaller' : 'draw it larger'} to match the reference figure, keeping one art pixel = one ${round1(S)}x${round1(S)} block.`)
    }
    // 화소 블록
    if (f.block !== null && Math.abs(f.block / S - 1) > tol.block_tol) {
      bad('block', `the art pixels are about ${round1(f.block)} image pixels wide, but every art pixel must be a ${round1(S)}x${round1(S)} block. Redraw on the ${round1(S)}-pixel grid; do not rescale or blur.`)
    }
    // 반투명
    if (out.partial_alpha > tol.max_partial_alpha) {
      bad('alpha', `${round1(out.partial_alpha * 100)}% of the pixels inside the figure are semi-transparent; every figure pixel must be fully opaque with hard edges (no anti-aliasing, no soft glow).`)
    }
    // 띠
    if (sheet.fill === 'opaque' && f.fill < tol.min_fill) {
      bad('fill', `only ${round1(f.fill * 100)}% of the frame is painted; fill the whole ${cw}x${ch}-block frame edge to edge with opaque scenery (no magenta or transparent gaps).`)
    }
    if (sheet.groundBand && f.groundFill !== null && f.groundFill < tol.min_fill) {
      bad('ground_band', `only ${round1(f.groundFill * 100)}% of the rows below the ground line (row ${sheet.ground_y}) are painted; the walkable ground must fill every column from the ground line to the bottom edge.`)
    }
    out.pass = codes.length === 0
  })

  // ── 시트 전체 ──
  const covered = new Uint8Array(W * H)
  cellsSpec.forEach((c, i) => {
    const b = facts[i]!.bbox
    if (!c.used || b === null) return
    for (let y = b[1]; y < b[3]; y++) covered.fill(1, y * W + b[0], y * W + b[2])
    if (sheet.fill !== null) {
      const r = rects[i]!
      for (let y = Math.max(0, r.y); y < Math.min(H, r.y + r.h); y++) covered.fill(1, y * W + Math.max(0, r.x), y * W + Math.min(W, r.x + r.w))
    }
  })
  let open = 0
  let openBg = 0
  for (let i = 0; i < W * H; i++) {
    if (covered[i]) continue
    open++
    if (!fg[i]) openBg++
  }
  const backgroundRatio = open === 0 ? 1 : openBg / open
  if (!skipCells && backgroundRatio < tol.min_background) {
    fail('background', null, `Only ${round1(backgroundRatio * 100)}% of the area outside the figures is clean background; the background must be one flat ${specs.file.colors.key} magenta (or fully transparent) everywhere, with no gradient, texture, floor, shadow or stray marks.`)
  }
  if (guidePixels > tol.max_guide_pixels) {
    fail('guide', null, `Remove the cyan ${specs.file.colors.guide} guide marks: ${guidePixels} cyan pixels were found. The guide ticks are for placement only and must not appear in the output.`)
  }
  if (!opts.noCanvas && canvasOk && stray >= minContent) {
    fail('stray', null, `Remove the drawing outside the grid: ${stray} px of figures were found in the canvas margin. Everything must be inside the grid cells.`)
  }

  const pass = failures.length === 0
  return {
    pass,
    spec: specName,
    mode,
    image: [W, H],
    canvas: layout.canvas,
    S: Math.round(S * 100) / 100,
    S_origin,
    block_sheet: blockSheet === null ? null : round1(blockSheet),
    background_ratio: Math.round(backgroundRatio * 10000) / 10000,
    guide_pixels: guidePixels,
    stray_pixels: stray,
    specks,
    tolerances: tol,
    cells: cellsOut,
    failures,
    feedback: feedbackText(failures, pass, specName, layout.S, opts.noCanvas),
  }
}

const MAX_FEEDBACK = 30

/** 다시 생성할 때 프롬프트에 붙일 영어 문단 */
export function feedbackText(failures: GateFailure[], pass: boolean, spec: string, S: number, noCanvas: boolean): string {
  if (pass) return `The delivery matches the ${spec} template. No regeneration needed.`
  const head = `Regenerate this sheet on the ${spec} template (one art pixel = ${S}x${S} image pixels; cells are numbered (column,row) from 0 at the top-left). Fix exactly these problems and change nothing else:`
  const lines = failures.slice(0, MAX_FEEDBACK).map((f) => `- ${f.message}`)
  if (failures.length > MAX_FEEDBACK) lines.push(`- ...and ${failures.length - MAX_FEEDBACK} more problems of the same kinds.`)
  const tail = noCanvas ? ['(Measured without the template canvas: the ground line is compared between frames of the same row and the center between frames of the same column, not against the template marks.)'] : []
  return [head, ...lines, ...tail].join('\n')
}

const EDGE_CAP = 150
const MAX_LAG = 40

/**
 * 화소 블록 크기(이미지 화소) 추정. 칸 주인 화소의 bbox 안에서 행·열마다 이웃 화소 색 차이(가중 거리, 150에서 자름;
 * 그림↔배경 경계 = 150)의 신호를 만들고 평균을 뺀 자기상관 A(d)를 모두 더한다. 블록 경계는 d = 블록 크기의 배수에서
 * 겹치므로 d ∈ [3, 40]의 극대점 가운데 가장 높은 것의 절반 이상인 가장 짧은 d(포물선 보간)를 고른다. 경계 위치를
 * 절대 좌표로 재지 않아 생성 그림의 격자 흔들림에 강하다. 정규화 A(d)/A(0) 극대가 0.03 미만이거나 극대점이 없으면 null.
 */
export function estimateBlock(img: GateImage, owner: Int32Array, cell: number, x0: number, y0: number, w: number, h: number): number | null {
  if (w < 8 || h < 8) return null
  const W = img.width
  const d = img.rgba
  const A = new Float64Array(MAX_LAG + 2)
  const edge = (a: number, b: number): number => {
    const fa = owner[a] === cell
    const fb = owner[b] === cell
    if (!fa && !fb) return 0
    if (fa !== fb) return EDGE_CAP
    return Math.min(EDGE_CAP, colorDistance(d[a * 4]!, d[a * 4 + 1]!, d[a * 4 + 2]!, d[b * 4]!, d[b * 4 + 1]!, d[b * 4 + 2]!))
  }
  const acc = (e: Float64Array, n: number): void => {
    let m = 0
    for (let i = 0; i < n; i++) m += e[i]!
    m /= n
    for (let lag = 0; lag < A.length && lag < n; lag++) {
      let s = 0
      for (let i = 0; i + lag < n; i++) s += (e[i]! - m) * (e[i + lag]! - m)
      A[lag]! += s
    }
  }
  const row = new Float64Array(w + 1)
  for (let y = y0; y < y0 + h; y++) {
    for (let x = 0; x <= w; x++) {
      const px = x0 + x
      row[x] = px <= 0 || px >= W ? 0 : edge(y * W + px - 1, y * W + px)
    }
    acc(row, w + 1)
  }
  const col = new Float64Array(h + 1)
  for (let x = x0; x < x0 + w; x++) {
    for (let y = 0; y <= h; y++) {
      const py = y0 + y
      col[y] = py <= 0 || py >= img.height ? 0 : edge((py - 1) * W + x, py * W + x)
    }
    acc(col, h + 1)
  }
  if (A[0]! <= 0) return null
  const n = Array.from(A, (v) => v / A[0]!)
  // 극대점 가운데 가장 높은 것의 절반 이상인 가장 짧은 지연 = 기본 주기(깨끗한 그림은 2블록 배수가 더 높게 솟기도 한다)
  const peaks: number[] = []
  for (let k = 3; k <= MAX_LAG; k++) if (n[k]! >= n[k - 1]! && n[k]! > n[k + 1]!) peaks.push(k)
  if (peaks.length === 0) return null
  const top = Math.max(...peaks.map((k) => n[k]!))
  if (top < 0.03) return null
  const best = peaks.find((k) => n[k]! >= 0.5 * top)!
  const den = n[best - 1]! - 2 * n[best]! + n[best + 1]!
  const off = den === 0 ? 0 : (0.5 * (n[best - 1]! - n[best + 1]!)) / den
  return Math.round((best + Math.max(-0.5, Math.min(0.5, off))) * 100) / 100
}
