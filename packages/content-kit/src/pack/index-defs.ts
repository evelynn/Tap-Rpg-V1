// (kind, id) 색인(CONTENT_SCHEMA §2.2). ID는 종류별 이름공간이고, 같은 종류 안 중복은 팩이 달라도 P06이다.
import type { ContentKind } from '../core'
import { issue, type ContentIssue } from '../validate/issues'
import type { RawDef } from './read'

export type DefIndex = Map<ContentKind, Map<string, RawDef>>

export function buildIndex(defs: readonly RawDef[]): { index: DefIndex; issues: ContentIssue[] } {
  const index: DefIndex = new Map()
  const issues: ContentIssue[] = []
  for (const d of defs) {
    let byId = index.get(d.kind)
    if (!byId) index.set(d.kind, (byId = new Map()))
    const prev = byId.get(d.id)
    if (prev) {
      issues.push(issue('P06', { ...d, pointer: `${d.pointer}/id` }, `${d.kind} '${d.id}' 중복 정의(먼저: ${prev.pack}/${prev.file}). 기존 정의는 patches/로 바꾼다`))
      continue
    }
    byId.set(d.id, d)
  }
  return { index, issues }
}
