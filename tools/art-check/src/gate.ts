// 납품 문(art:gate). 생성기가 틀(art:template)을 받아 그린 PNG를 틀 규격과 대조해 합격·불합격을 가르고,
// 다시 생성할 때 프롬프트에 그대로 붙일 영어 지적문을 만든다.
//   캔버스 모드(기본): 캔버스 크기가 틀과 같아야 하고, 칸 위치는 틀 JSON과 같은 계산(computeLayout)에서 온다.
//   --no-canvas: 틀 없이 만든 옛 납품용. 이미지를 열×행 등간격으로 나눠 칸을 정하고, S는 그림에서 잰 화소 블록 크기(칸별 추정의
//                중앙값, 못 재면 그림 키)로 둔다. 지면선은 같은 행, 가로 중심은 같은 열 칸들의 중앙값(내용에서 추정한 격자선)과 비교한다.
// 그림 화소 = 배경 열쇠(알파·자홍·자홍 번짐)가 아니고 안내 색(#00FFFF)도 아닌 화소.
// 스프라이트는 덩어리의 무게중심, 서로 붙는 장면·배경 띠는 칸 좌표로 주인을 정한다.
// 스프라이트가 틀 칸(또는 등간격 칸)에 맞게 앉지 않았으면 내용에서 격자를 추정한다: 큰 덩어리를 무게중심 y 간격으로
// 행에 묶고, 행 안은 x 순서로 프레임을 매겨 규격 칸 수·순서와 대조한다(맞을 때만 쓴다).
//
// 판정 원칙: 정규화(art:normalize)가 고칠 수 없는 것만 실패(FAIL, 종료 1, 다시 생성 지적문에 들어간다).
//   실패 = 캔버스 크기(틀 모드) · 그림 수/칸 배치 · 이웃 그림과 닿음·겹침 · 이미지 가장자리에 닿음 · 시트 안 축척 불일치
//          (키/기준키 비율이 행 중앙값 또는 행끼리 scale_tol 초과) · 행 안 지면선 불일치(ground_tol 초과) · 안내 색 · 배경 열쇠 불가 · 반투명 속 · 띠 채움
// 정규화가 고치는 것은 경고(WARN, 종료 0, 지적문에 넣지 않는다).
//   경고 = 규격 키와의 차이(정규화가 걸 배율을 알린다) · 틀 지면선·중심 표시와의 차이 · 칸 경계 넘음 · 그린 화소 블록 크기 ≠ S ·
//          배경이 정확한 #FF00FF가 아님(열쇠 허용 안)
// 단위: 논리 화소 = 이미지 화소 / S. 틀 모드 S = 틀 S, --no-canvas S = 칸 화소 / 칸 논리 크기(정규화 cell_ratio와 같은 값).
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
  code: 'canvas' | 'background' | 'guide' | 'stray' | 'missing' | 'unexpected' | 'touch' | 'edge' | 'scale' | 'ground' | 'alpha' | 'fill' | 'ground_band'
  cell: [number, number] | null
  message: string
}

/** 정규화가 고치는 차이. 종료 코드와 지적문에 영향 없음 */
export interface GateWarning {
  code: 'height' | 'ground' | 'center' | 'bbox' | 'block' | 'key_color'
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
  /** 최하단 차이(논리 화소, +는 아래). 같은 행 프레임들의 중앙값과(실패 기준) */
  ground_delta: number | null
  /** 틀 모드: 틀 지면선(− lift)과의 최하단 차이(경고 기준). no-canvas는 null */
  ground_template: number | null
  /** 가로 중심 차이(논리 화소, +는 오른쪽). 틀 모드 = 중심 표시와, no-canvas = 같은 열 중앙값과(경고 기준) */
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
  warns: GateWarning['code'][]
}

export interface GateResult {
  pass: boolean
  spec: string
  mode: 'canvas' | 'no-canvas'
  image: [number, number]
  canvas: [number, number]
  /** 판정에 쓴 논리 화소 1개의 이미지 화소 수 */
  S: number
  S_origin: 'template' | 'cell_ratio'
  /** 칸 배정: cells = 틀(또는 등간격) 칸에 무게중심, inferred = 내용에서 추정한 격자 */
  grid: 'cells' | 'inferred'
  /** 시트 전체에서 잰 화소 블록 크기 */
  block_sheet: number | null
  /** 키/기준키 비율의 시트 중앙값(행 중앙값들의 중앙값). 키 검사 프레임이 없으면 null */
  height_ratio: number | null
  /** 정규화가 규격 키에 맞추려면 걸 배율(= 1 / height_ratio) */
  scale_factor: number | null
  /** 그림 bbox 밖 영역 가운데 배경 비율 */
  background_ratio: number
  guide_pixels: number
  stray_pixels: number
  specks: number
  tolerances: GateTolerances
  cells: GateCell[]
  failures: GateFailure[]
  warnings: GateWarning[]
  feedback: string
}

