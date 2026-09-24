// 배치 틀(생성기 입력 템플릿) 규격 읽기와 배치 계산.
// 수치(칸 크기·지면선·중심·키·허용치)는 docs/art/templates/specs.json이 가진다. 여기에는 규칙만 있다.
//   S(논리 화소 1개 = 이미지 S×S 화소) = cols·cellW·S ≤ canvasW − 2·mx 이고 rows·cellH·S ≤ canvasH − 2·my 인 가장 큰 정수
//   격자는 캔버스 가운데. 칸 (c, r) 원점 = (x0 + c·cellW·S, y0 + r·cellH·S)
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export type Align = 'ground' | 'none'
export type Fill = 'opaque' | 'partial'

export interface PlaceholderSpec {
  /** 정규화된 게임 규격 PNG(저장소 뿌리 기준) */
  source: string
  /** 원본 시트의 논리 칸 [폭, 높이] */
  cell: [number, number]
  /** 모든 프레임에 쓰는 원본 칸 [열, 행] */
  frame?: [number, number]
  /** 프레임 번호별 원본 칸. 모자라면 마지막 것 */
  frames?: [number, number][]
  /** align none일 때 원본 칸 원점을 놓을 틀 칸 좌표. 기본 가운데 */
  offset?: [number, number]
}

export interface RowRule {
  frames?: number
  labels?: string[]
  /** 프레임별로 지면선에서 떠야 하는 논리 화소(환호 점프 등) */
  lift?: number[]
  /** 기준 키(논리 화소). null = 검사 안 함. 배열이면 프레임별 */
  height?: number | null | (number | null)[]
  /** 가로 중심 검사. 배열이면 프레임별 */
  center?: boolean | boolean[]
  /** 지면선 검사(align ground일 때). false = 나는 동작 등 */
  ground?: boolean
  placeholder?: Partial<PlaceholderSpec>
  note?: string
}

export interface GateTolerances {
  /** 최하단 행 허용 오차(논리 화소) */
  ground_tol: number
  /** 가로 중심 허용 오차(논리 화소) */
  center_tol: number
  /** 키 허용 비율 */
  height_tol: number
  /** 화소 블록 크기 허용 비율 */
  block_tol: number
  /** 그림 bbox 밖 영역 가운데 배경이어야 하는 최소 비율 */
  min_background: number
  /** 그림 속(4방향 이웃이 모두 그림) 화소 가운데 알파 < 255 허용 비율 */
  max_partial_alpha: number
  /** 띠(fill opaque)의 칸 채움 최소 비율, ground_band의 지면 아래 채움 최소 비율 */
  min_fill: number
  /** 안내 색 화소 허용 수(이보다 많으면 실패). 기본 0 */
  max_guide_pixels: number
}

export interface Family extends RowRule {
  cell: [number, number]
  cols: number
  align: Align
  ground_y?: number | null
  /** 가장 아래 불투명 행(ground_y − 1이 기본, 나는 적은 다르다) */
  bottom?: number | null
  center_x?: number | null
  /** bbox가 칸 가장자리에서 비워야 할 논리 화소 */
  margin?: number
  /** 캔버스 가장자리 최소 여백 [가로, 세로](이미지 화소). 기본 canvas.margin */
  canvas_margin?: [number, number]
  orientation?: 'auto' | 'landscape' | 'portrait'
  /** 띠: opaque = 칸 전체를 채운다, partial = 비어도 된다 */
  fill?: Fill | null
  /** 띠: ground_y 아래 행이 채워져야 한다 */
  ground_band?: boolean
  placeholder?: PlaceholderSpec
  gate?: Partial<GateTolerances>
  actions?: Record<string, RowRule>
}

export type SheetRow = string | (RowRule & { action: string })

export interface SheetSpec extends Partial<Omit<Family, 'actions' | 'placeholder'>> {
  name: string
  family: string
  rows: SheetRow[]
  note?: string
  /** null = 이 시트는 자리표시 판을 만들지 않는다 */
  placeholder?: PlaceholderSpec | null
}

export interface SpecFile {
  version: number
  /** 저장소 뿌리(이 파일 기준) */
  root: string
  out_dir: string
  canvas: { landscape: [number, number]; portrait: [number, number]; margin: [number, number] }
  colors: { key: string; guide: string; silhouette: string }
  key: { tolerance: number; alpha_threshold: number; despill: number | null }
  gate: GateTolerances
  families: Record<string, Family>
  sheets: SheetSpec[]
}

export interface LoadedSpecs {
  path: string
  root: string
  file: SpecFile
}

export class SpecError extends Error {
  override name = 'SpecError'
}

