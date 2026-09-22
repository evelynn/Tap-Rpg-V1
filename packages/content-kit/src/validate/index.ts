// 팩 경로 → 번들(CONTENT_SCHEMA §2.1). 팩 찾기 → 순서 → 파일 → 색인 → 패치 → 스키마(S01) → 참조·의미(V) → 번들.
// 오류가 하나라도 있으면 번들을 만들지 않는다.
import type { z } from 'zod'
import type { ContentKind } from '../core'
import { buildBundle, type ContentBundle } from '../pack/bundle'
import { discoverPacks, orderPacks } from '../pack/discover'
import { buildIndex } from '../pack/index-defs'
import { applyPatches } from '../pack/patch'
import { readPackFiles, type PatchFile, type RawDef } from '../pack/read'
import { hasError, patchNote, zodToIssues, type ContentIssue } from './issues'
import { KIND_SCHEMAS } from './kind-schemas'
import { runSemanticChecks } from './rules'

export interface ValidateOptions {
  // 종류 스키마 바꿔 끼우기(기본 KIND_SCHEMAS)
  schemas?: Partial<Record<ContentKind, z.ZodType>>
  // 참조·의미 검사(V2 등, CONTENT_SCHEMA §7.2). 기본 켬. 종류 스키마를 바꿔 끼워 로더만 보는 테스트는 끈다
  rules?: boolean
}

export interface ValidateResult {
  bundle?: ContentBundle
  issues: ContentIssue[]
}

// paths: 팩 폴더, 또는 팩 폴더들을 담은 폴더(content/)
export function validateContent(paths: readonly string[], opts: ValidateOptions = {}): ValidateResult {
  const schemas = { ...KIND_SCHEMAS, ...opts.schemas }
  const found = discoverPacks(paths)
  if (hasError(found.issues)) return { issues: found.issues }
  const ordered = orderPacks(found.packs.map((p) => p.manifest))
  const issues = [...found.issues, ...ordered.issues]
  if (hasError(issues)) return { issues }

  const defs: RawDef[] = []
  const patches: PatchFile[] = []
  for (const m of ordered.order) {
    const dir = found.packs.find((p) => p.manifest.id === m.id)!.dir
    const r = readPackFiles(dir, m.id)
    defs.push(...r.defs)
    patches.push(...r.patches)
    issues.push(...r.issues)
  }
  const { index, issues: dupIssues } = buildIndex(defs)
  issues.push(...dupIssues, ...applyPatches(index, patches))

  // 패치를 적용한 결과를 검증한다
  for (const [kind, byId] of index) {
    for (const d of byId.values()) {
      const r = schemas[kind].safeParse(d.value)
      if (!r.success) issues.push(...zodToIssues(r.error.issues, d).map((i) => ({ ...i, message: i.message + patchNote(d) })))
    }
  }
  if (hasError(issues)) return { issues }
  if (opts.rules !== false) {
    issues.push(...runSemanticChecks(index, schemas))
    if (hasError(issues)) return { issues }
  }
  return { bundle: buildBundle(index, ordered.order), issues }
}
