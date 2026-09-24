// 생성 원본 → 게임 규격 파일 대응표(docs/art/imagegen.map.json) 읽기와 앞뒤 검증.
// 대응표는 원본마다 격자·논리 칸 크기·행별 프레임 수·정렬 규칙을 적는다. 규격 수치의 출처는 ASSET_ORDERS 0.4~0.6절이다.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { Manifest } from './manifest'

export interface RowSpec {
  action: string
  /** 이 행에서 내용이 있는 칸 수(왼쪽부터). 나머지 칸은 빈 칸이다 */
  frames: number
}

export type AlignSpec =
  /** 가장 아래 불투명 행을 bottom에, 몸의 가로 중심(불투명 화소 x의 중앙값)을 center_x에 둔다 */
  | { mode: 'ground'; bottom: number; center_x: number }
  /** 내용 bbox를 칸 가운데에 둔다(기준점이 따로 붙는 무기·소품) */
  | { mode: 'center' }

/**
 * 스냅할 팔레트. 문자열 = 매니페스트 palette_sets 키, 배열 = 매니페스트 palettes 묶음 이름 목록.
 * 묶음 목록은 기본 48색 안에서 효과 색(fx)처럼 그 시트에 쓰지 않을 묶음을 빼려고 쓴다.
 */
export type PaletteRef = string | string[]

export interface ReferenceEntry {
  name: string
  source: string
  role: 'reference'
  grid: [number, number]
  cell: [number, number]
  rows: RowSpec[]
  palette: PaletteRef
  align: AlignSpec
  /** 원본 화소 몇 개가 논리 화소 1개인가. 적지 않으면 max(원본 칸 폭 / 논리 칸 폭, 원본 칸 높이 / 논리 칸 높이) */
  scale?: number
}

export interface LayerEntry {
  name: string
  source: string
  role: 'layer'
  /** 기준 시트 항목 이름. 격자·칸·행·축척·칸별 이동을 그대로 물려받는다 */
  ref: string
  palette: PaletteRef
  /** 옷 레이어면 참. `layers` 검사가 기준 시트의 피부 위에 옷 화소가 얹혔는지 센다 */
  clothing?: boolean
}

export type MapEntry = ReferenceEntry | LayerEntry

export interface PreviewSpec {
  /** 창 모형에 세울 캐릭터 기준 시트 */
  character: string
  /** 정합 확인에 겹칠 레이어(뒤 → 앞 순서, 15 §3.1) */
  layers: string[]
  /** 창 모형 오른쪽에 세울 적 */
  enemy: string
  /** 창 모형 글자 판 자리에 실크기로 늘어놓을 시트(크기 비교용) */
  props: string[]
  /** 32·48 나란히 비교할 쌍 [48, 32] */
  compare: [string, string][]
  /** 들판 배경 층(먼 → 가까운). 정규화된 파일이 모두 있을 때만 쓰고, 없으면 단색 하늘·풀밭 */
  field: string[]
}

export interface ImagegenMap {
  version: number
  /** 대응표 파일 기준 저장소 뿌리 */
  root: string
  source_dir: string
  out_dir: string
  /** 배경 열쇠 색 */
  key: string
  /** 열쇠 색과의 RGB 거리가 이 값 이하면 배경 */
  key_tolerance: number
  /** 알파가 이 값 미만이면 배경 */
  alpha_threshold: number
  /** 자홍 번짐 제거: min(R, B) − G가 이 값 이상이면 배경(열쇠 색과 섞인 테두리 화소). null이면 끈다 */
  key_despill: number | null
  entries: MapEntry[]
  preview: PreviewSpec
}

export interface LoadedMap {
  map: ImagegenMap
  /** 절대 경로 */
  root: string
  sourceDir: string
  outDir: string
}

export class MapError extends Error {
  override name = 'MapError'
}

function fail(where: string, message: string): never {
  throw new MapError(`${where}: ${message}`)
}

const HEX = /^#[0-9A-F]{6}$/

function isPair(v: unknown): v is [number, number] {
  return Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n) && (n as number) > 0)
}

