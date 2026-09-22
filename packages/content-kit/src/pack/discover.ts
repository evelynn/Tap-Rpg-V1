// 팩 찾기와 로드 순서(CONTENT_SCHEMA §2.1 1~3단계)
import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { issue, zodToIssues, type ContentIssue } from '../validate/issues'
import { manifestSchema, type PackManifest } from './manifest'
import { readJson } from './read'

export interface PackSource {
  dir: string
  manifest: PackManifest
}

const hasManifest = (dir: string) => existsSync(join(dir, 'pack.json'))

// 경로마다: pack.json이 있으면 그 팩, 없으면 바로 아래 폴더 중 팩 전부(예: content/)
export function discoverPacks(paths: readonly string[]): { packs: PackSource[]; issues: ContentIssue[] } {
  const packs: PackSource[] = []
  const issues: ContentIssue[] = []
  const dirs: string[] = []
  for (const p of paths) {
    const dir = resolve(p)
    if (hasManifest(dir)) {
      dirs.push(dir)
      continue
    }
    const subs = existsSync(dir) && statSync(dir).isDirectory()
      ? readdirSync(dir).sort().map((n) => join(dir, n)).filter(hasManifest)
      : []
    if (subs.length === 0) issues.push(issue('P01', { pack: basename(dir), file: 'pack.json' }, `팩(pack.json)이 없다: ${p}`))
    dirs.push(...subs)
  }

  for (const dir of dirs) {
    const at = { pack: basename(dir), file: 'pack.json' }
    const json = readJson(join(dir, 'pack.json'))
    if (!json.ok) {
      issues.push(issue('P08', at, json.message))
      continue
    }
    const r = manifestSchema.safeParse(json.value)
    if (!r.success) {
      issues.push(...zodToIssues(r.error.issues, at).map((i) => ({ ...i, code: 'P01' as const })))
      continue
    }
    const dup = packs.find((s) => s.manifest.id === r.data.id)
    if (dup) {
      issues.push(issue('P06', { pack: r.data.id, file: 'pack.json', pointer: '/id' }, `팩 id 중복: ${dup.dir}, ${dir}`))
      continue
    }
    packs.push({ dir, manifest: r.data })
  }
  if (packs.length === 0 && issues.length === 0) issues.push(issue('P01', { pack: '', file: '' }, '로드할 팩이 없다'))
  return { packs, issues }
}

// requires 위상 정렬(깊이 우선). 서로 의존이 없는 팩은 id 사전순. 없는 팩은 P03, 순환은 P04
export function orderPacks(manifests: readonly PackManifest[]): { order: PackManifest[]; issues: ContentIssue[] } {
  const byId = new Map(manifests.map((m) => [m.id, m]))
  const state = new Map<string, 'visiting' | 'done'>()
  const order: PackManifest[] = []
  const issues: ContentIssue[] = []

  const visit = (m: PackManifest, stack: string[]): void => {
    const s = state.get(m.id)
    if (s === 'done') return
    if (s === 'visiting') {
      const cycle = [...stack.slice(stack.indexOf(m.id)), m.id].join(' → ')
      issues.push(issue('P04', { pack: m.id, file: 'pack.json', pointer: '/requires' }, `requires 순환: ${cycle}`))
      return
    }
    state.set(m.id, 'visiting')
    for (const req of [...m.requires].sort()) {
      const dep = byId.get(req)
      const at = { pack: m.id, file: 'pack.json', pointer: `/requires/${m.requires.indexOf(req)}` }
      if (dep) visit(dep, [...stack, m.id])
      else issues.push(issue('P03', at, `requires 팩 '${req}'이(가) 로드 대상에 없다`))
    }
    state.set(m.id, 'done')
    order.push(m)
  }

  for (const m of [...manifests].sort((a, b) => (a.id < b.id ? -1 : 1))) visit(m, [])
  return { order, issues }
}
