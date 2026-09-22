// 콘텐츠 팩 CLI
//   tsx packages/content-kit/src/cli.ts check <팩 경로...> [--json] [--strict]
//     팩을 읽고 검증한다. 경로가 팩 폴더가 아니면 바로 아래 팩 폴더들을 읽는다(예: content).
//   tsx packages/content-kit/src/cli.ts schema <출력 폴더>
//     종류별 JSON Schema(<kind>.schema.json)를 쓴다. 파일 모양(객체·배열)을 반영한다.
// 종료 코드: 0 통과(경고만), 1 오류(--strict면 경고도), 2 사용법 오류
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { CONTENT_KIND_NAMES, type ContentKind } from './core'
import { fileShapeOf } from './pack/read'
import { validateContent } from './validate/index'
import { formatIssue } from './validate/issues'
import { KIND_SCHEMAS } from './validate/kind-schemas'

const USAGE = '사용법: cli.ts check <팩 경로...> [--json] [--strict] | cli.ts schema <출력 폴더>'

function check(paths: string[], flags: Set<string>): number {
  const { issues } = validateContent(paths)
  const errors = issues.filter((i) => i.severity === 'error').length
  const warns = issues.length - errors
  if (flags.has('--json')) console.log(JSON.stringify(issues, null, 2))
  else {
    for (const i of issues) console.log(formatIssue(i))
    console.log(`콘텐츠 검사: 오류 ${errors}건, 경고 ${warns}건`)
  }
  return errors > 0 || (flags.has('--strict') && warns > 0) ? 1 : 0
}

function fileSchema(kind: ContentKind): z.ZodType {
  const def = KIND_SCHEMAS[kind]
  const shape = fileShapeOf(kind)
  return shape === 'object' ? def : shape === 'array' ? z.array(def) : z.union([def, z.array(def)])
}

function schema(outDir: string): number {
  mkdirSync(outDir, { recursive: true })
  for (const kind of CONTENT_KIND_NAMES) {
    const json = z.toJSONSchema(fileSchema(kind), { io: 'input', unrepresentable: 'any' })
    writeFileSync(join(outDir, `${kind}.schema.json`), JSON.stringify(json, null, 2) + '\n')
  }
  console.log(`JSON Schema ${CONTENT_KIND_NAMES.length}개: ${outDir}`)
  return 0
}

function main(argv: string[]): number {
  const [cmd, ...rest] = argv
  const flags = new Set(rest.filter((a) => a.startsWith('--')))
  const args = rest.filter((a) => !a.startsWith('--'))
  const allowed = cmd === 'check' ? ['--json', '--strict'] : []
  const unknown = [...flags].filter((f) => !allowed.includes(f))
  if (unknown.length > 0) console.error(`모르는 옵션: ${unknown.join(' ')}`)
  else if (cmd === 'check') return check(args, flags)
  else if (cmd === 'schema' && args.length === 1) return schema(args[0]!)
  console.error(USAGE)
  return 2
}

process.exitCode = main(process.argv.slice(2))
