// 팩 폴더의 JSON 파일을 종류별 경로(CONTENT_KINDS)로 가려 정의와 패치 파일로 모은다(CONTENT_SCHEMA §1.3~1.5).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative, sep } from 'node:path'
import { CONTENT_KINDS, CONTENT_KIND_NAMES, type ContentKind } from '../core'
import { issue, type ContentIssue, type IssueAt } from '../validate/issues'

export interface RawDef {
  kind: ContentKind
  id: string
  value: Record<string, unknown>
  pack: string
  // 팩 폴더 기준 경로(/ 구분)
  file: string
  // 파일 안 위치(배열 파일이면 /2)
  pointer: string
  // 적용한 패치 연산 위치(적용 순서). 이슈 메시지에 덧붙인다
  patches?: IssueAt[]
}

export interface PatchFile {
  pack: string
  file: string
  value: unknown
}

export interface PackFiles {
  defs: RawDef[]
  patches: PatchFile[]
  issues: ContentIssue[]
}

// 파일 모양: object = 정의 1개, array = 배열 하나, either = 객체 1개 또는 객체 배열
export type FileShape = 'object' | 'array' | 'either'

const specOf = (kind: ContentKind): { dir?: string; file?: string; singleton?: boolean } => CONTENT_KINDS[kind]

export function fileShapeOf(kind: ContentKind): FileShape {
  if (kind === 'event' || kind === 'chain' || specOf(kind).singleton) return 'object'
  return kind === 'flag' ? 'array' : 'either'
}

const DIR_KIND = new Map<string, ContentKind>()
const FILE_KIND = new Map<string, ContentKind>()
for (const kind of CONTENT_KIND_NAMES) {
  const { dir, file } = specOf(kind)
  if (dir) DIR_KIND.set(dir, kind)
  if (file) FILE_KIND.set(file, kind)
}

export type JsonResult = { ok: true; value: unknown } | { ok: false; message: string }

// UTF-8 JSON. 앞의 BOM은 떼어낸다
export function readJson(path: string): JsonResult {
  try {
    return { ok: true, value: JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, '')) }
  } catch (e) {
    return { ok: false, message: `JSON 해석 실패: ${(e as Error).message}` }
  }
}

// 폴더 아래 .json 전부(팩 기준 경로, 경로 사전순)
function listJson(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return listJson(path, base)
    return name.endsWith('.json') ? [relative(base, path).split(sep).join('/')] : []
  })
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function readPackFiles(packDir: string, pack: string): PackFiles {
  const out: PackFiles = { defs: [], patches: [], issues: [] }
  for (const file of listJson(packDir).sort()) {
    if (file === 'pack.json') continue
    const parts = file.split('/')
    const at = { pack, file }
    const json = () => {
      const r = readJson(join(packDir, file))
      if (!r.ok) out.issues.push(issue('P08', at, r.message))
      return r
    }

    if (parts[0] === 'patches' && parts.length > 1) {
      const r = json()
      if (r.ok) out.patches.push({ pack, file, value: r.value })
      continue
    }
    const kind = parts.length === 1 ? FILE_KIND.get(file) : DIR_KIND.get(parts[0]!)
    // events/는 첫 단계가 분류 폴더다
    if (!kind || (kind === 'event' && parts.length < 3)) {
      out.issues.push(issue('P05', at, '알 수 없는 경로(CONTENT_SCHEMA §1.3 표에 없다)'))
      continue
    }
    const r = json()
    if (!r.ok) continue

    const shape = fileShapeOf(kind)
    const isArray = Array.isArray(r.value)
    if (shape === 'object' && isArray) {
      out.issues.push(issue('P05', at, `${kind} 파일에는 정의 1개(객체)만 둔다`))
      continue
    }
    if (shape === 'array' && !isArray) {
      out.issues.push(issue('P05', at, `${kind} 파일은 배열이다`))
      continue
    }
    const items: [unknown, string][] = Array.isArray(r.value) ? r.value.map((v, i) => [v, `/${i}`]) : [[r.value, '']]
    if (isArray && items.length === 0) out.issues.push(issue('P05', at, '빈 배열 파일', 'warn'))

    for (const [value, pointer] of items) {
      if (!isPlainObject(value)) {
        out.issues.push(issue('P05', { ...at, pointer }, '정의는 객체여야 한다'))
        continue
      }
      const id = value.id
      if (typeof id !== 'string') {
        out.issues.push(issue('S01', { ...at, pointer: `${pointer}/id` }, 'id(문자열)가 없다'))
        continue
      }
      if ((kind === 'event' || kind === 'chain') && basename(file, '.json') !== id) {
        out.issues.push(issue('P05', { ...at, pointer: '/id' }, `파일 이름과 id가 다르다: 파일 ${basename(file)}, id ${id}`))
        continue
      }
      if (kind === 'event' && value.category !== parts[1]) {
        out.issues.push(issue('P05', { ...at, pointer: '/category' }, `분류 폴더(${parts[1]})와 category(${String(value.category)})가 다르다`))
        continue
      }
      out.defs.push({ kind, id, value, pack, file, pointer })
    }
  }
  return out
}
