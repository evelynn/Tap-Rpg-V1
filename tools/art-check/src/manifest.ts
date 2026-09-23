// 매니페스트 읽기와 검증. 검사기는 규격을 코드에 담지 않고 전부 이 파일에서 읽는다.
import { readFileSync } from 'node:fs'

export type CompanionKind = 'anchors' | 'frames' | '9slice'

export interface RowSpec {
  /** 동작 키(01 §18.4 영문 키) */
  action: string
  /** 그 행에서 채워야 하는 칸 수 */
  frames: number
}

export interface AssetSpec {
  id: string
  card: string
  priority: string
  dir: string
  files: string[]
  size: [number, number]
  cell: [number, number]
  /** [열, 행] */
  grid: [number, number]
  rows?: RowSpec[]
  frames: number
  /** 불투명 화소의 고유 RGB 상한(투명 제외). null = 명세 미정이라 검사하지 않는다 */
  max_colors: number | null
  max_colors_per_cell?: number | null
  palette: string
  /** 허용 알파값. 기본 [0, 255] */
  alpha?: number[]
  /** 칸 가장자리에서 비워야 할 픽셀 수. 기본 1 */
  margin?: number
  companions: CompanionKind[]
  note?: string
}

export interface UnspecifiedEntry {
  files: string
  card: string
  missing: string
}

export interface Manifest {
  version: number
  source: string
  notes: string[]
  /** 묶음 이름 → HEX 목록 */
  palettes: Record<string, string[]>
  /** 팔레트 키 → 묶음 이름 목록 */
  palette_sets: Record<string, string[]>
  defaults: {
    alpha: number[]
    margin: number
    root: string
  }
  assets: AssetSpec[]
  unspecified: UnspecifiedEntry[]
}

export interface ResolvedFile {
  id: string
  card: string
  priority: string
  /** 매니페스트 root 기준 상대 경로 */
  path: string
  spec: AssetSpec
  /** 허용 색 집합. 0xRRGGBB 정수. null = 검사하지 않는다 */
  palette: Set<number>
  alpha: number[]
  margin: number
  maxColors: number | null
  maxColorsPerCell: number | null
}

export class ManifestError extends Error {
  override name = 'ManifestError'
}

const HEX = /^#[0-9A-F]{6}$/

export function parseHex(hex: string): number {
  if (!HEX.test(hex)) throw new ManifestError(`색 표기가 잘못됐다: ${hex}`)
  return Number.parseInt(hex.slice(1), 16)
}

export function formatHex(rgb: number): string {
  return '#' + rgb.toString(16).toUpperCase().padStart(6, '0')
}

function fail(where: string, message: string): never {
  throw new ManifestError(`${where}: ${message}`)
}

/** 매니페스트 자체의 앞뒤가 맞는지 본다. 값이 틀리면 검사 결과 전체가 거짓이 된다. */
export function validateManifest(m: Manifest): void {
  if (m.version !== 1) fail('manifest', `version이 ${m.version}이다(1이어야 한다)`)
  for (const [group, colors] of Object.entries(m.palettes)) {
    const seen = new Set<string>()
    for (const c of colors) {
      if (!HEX.test(c)) fail(`palettes.${group}`, `색 표기가 잘못됐다: ${c}`)
      if (seen.has(c)) fail(`palettes.${group}`, `같은 색이 두 번 있다: ${c}`)
      seen.add(c)
    }
  }
  for (const [key, groups] of Object.entries(m.palette_sets)) {
    for (const g of groups) {
      if (m.palettes[g] === undefined) fail(`palette_sets.${key}`, `없는 묶음을 가리킨다: ${g}`)
    }
  }
  const ids = new Set<string>()
  const paths = new Set<string>()
  for (const a of m.assets) {
    const where = `assets.${a.id}`
    if (ids.has(a.id)) fail(where, 'id가 중복이다')
    ids.add(a.id)
    if (a.files.length === 0) fail(where, 'files가 비었다')
    if (m.palette_sets[a.palette] === undefined) fail(where, `없는 팔레트 키다: ${a.palette}`)
    const [cw, ch] = a.cell
    const [cols, rows] = a.grid
    if (cw <= 0 || ch <= 0 || cols <= 0 || rows <= 0) fail(where, 'cell·grid는 1 이상이어야 한다')
    if (a.size[0] !== cw * cols || a.size[1] !== ch * rows) {
      fail(where, `size ${a.size[0]}×${a.size[1]}가 cell×grid ${cw * cols}×${ch * rows}와 다르다`)
    }
    if (a.rows !== undefined) {
      if (a.rows.length !== rows) fail(where, `rows 길이 ${a.rows.length}가 격자 행 수 ${rows}와 다르다`)
      let sum = 0
      for (const r of a.rows) {
        if (r.frames < 0 || r.frames > cols) fail(where, `행 ${r.action}의 프레임 수 ${r.frames}가 열 수 ${cols}를 넘는다`)
        sum += r.frames
      }
      if (sum !== a.frames) fail(where, `rows 프레임 합 ${sum}이 frames ${a.frames}와 다르다`)
    } else if (a.frames !== cols * rows) {
      fail(where, `rows가 없으면 frames ${a.frames}가 칸 수 ${cols * rows}와 같아야 한다`)
    }
    for (const f of a.files) {
      if (!f.endsWith('.png')) fail(where, `PNG가 아닌 파일이 있다: ${f}`)
      const p = `${a.dir}/${f}`
      if (paths.has(p)) fail(where, `다른 항목과 경로가 겹친다: ${p}`)
      paths.add(p)
    }
  }
}

export function loadManifest(path: string): Manifest {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    throw new ManifestError(`매니페스트를 읽지 못했다: ${path}`)
  }
  let data: Manifest
  try {
    data = JSON.parse(text) as Manifest
  } catch (e) {
    throw new ManifestError(`매니페스트가 올바른 JSON이 아니다: ${(e as Error).message}`)
  }
  validateManifest(data)
  return data
}

function resolvePalette(m: Manifest, key: string): Set<number> {
  const out = new Set<number>()
  for (const g of m.palette_sets[key] ?? []) {
    for (const c of m.palettes[g] ?? []) out.add(parseHex(c))
  }
  return out
}

/** 항목 하나를 파일 하나짜리 검사 단위로 펼친다. */
export function resolveFiles(m: Manifest): ResolvedFile[] {
  const cache = new Map<string, Set<number>>()
  const out: ResolvedFile[] = []
  for (const a of m.assets) {
    let palette = cache.get(a.palette)
    if (palette === undefined) {
      palette = resolvePalette(m, a.palette)
      cache.set(a.palette, palette)
    }
    for (const f of a.files) {
      out.push({
        id: a.id,
        card: a.card,
        priority: a.priority,
        path: `${a.dir}/${f}`,
        spec: a,
        palette,
        alpha: a.alpha ?? m.defaults.alpha,
        margin: a.margin ?? m.defaults.margin,
        maxColors: a.max_colors,
        maxColorsPerCell: a.max_colors_per_cell === undefined ? a.max_colors : a.max_colors_per_cell,
      })
    }
  }
  return out
}
