// 게임·시뮬레이터용 번들(CONTENT_SCHEMA §2.4). 같은 입력이면 같은 바이트가 나온다.
import { createHash } from 'node:crypto'
import { CONTENT_BUNDLE_FORMAT, CONTENT_KIND_NAMES, type ContentKind } from '../core'
import type { DefIndex } from './index-defs'
import type { PackManifest } from './manifest'

// 코어가 읽는 번들 형식 번호를 그대로 쓴다(단일 출처는 코어 content/index.ts)
export const BUNDLE_FORMAT = CONTENT_BUNDLE_FORMAT

export interface ContentBundle {
  format: number
  packs: { id: string; version: string }[]
  // defs의 정규 JSON sha256(16진)
  content_hash: string
  defs: Partial<Record<ContentKind, Record<string, unknown>>>
}

// 정규 JSON: 객체 키를 사전순으로 정렬하고 공백 없이 쓴다
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

export function contentHash(defs: ContentBundle['defs']): string {
  return createHash('sha256').update(canonical(defs)).digest('hex')
}

// 종류는 CONTENT_KINDS 순서, 종류 안 정의는 로드 순서(팩 순서 → 경로 → 배열 순서)
export function buildBundle(index: DefIndex, packs: readonly PackManifest[]): ContentBundle {
  const defs: ContentBundle['defs'] = {}
  for (const kind of CONTENT_KIND_NAMES) {
    const byId = index.get(kind)
    if (byId?.size) defs[kind] = Object.fromEntries([...byId].map(([id, d]) => [id, d.value]))
  }
  return {
    format: BUNDLE_FORMAT,
    packs: packs.map((p) => ({ id: p.id, version: p.version })),
    content_hash: contentHash(defs),
    defs,
  }
}
