// 패치(CONTENT_SCHEMA §1.5). 연산은 merge(RFC 7386 JSON Merge Patch) 하나뿐이다.
import { z } from 'zod'
import { CONTENT_KIND_NAMES, obj } from '../core'
import { issue, toPointer, zodToIssues, type ContentIssue } from '../validate/issues'
import type { DefIndex } from './index-defs'
import type { PatchFile } from './read'

export const patchOpSchema = obj({
  target: obj({ kind: z.enum(CONTENT_KIND_NAMES), id: z.string() }),
  op: z.string().refine((op) => op === 'merge', { error: "패치 op는 'merge'만 쓴다", params: { rule: 'P07' } }),
  // record로 받으면 키 __proto__를 조용히 버린다. 받은 객체를 그대로 넘겨 merge 결과를 종류 스키마가 거르게 한다
  value: z.custom<Record<string, unknown>>(isPlainObject, '패치 value는 객체다'),
})
export type PatchOp = z.infer<typeof patchOpSchema>

// 파일은 배열만 보고 연산은 하나씩 검사한다(잘못된 연산 하나가 나머지 오류를 가리지 않게)
const patchFileSchema = z.array(z.unknown())

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// 객체는 재귀 병합, null은 키 삭제, 그 밖(배열 포함)은 통째로 교체. 원본 키 순서를 유지한다
export function mergePatch(target: unknown, patch: unknown): unknown {
  if (!isPlainObject(patch)) return patch
  const out: Record<string, unknown> = isPlainObject(target) ? { ...target } : {}
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete out[key]
    // 대입하지 않고 own 속성으로 둔다(키 __proto__가 프로토타입을 바꾸지 않게)
    else Object.defineProperty(out, key, { value: mergePatch(Object.hasOwn(out, key) ? out[key] : undefined, value), enumerable: true, writable: true, configurable: true })
  }
  return out
}

// 패치 파일을 주어진 순서(팩 순서 → 팩 안 경로 사전순)대로, 파일 안에서는 배열 순서대로 적용한다
export function applyPatches(index: DefIndex, files: readonly PatchFile[]): ContentIssue[] {
  const issues: ContentIssue[] = []
  // `kind id 최상위 키` → 처음 merge한 팩(P09)
  const firstPack = new Map<string, string>()
  for (const f of files) {
    const r = patchFileSchema.safeParse(f.value)
    if (!r.success) {
      issues.push(...zodToIssues(r.error.issues, f))
      continue
    }
    r.data.forEach((raw, i) => {
      const at = { pack: f.pack, file: f.file, pointer: `/${i}` }
      const parsed = patchOpSchema.safeParse(raw)
      if (!parsed.success) return void issues.push(...zodToIssues(parsed.error.issues, at))
      const op = parsed.data
      const { kind, id } = op.target
      const def = index.get(kind)?.get(id)
      if (!def) return void issues.push(issue('P07', { ...at, pointer: `/${i}/target` }, `패치 대상이 없다: ${kind} '${id}'`))
      if ('id' in op.value && op.value.id !== id) {
        return void issues.push(issue('P07', { ...at, pointer: `/${i}/value/id` }, 'id는 패치로 바꿀 수 없다'))
      }
      for (const key of Object.keys(op.value)) {
        const slot = `${kind} ${id} ${key}`
        const prev = firstPack.get(slot)
        if (prev === undefined) firstPack.set(slot, f.pack)
        else if (prev !== f.pack) {
          const where = { ...at, pointer: `/${i}/value${toPointer([key])}` }
          issues.push(issue('P09', where, `두 팩이 같은 키를 merge한다: ${kind} ${id}.${key} (${prev}, ${f.pack}). 나중 팩 값이 남는다`, 'warn'))
        }
      }
      def.value = mergePatch(def.value, op.value) as Record<string, unknown>
      ;(def.patches ??= []).push(at)
    })
  }
  return issues
}
