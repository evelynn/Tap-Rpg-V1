// 실행: pnpm lint:ids — packages/core/src 에 콘텐츠 ID 문자열이나 비결정 API(Math.random·Date)가 있으면 종료 코드 1.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findCoreContentIds, findNondeterminism } from './core-id-scan'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../..')
const coreSrc = join(root, 'packages', 'core', 'src')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : []
  })
}

const files = walk(coreSrc).map((file) => ({ file: relative(root, file), source: readFileSync(file, 'utf8') }))
const hits = files.flatMap((f) => findCoreContentIds(f.file, f.source))
const nondet = files.flatMap((f) => findNondeterminism(f.file, f.source))
for (const h of hits) console.log(`${h.file}:${h.line}: 콘텐츠 ID "${h.id}" — ${h.text}`)
for (const h of nondet) console.log(`${h.file}:${h.line}: 비결정 API "${h.id}" — ${h.text}`)
console.log(`코어 콘텐츠 ID 검사: ${hits.length}건, 비결정 API 검사: ${nondet.length}건`)
process.exit(hits.length + nondet.length ? 1 : 0)