export function loadSpecs(path: string): LoadedSpecs {
  const abs = resolve(path)
  let file: SpecFile
  try {
    file = JSON.parse(readFileSync(abs, 'utf8')) as SpecFile
  } catch (e) {
    throw new SpecError(`틀 규격을 읽지 못했다: ${abs} — ${(e as Error).message}`)
  }
  const specs: LoadedSpecs = { path: abs, root: resolve(dirname(abs), file.root), file }
  const names = new Set<string>()
  for (const s of file.sheets) {
    if (names.has(s.name)) throw new SpecError(`시트 이름이 겹친다: ${s.name}`)
    names.add(s.name)
    resolveSheet(specs, s.name) // 앞뒤 검증
  }
  return specs
}

export interface ResolvedRow {
  row: number
  action: string
  frames: number
  labels: string[]
  lift: number[]
  height: (number | null)[]
  center: boolean[]
  ground: boolean
  placeholder: PlaceholderSpec | null
  note?: string
}

export interface ResolvedSheet {
  name: string
  family: string
  note?: string
  cell: [number, number]
  cols: number
  rows: ResolvedRow[]
  align: Align
  ground_y: number | null
  bottom: number | null
  center_x: number | null
  margin: number
  canvasMargin: [number, number]
  orientation: 'auto' | 'landscape' | 'portrait'
  fill: Fill | null
  groundBand: boolean
  placeholder: PlaceholderSpec | null
  gate: GateTolerances
}

const pick = <T>(v: T | T[] | undefined, i: number, fallback: T): T => {
  if (v === undefined) return fallback
  if (Array.isArray(v)) return v.length === 0 ? fallback : (v[Math.min(i, v.length - 1)] as T)
  return v
}

/** 행 문자열 "walk" 또는 "walk:6"을 행 객체로 */
export function parseRowToken(token: string): SheetRow {
  const [action, frames] = token.split(':')
  if (action === undefined || action === '') throw new SpecError(`행 표기가 비었다: ${token}`)
  if (frames === undefined) return action
  const n = Number(frames)
  if (!Number.isInteger(n) || n < 1) throw new SpecError(`행 프레임 수가 틀렸다: ${token}`)
  return { action, frames: n }
}

/** 시트 규격을 계열 값과 합쳐 푼다. rowsOverride가 있으면 행 구성을 바꾼다(--rows) */
export function resolveSheet(specs: LoadedSpecs, name: string, rowsOverride?: SheetRow[]): ResolvedSheet {
  const sheet = specs.file.sheets.find((s) => s.name === name)
  if (sheet === undefined) {
    throw new SpecError(`틀 규격에 없는 시트다: ${name} (있는 것: ${specs.file.sheets.map((s) => s.name).join(', ')})`)
  }
  const fam = specs.file.families[sheet.family]
  if (fam === undefined) throw new SpecError(`${name}: 없는 계열 ${sheet.family}`)
  const f = { ...fam, ...sheet } as Family & SheetSpec
  const align = f.align
  const groundY = f.ground_y ?? null
  const bottom = f.bottom ?? (groundY === null ? null : groundY - 1)
  const sheetPlaceholder = sheet.placeholder === null ? null : (sheet.placeholder ?? fam.placeholder ?? null)
  const rows: ResolvedRow[] = (rowsOverride ?? sheet.rows).map((raw, r) => {
    const obj = typeof raw === 'string' ? { action: raw } : raw
    const lib = fam.actions?.[obj.action] ?? {}
    const rule: RowRule & { action: string } = { ...lib, ...obj }
    const frames = rule.frames
    if (frames === undefined || !Number.isInteger(frames) || frames < 1) {
      throw new SpecError(`${name}: 행 ${r} ${obj.action}의 프레임 수가 없다(계열 ${sheet.family}의 동작 목록에도 없다)`)
    }
    if (frames > f.cols) throw new SpecError(`${name}: 행 ${r} ${obj.action} 프레임 ${frames}이 열 수 ${f.cols}보다 많다`)
    if (rule.labels !== undefined && rule.labels.length !== frames) {
      throw new SpecError(`${name}: 행 ${r} ${obj.action}의 labels ${rule.labels.length}개가 프레임 ${frames}과 다르다`)
    }
    const idx = Array.from({ length: frames }, (_, i) => i)
    const heightRule: number | null | (number | null)[] = rule.height !== undefined ? rule.height : (f.height ?? null)
    let placeholder: PlaceholderSpec | null = null
    if (sheetPlaceholder !== null) {
      const ov = rule.placeholder ?? {}
      placeholder = { ...sheetPlaceholder, ...ov }
      if (ov.frame !== undefined && ov.frames === undefined) delete placeholder.frames
      if (ov.frames !== undefined && ov.frame === undefined) delete placeholder.frame
    }
    return {
      row: r,
      action: obj.action,
      frames,
      labels: rule.labels ?? idx.map((i) => `${obj.action} ${i + 1}`),
      lift: idx.map((i) => pick(rule.lift, i, 0)),
      height: idx.map((i) => pick<number | null>(heightRule, i, null)),
      center: idx.map((i) => pick(rule.center, i, true)),
      ground: rule.ground ?? true,
      placeholder,
      ...(rule.note === undefined ? {} : { note: rule.note }),
    }
  })
  if (align === 'ground' && (bottom === null || f.center_x === undefined || f.center_x === null)) {
    throw new SpecError(`${name}: align ground에는 ground_y(또는 bottom)와 center_x가 필요하다`)
  }
  return {
    name,
    family: sheet.family,
    ...(sheet.note === undefined ? {} : { note: sheet.note }),
    cell: f.cell,
    cols: f.cols,
    rows,
    align,
    ground_y: groundY,
    bottom,
    center_x: f.center_x ?? null,
    margin: f.margin ?? 0,
    canvasMargin: f.canvas_margin ?? specs.file.canvas.margin,
    orientation: f.orientation ?? 'auto',
    fill: f.fill ?? null,
    groundBand: f.ground_band ?? false,
    placeholder: sheetPlaceholder,
    gate: { ...specs.file.gate, ...(fam.gate ?? {}), ...(sheet.gate ?? {}) },
  }
}