interface Rect { x: number; y: number; w: number; h: number }

/** 이 알파 미만인 그림 속 화소가 반투명이다. 224 이상(거의 불투명)은 정규화가 알파 2값으로 고친다 */
const SEMI_ALPHA = 224

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
    // 정규화(cell_ratio)와 같은 논리 화소: 칸 화소 / 칸 논리 크기의 큰 값
    S = Math.max(W / sheet.cols / cw, H / sheet.rows.length / ch)
    S_origin = 'cell_ratio'
  }

  // ── 화소 분류 ──
  const k = specs.file.key
  const key: KeyOptions = { key: hexRgb(specs.file.colors.key), tolerance: k.tolerance, alphaThreshold: k.alpha_threshold, despill: k.despill }
  const guide = hexRgb(specs.file.colors.guide)
  const fg = new Uint8Array(W * H)
  let guidePixels = 0
  // 불투명 배경 화소 가운데 정확한 열쇠 색이 아닌 것(경고)
  let keyBg = 0
  let keyOff = 0
  const keySum: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < W * H; i++) {
    const o = i * 4
    if (isBackground(img.rgba, o, key)) {
      if (img.rgba[o + 3]! >= key.alphaThreshold) {
        keyBg++
        const [r, g, b] = [img.rgba[o]!, img.rgba[o + 1]!, img.rgba[o + 2]!]
        if (r !== key.key![0] || g !== key.key![1] || b !== key.key![2]) keyOff++
        keySum[0] += r; keySum[1] += g; keySum[2] += b
      }
      continue
    }
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
  const minContent = Math.max(4, Math.round(4 * S * S))
  const comps: Comp[] = []
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

  // 불투명 띠는 칸끼리 연결된다. 실제 칸으로 나누고 띠 밖 화소는 따로 실패시킨다.
  if (sheet.fill !== null) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x
        if (!fg[p]) { continue }
        if (x < gx0 || y < gy0 || x >= gx0 + gw || y >= gy0 + gh) {
          owner[p] = -2
          stray++
          continue
        }
        const col = Math.floor(((x - gx0) * sheet.cols) / gw)
        const row = Math.floor(((y - gy0) * sheet.rows.length) / gh)
        const cell = row * sheet.cols + col
        owner[p] = cell
        const box = boxes[cell]
        boxes[cell] = box === null || box === undefined
          ? [x, y, x + 1, y + 1]
          : [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x + 1), Math.max(box[3], y + 1)]
      }
    }
  }

  for (let start = 0; sheet.fill === null && start < W * H; start++) {
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
    comps.push({ px: Int32Array.from(comp), cx: sx / comp.length + 0.5, cy: sy / comp.length + 0.5, box: [bx0, by0, bx1 + 1, by1 + 1] })
  }
  // 1차: 무게중심이 든 틀(등간격) 칸. 규격 칸 배치와 안 맞으면 내용에서 추정한 격자가 맞는지 본다
  const gridCell = (k: Comp): number => {
    if (k.px.length < minSpeck) return -3
    if (k.cx < gx0 || k.cy < gy0 || k.cx >= gx0 + gw || k.cy >= gy0 + gh) return -2
    const c = Math.min(sheet.cols - 1, Math.floor(((k.cx - gx0) * sheet.cols) / gw))
    const r = Math.min(sheet.rows.length - 1, Math.floor(((k.cy - gy0) * sheet.rows.length) / gh))
    return r * sheet.cols + c
  }
  const fitsSpec = (a: number[]): boolean => {
    const sum = new Array<number>(nCells).fill(0)
    a.forEach((cell, j) => { if (cell >= 0) sum[cell]! += comps[j]!.px.length })
    return cellsSpec.every((c, i) => (sum[i]! >= minContent) === c.used)
  }
  let assign: number[] = comps.map(gridCell)
  let gridMode: GateResult['grid'] = 'cells'
  if (sheet.fill === null && !fitsSpec(assign)) {
    const inferred = inferCells(comps, sheet.rows.map((r) => r.frames), sheet.cols, minSpeck)
    if (inferred !== null && fitsSpec(inferred)) {
      assign = inferred
      gridMode = 'inferred'
    }
  }
  comps.forEach((k, j) => {
    const cell = assign[j]!
    if (cell === -2) stray += k.px.length
    if (cell === -3) specks++
    for (const p of k.px) owner[p] = cell
    if (cell < 0) return
    const b = boxes[cell] ?? null
    boxes[cell] = b === null
      ? [...k.box]
      : [Math.min(b[0], k.box[0]), Math.min(b[1], k.box[1]), Math.max(b[2], k.box[2]), Math.max(b[3], k.box[3])]
  })

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
            if (img.rgba[o + 3]! < SEMI_ALPHA) partial++
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

  // ── 기준 ──
  const allBlocks = facts.map((f) => f.block).filter((b): b is number => b !== null)
  const blockSheet = median(allBlocks)
  // 행 기준(내용에서 추정한 격자선): 지면선은 같은 행 칸들의 최하단(+lift) 중앙값, 가로 중심은 같은 열 칸들의 중앙값.
  // 생성 그림의 행·열 간격이 고르지 않아 시트 전체 중앙값과 비교하면 행마다 통째로 어긋난다
  const refBottom = (row: number): number | null => median(cellsSpec.flatMap((c, i) =>
    (c.row === row && c.bottom !== null && facts[i]!.bbox !== null && facts[i]!.pixels >= minContent ? [facts[i]!.bbox![3] - 1 - rects[i]!.y + c.lift * S] : [])))
  const refCenter = (col: number): number | null => median(cellsSpec.flatMap((c, i) =>
    (c.col === col && c.center && facts[i]!.bbox !== null && facts[i]!.pixels >= minContent ? [facts[i]!.medX - rects[i]!.x] : [])))

  // ── 판정 ──
  const warnings: GateWarning[] = []
  const warn = (code: GateWarning['code'], cell: [number, number] | null, message: string): void => { warnings.push({ code, cell, message }) }
  const cellsOut: GateCell[] = []
  const skipCells = !opts.noCanvas && !canvasOk
  const line = sheet.bottom !== null && sheet.ground_y !== null && sheet.bottom + 1 !== sheet.ground_y ? 'hover line' : 'ground line'
  cellsSpec.forEach((c: CellSpec, i) => {
    const f = facts[i]!
    const rect = rects[i]!
    const codes: GateFailure['code'][] = []
    const warns: GateWarning['code'][] = []
    const at: [number, number] = [c.col, c.row]
    const name = cellName(c)
    const bad = (code: GateFailure['code'], msg: string): void => { codes.push(code); fail(code, at, `${name}: ${msg}`) }
    const out: GateCell = {
      col: c.col, row: c.row, action: c.action, label: c.label, used: c.used, pass: true, pixels: f.pixels,
      bbox: f.bbox, ground_delta: null, ground_template: null, center_delta: null, height: null, height_expected: c.height, block: f.block,
      partial_alpha: f.interior === 0 ? 0 : f.partial / f.interior,
      fill: sheet.fill === null ? null : f.fill, ground_fill: f.groundFill, codes, warns,
    }
    cellsOut.push(out)
    if (skipCells) return
    if (!c.used) {
      if (f.pixels >= minContent) bad('unexpected', `this cell must stay empty (flat ${specs.file.colors.key} background), but it contains ${f.pixels} px of drawing. Leave it completely empty.`)
      return
    }
    if (f.pixels < minContent || f.bbox === null) {
      bad('missing', `the cell is empty or nearly empty (${f.pixels} px). Draw the "${c.label}" frame here.`)
      return
    }
    const [bx0, by0, bx1, by1] = f.bbox
    // 칸 경계(경고): 정규화는 덩어리를 무게중심으로 칸에 배정하고 칸마다 다시 놓는다
    const m = sheet.margin * S
    const over: string[] = []
    const left = rect.x + m - bx0
    const right = bx1 - (rect.x + rect.w - m)
    const top = rect.y + m - by0
    const bottom = by1 - (rect.y + rect.h - m)
    if (left > 0) over.push(`left ${blocks(left / S)}`)
    if (right > 0) over.push(`right ${blocks(right / S)}`)
    if (top > 0) over.push(`top ${blocks(top / S)}`)
    if (bottom > 0) over.push(`bottom ${blocks(bottom / S)}`)
    if (over.length > 0 && sheet.fill === null) {
      warns.push('bbox')
      warn('bbox', at, `${name}: crosses the ${opts.noCanvas ? 'equal-grid' : 'template'} cell boundary (${over.join(', ')}).`)
    }
    // 지면선: 같은 행 프레임끼리(실패), 틀 지면선과(경고)
    if (c.bottom !== null) {
      const d = Math.round((by1 - 1 - rect.y + c.lift * S - refBottom(c.row)!) / S)
      out.ground_delta = d
      if (Math.abs(d) > tol.ground_tol) {
        const want = c.lift > 0 ? ` (this frame must float exactly ${c.lift} blocks above the ${line})` : ''
        const ref = `the ${line} of the other frames in this row`
        bad('ground', d < 0
          ? `the lowest pixel is ${blocks(-d)} above ${ref}${want}; move the figure down ${blocks(-d)} so every frame of the row stands on the same ${line}.`
          : `the lowest pixel is ${blocks(d)} below ${ref}${want}; move the figure up ${blocks(d)} so every frame of the row stands on the same ${line}.`)
      }
      if (!opts.noCanvas) {
        const t = Math.floor((by1 - 1 - rect.y) / S) - c.bottom
        out.ground_template = t
        if (Math.abs(t) > tol.ground_tol) {
          warns.push('ground')
          warn('ground', at, `${name}: lowest pixel ${blocks(t)} ${t < 0 ? 'above' : 'below'} the template ${line}.`)
        }
      }
    }
    // 가로 중심(경고)
    if (c.center && sheet.center_x !== null) {
      const d = !opts.noCanvas
        ? (f.medX - rect.x + 0.5) / S - (sheet.center_x + 0.5)
        : (f.medX - rect.x - refCenter(c.col)!) / S
      out.center_delta = round1(d)
      if (Math.abs(d) > tol.center_tol) {
        warns.push('center')
        warn('center', at, `${name}: horizontal center ${blocks(d)} ${d > 0 ? 'right' : 'left'} of ${opts.noCanvas ? 'the column median' : 'the template center mark'}.`)
      }
    }
    out.height = round1((by1 - by0) / S)
    // 화소 블록(경고, 아래에서 한 줄로 모은다)
    if (f.block !== null && Math.abs(f.block / S - 1) > tol.block_tol) warns.push('block')
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
  })

  // ── 닿음·겹침·가장자리(스프라이트) ──
  if (!skipCells && sheet.fill === null) {
    const content = cellsSpec.flatMap((c, i) => (c.used && facts[i]!.bbox !== null && facts[i]!.pixels >= minContent ? [i] : []))
    const medPix = median(content.map((i) => facts[i]!.pixels))
    const medW = median(content.map((i) => facts[i]!.bbox![2] - facts[i]!.bbox![0]))
    const medH = median(content.map((i) => facts[i]!.bbox![3] - facts[i]!.bbox![1]))
    const anyMissing = cellsSpec.some((c, i) => c.used && facts[i]!.pixels < minContent)
    comps.forEach((k, j) => {
      const cell = assign[j]!
      if (k.px.length < minContent) return
      const [x0, y0, x1, y1] = k.box
      const spec = cell >= 0 ? cellsSpec[cell]! : null
      const at: [number, number] | null = spec === null ? null : [spec.col, spec.row]
      const where = spec === null ? '' : `${cellName(spec)}: `
      if (x0 === 0 || y0 === 0 || x1 === W || y1 === H) {
        if (cell >= 0) cellsOut[cell]!.codes.push('edge')
        fail('edge', at, `${where}the drawing touches the image border; keep every figure completely inside the image with ${specs.file.colors.key} background around it.`)
      }
      if (anyMissing && medPix !== null && medW !== null && medH !== null && k.px.length > 1.6 * medPix &&
        (x1 - x0 > 1.4 * medW || y1 - y0 > 1.4 * medH)) {
        if (cell >= 0) cellsOut[cell]!.codes.push('touch')
        fail('touch', at, `${where}this drawing is joined to a neighbouring frame (one connected shape ${blocks((x1 - x0) / S)} wide and ${blocks((y1 - y0) / S)} tall, ${round1(k.px.length / medPix)} times the pixels of a single frame). Frames must never touch or overlap; leave clear ${specs.file.colors.key} background between every pair of frames.`)
      }
    })
  }

  // ── 시트 안 축척 일관성(실패)과 규격 키(경고) ──
  // 키/기준키 비율을 행마다 중앙값과, 행 중앙값끼리는 시트 중앙값과 비교한다. 정규화는 시트 하나에 배율 하나만 건다
  const ratioAll = new Map<number, number>()
  cellsSpec.forEach((c, i) => {
    const h = cellsOut[i]!.height
    if (!skipCells && c.used && c.height !== null && h !== null) ratioAll.set(i, h / c.height)
  })
  const rowMedians = (ratios: Map<number, number>): Map<number, number> => {
    const out = new Map<number, number>()
    for (const r of sheet.rows) {
      const m = median([...ratios].filter(([i]) => cellsSpec[i]!.row === r.row).map(([, v]) => v))
      if (m !== null) out.set(r.row, m)
    }
    return out
  }
  // 규격 키와의 비(경고·배율)는 키가 있는 모든 프레임, 일관성(실패)은 scale 검사 프레임만
  const heightRatio = median([...rowMedians(ratioAll).values()])
  const ratioOf = new Map([...ratioAll].filter(([i]) => cellsSpec[i]!.scale))
  const rowMed = rowMedians(ratioOf)
  const scaleRef = median([...rowMed.values()])
  const scaleTol = tol.scale_tol ?? 0.06
  const pct = (v: number): string => `${Math.round(Math.abs(v - 1) * 100)}%`
  for (const [i, v] of ratioOf) {
    const c = cellsSpec[i]!
    const m = rowMed.get(c.row)!
    if (Math.abs(v / m - 1) > scaleTol) {
      cellsOut[i]!.codes.push('scale')
      fail('scale', [c.col, c.row], `${cellName(c)}: the figure is ${pct(v / m)} ${v > m ? 'taller' : 'shorter'} than the other frames of this row (${round1(v * c.height!)} vs ${round1(m * c.height!)} blocks). Draw every frame of the row at the same character scale (±${Math.round(scaleTol * 100)}%).`)
    }
  }
  if (scaleRef !== null) {
    for (const [row, m] of rowMed) {
      if (Math.abs(m / scaleRef - 1) <= scaleTol) continue
      fail('scale', null, `Row ${row} "${sheet.rows[row]!.action}": the figures are ${pct(m / scaleRef)} ${m > scaleRef ? 'larger' : 'smaller'} than in the other rows. Draw the same character at one scale on the whole sheet (±${Math.round(scaleTol * 100)}%).`)
    }
  }
  if (heightRatio !== null && Math.abs(heightRatio - 1) > tol.height_tol) {
    warn('height', null, `Figures are ${round1(heightRatio * 100)}% of the spec height; normalization resamples the sheet by x${Math.round(100 / heightRatio) / 100} (map scale_to_spec).`)
  }
  const blockCells = cellsOut.filter((c) => c.warns.includes('block'))
  if (blockCells.length > 0) {
    const bs = blockCells.map((c) => c.block!)
    warn('block', null, `Drawn pixel blocks are ${round1(Math.min(...bs))}-${round1(Math.max(...bs))} image px in ${blockCells.length} cells, not ${round1(S)} (one logical pixel); normalization resamples.`)
  }
  for (const c of cellsOut) c.pass = c.codes.length === 0

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
  if (keyBg > 0 && keyOff / keyBg > 0.01) {
    const hex = keySum.map((v) => Math.round(v / keyBg).toString(16).padStart(2, '0')).join('').toUpperCase()
    warn('key_color', null, `Background is not exactly ${specs.file.colors.key}: ${round1((keyOff / keyBg) * 100)}% of background pixels differ (mean #${hex}), all within the key tolerance; keying removes them.`)
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
    grid: gridMode,
    block_sheet: blockSheet === null ? null : round1(blockSheet),
    height_ratio: heightRatio === null ? null : Math.round(heightRatio * 1000) / 1000,
    scale_factor: heightRatio === null ? null : Math.round(1000 / heightRatio) / 1000,
    background_ratio: Math.round(backgroundRatio * 10000) / 10000,
    guide_pixels: guidePixels,
    stray_pixels: stray,
    specks,
    tolerances: tol,
    cells: cellsOut,
    failures,
    warnings,
    feedback: feedbackText(failures, pass, specName, layout.S, opts.noCanvas),
  }
}