/** 대응표 자체의 앞뒤를 본다. 팔레트 이름은 매니페스트와 대조한다 */
export function validateMap(m: ImagegenMap, manifest: Pick<Manifest, 'palettes' | 'palette_sets'>): void {
  if (m.version !== 1) fail('map', `version이 ${m.version}이다(1이어야 한다)`)
  if (!HEX.test(m.key)) fail('map.key', `색 표기가 잘못됐다: ${m.key}`)
  if (m.key_despill !== null && !(m.key_despill > 0)) fail('map.key_despill', '양수 또는 null이어야 한다')
  const names = new Map<string, MapEntry>()
  for (const e of m.entries) {
    const where = `entries.${e.name}`
    if (names.has(e.name)) fail(where, '이름이 중복이다')
    names.set(e.name, e)
    if (typeof e.palette === 'string') {
      if (manifest.palette_sets[e.palette] === undefined) fail(where, `매니페스트에 없는 팔레트 키다: ${e.palette}`)
    } else {
      if (e.palette.length === 0) fail(where, '팔레트 묶음 목록이 비었다')
      for (const g of e.palette) if (manifest.palettes[g] === undefined) fail(where, `매니페스트에 없는 팔레트 묶음이다: ${g}`)
    }
    if (e.role === 'reference') {
      if (!isPair(e.grid) || !isPair(e.cell)) fail(where, 'grid·cell은 1 이상 정수 두 개여야 한다')
      if (e.rows.length !== e.grid[1]) fail(where, `rows 길이 ${e.rows.length}가 격자 행 수 ${e.grid[1]}와 다르다`)
      for (const r of e.rows) {
        if (!Number.isInteger(r.frames) || r.frames < 0 || r.frames > e.grid[0]) fail(where, `행 ${r.action}의 칸 수 ${r.frames}가 0~${e.grid[0]} 밖이다`)
      }
      if (e.align.mode === 'ground') {
        const { bottom, center_x } = e.align
        if (!(bottom >= 0 && bottom < e.cell[1] && center_x >= 0 && center_x < e.cell[0])) fail(where, 'align 기준이 칸 밖이다')
      } else if (e.align.mode !== 'center') {
        fail(where, `모르는 정렬 방식이다: ${(e.align as { mode: string }).mode}`)
      }
      if (e.scale !== undefined && !(e.scale > 0)) fail(where, 'scale은 양수여야 한다')
    } else if (e.role !== 'layer') {
      fail(where, `role은 reference 또는 layer다: ${(e as { role: string }).role}`)
    }
  }
  for (const e of m.entries) {
    if (e.role !== 'layer') continue
    const ref = names.get(e.ref)
    if (ref === undefined) fail(`entries.${e.name}`, `없는 기준 시트를 가리킨다: ${e.ref}`)
    if (ref.role !== 'reference') fail(`entries.${e.name}`, `기준은 reference여야 한다: ${e.ref}`)
  }
  const p = m.preview
  for (const n of [p.character, p.enemy, ...p.layers, ...p.props, ...p.compare.flat(), ...p.field]) {
    if (!names.has(n)) fail('preview', `대응표에 없는 이름이다: ${n}`)
  }
}

export function loadMap(path: string, manifest: Pick<Manifest, 'palettes' | 'palette_sets'>): LoadedMap {
  let data: ImagegenMap
  try {
    data = JSON.parse(readFileSync(path, 'utf8')) as ImagegenMap
  } catch (e) {
    throw new MapError(`대응표를 읽지 못했다: ${path} — ${(e as Error).message}`)
  }
  validateMap(data, manifest)
  const root = resolve(dirname(path), data.root)
  return { map: data, root, sourceDir: resolve(root, data.source_dir), outDir: resolve(root, data.out_dir) }
}

/** 이름으로 항목을 찾는다. 레이어면 기준 항목도 함께 */
export function findEntry(m: ImagegenMap, name: string): MapEntry {
  const e = m.entries.find((x) => x.name === name)
  if (e === undefined) throw new MapError(`대응표에 없는 이름이다: ${name}`)
  return e
}

export function referenceOf(m: ImagegenMap, e: MapEntry): ReferenceEntry {
  if (e.role === 'reference') return e
  return findEntry(m, e.ref) as ReferenceEntry
}