export interface Layout {
  canvas: [number, number]
  orientation: 'landscape' | 'portrait'
  S: number
  x0: number
  y0: number
  gridW: number
  gridH: number
}

/** 가장 큰 정수 S. 세로 캔버스는 S가 더 클 때만 쓴다(auto) */
export function computeLayout(specs: LoadedSpecs, sheet: ResolvedSheet): Layout {
  const [cw, ch] = sheet.cell
  const cols = sheet.cols
  const rows = sheet.rows.length
  const [mx, my] = sheet.canvasMargin
  const fit = (W: number, H: number): number =>
    Math.min(Math.floor((W - 2 * mx) / (cols * cw)), Math.floor((H - 2 * my) / (rows * ch)))
  const land = specs.file.canvas.landscape
  const port = specs.file.canvas.portrait
  const sL = fit(land[0], land[1])
  const sP = fit(port[0], port[1])
  let orientation: 'landscape' | 'portrait' = 'landscape'
  if (sheet.orientation === 'portrait' || (sheet.orientation === 'auto' && sP > sL)) orientation = 'portrait'
  const canvas = orientation === 'landscape' ? land : port
  const S = orientation === 'landscape' ? sL : sP
  if (S < 1) throw new SpecError(`${sheet.name}: 격자 ${cols}×${rows} × 칸 ${cw}×${ch}가 캔버스에 들어가지 않는다`)
  const gridW = cols * cw * S
  const gridH = rows * ch * S
  return {
    canvas: [canvas[0], canvas[1]],
    orientation,
    S,
    x0: Math.floor((canvas[0] - gridW) / 2),
    y0: Math.floor((canvas[1] - gridH) / 2),
    gridW,
    gridH,
  }
}

export interface CellSpec {
  col: number
  row: number
  action: string
  /** 행 안 프레임 번호(0부터). 빈 칸은 null */
  frame: number | null
  label: string | null
  used: boolean
  /** 틀 이미지 화소 사각형 */
  x: number
  y: number
  w: number
  h: number
  /** 기대 최하단 논리 행(지면선 검사 안 하면 null) */
  bottom: number | null
  center: boolean
  height: number | null
  lift: number
}

export function cellSpecs(sheet: ResolvedSheet, layout: Layout): CellSpec[] {
  const [cw, ch] = sheet.cell
  const out: CellSpec[] = []
  for (const row of sheet.rows) {
    for (let c = 0; c < sheet.cols; c++) {
      const used = c < row.frames
      const groundCheck = used && sheet.align === 'ground' && row.ground && sheet.bottom !== null
      out.push({
        col: c,
        row: row.row,
        action: row.action,
        frame: used ? c : null,
        label: used ? row.labels[c]! : null,
        used,
        x: layout.x0 + c * cw * layout.S,
        y: layout.y0 + row.row * ch * layout.S,
        w: cw * layout.S,
        h: ch * layout.S,
        bottom: groundCheck ? sheet.bottom! - row.lift[c]! : null,
        center: used && sheet.align === 'ground' && sheet.center_x !== null && row.center[c]!,
        height: used ? row.height[c]! : null,
        lift: used ? row.lift[c]! : 0,
      })
    }
  }
  return out
}