interface Comp {
  /** 화소 번호 */
  px: Int32Array
  /** 무게중심(화소 중앙 기준) */
  cx: number
  cy: number
  /** [x0, y0, x1, y1)(끝 제외) */
  box: [number, number, number, number]
}

/**
 * 내용에서 격자를 추정해 덩어리마다 칸 번호를 준다(-2 = 어느 그림에도 안 붙는 조각, -3 = 작은 티).
 * 큰 덩어리(쓰는 칸 수 N번째로 큰 것의 25% 이상) = 그림. 그림 수가 N이어야 하고, 무게중심 y 간격이 그림 키 중앙값의
 * 절반을 넘는 곳에서 행을 나눠 행 수·행별 프레임 수가 규격과 같아야 한다. 행 안은 x 순서가 프레임 번호이고,
 * 그 위치가 추정한 열 간격(행 안 이웃 간격의 중앙값)으로 왼쪽부터 빈틈없이 놓여야 한다. 작은 조각은 가장 가까운 그림에 붙인다.
 * 맞지 않으면 null.
 */
export function inferCells(comps: Comp[], rowFrames: number[], cols: number, minSpeck: number): number[] | null {
  const nUsed = rowFrames.reduce((a, b) => a + b, 0)
  const big = comps.flatMap((k, j) => (k.px.length >= minSpeck ? [j] : []))
  if (big.length < nUsed || nUsed === 0) return null
  const areas = big.map((j) => comps[j]!.px.length).sort((a, b) => b - a)
  const aRef = areas[nUsed - 1]!
  const majors = big.filter((j) => comps[j]!.px.length >= 0.25 * aRef)
  if (majors.length !== nUsed) return null
  const mh = median(majors.map((j) => comps[j]!.box[3] - comps[j]!.box[1]))!
  const byY = [...majors].sort((a, b) => comps[a]!.cy - comps[b]!.cy)
  const rows: number[][] = [[byY[0]!]]
  for (let i = 1; i < byY.length; i++) {
    if (comps[byY[i]!]!.cy - comps[byY[i - 1]!]!.cy > 0.5 * mh) rows.push([])
    rows[rows.length - 1]!.push(byY[i]!)
  }
  if (rows.length !== rowFrames.length) return null
  const diffs: number[] = []
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!.sort((a, b) => comps[a]!.cx - comps[b]!.cx)
    if (row.length !== rowFrames[r] || row.length > cols) return null
    for (let i = 1; i < row.length; i++) diffs.push(comps[row[i]!]!.cx - comps[row[i - 1]!]!.cx)
  }
  const pitch = median(diffs)
  const x0 = Math.min(...rows.map((r) => comps[r[0]!]!.cx))
  const out: number[] = comps.map((k) => (k.px.length < minSpeck ? -3 : -2))
  for (let r = 0; r < rows.length; r++) {
    for (let i = 0; i < rows[r]!.length; i++) {
      const j = rows[r]![i]!
      if (pitch !== null && Math.round((comps[j]!.cx - x0) / pitch) !== i) return null
      out[j] = r * cols + i
    }
  }
  const majorSet = new Set(majors)
  for (const j of big) {
    if (majorSet.has(j)) continue
    const a = comps[j]!.box
    let best = -1
    let bestD = Infinity
    for (const m of majors) {
      const b = comps[m]!.box
      const d = Math.hypot(Math.max(0, a[0] - b[2], b[0] - a[2]), Math.max(0, a[1] - b[3], b[1] - a[3]))
      if (d < bestD) { bestD = d; best = m }
    }
    if (best >= 0 && bestD <= 0.5 * mh) out[j] = out[best]!
  }
  return out
}

const MAX_FEEDBACK = 30

/** 다시 생성할 때 프롬프트에 붙일 영어 문단 */
export function feedbackText(failures: GateFailure[], pass: boolean, spec: string, S: number, noCanvas: boolean): string {
  if (pass) return `The delivery matches the ${spec} template. No regeneration needed.`
  const head = noCanvas
    ? `Regenerate this sheet with the same layout (cells are numbered (column,row) from 0 at the top-left; sizes are in blocks = one game pixel). Fix exactly these problems and change nothing else:`
    : `Regenerate this sheet on the ${spec} template (one art pixel = ${S}x${S} image pixels; cells are numbered (column,row) from 0 at the top-left). Fix exactly these problems and change nothing else:`
  const lines = failures.slice(0, MAX_FEEDBACK).map((f) => `- ${f.message}`)
  if (failures.length > MAX_FEEDBACK) lines.push(`- ...and ${failures.length - MAX_FEEDBACK} more problems of the same kinds.`)
  const tail = noCanvas ? ['(Measured without the template canvas: frames are compared with the other frames of the same row, not against the template marks.)'] : []
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
