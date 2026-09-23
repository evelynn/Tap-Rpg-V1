// 헤드리스 밸런스 시뮬레이터 진입점(17 §5).
//
//   pnpm sim [--attitude stable|adventurous|challenging|all] [--seeds 1-100] [--minutes 600] [--lives N]
//            [--content content/base ...] [--out reports/] [--json] [--csv] [--rules <해시>]
//
// 게임 규칙 코드를 그대로 부른다(오프라인 정산과 같은 경로). 같은 입력이면 같은 보고가 나온다.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs, USAGE, type SimArgs } from './args'
import { toCsv, toMarkdown } from './report'
import { runSim } from './run'

export const REPORT_FILES = { markdown: 'sim-report.md', csv: 'sim-lives.csv', json: 'sim-report.json' } as const

function main(argv: readonly string[]): number {
  let args: SimArgs
  try {
    args = parseArgs(argv)
  } catch (e) {
    console.error((e as Error).message)
    console.error(USAGE)
    return 2
  }
  if (args.help) {
    console.log(USAGE)
    return 0
  }

  const progress = (done: number, total: number): void => void process.stderr.write(`\r가문 ${done}/${total}`)
  const { rows, report } = runSim(args, () => Date.now(), progress)
  process.stderr.write('\n')

  mkdirSync(args.out, { recursive: true })
  const markdown = join(args.out, REPORT_FILES.markdown)
  const written = [markdown]
  writeFileSync(markdown, toMarkdown(report))
  if (args.csv) {
    const p = join(args.out, REPORT_FILES.csv)
    writeFileSync(p, toCsv(rows))
    written.push(p)
  }
  if (args.json) {
    const p = join(args.out, REPORT_FILES.json)
    writeFileSync(p, JSON.stringify(report, null, 2) + '\n')
    written.push(p)
  }
  console.log(toMarkdown(report))
  console.log(`보고: ${written.join(', ')}`)
  return 0
}

process.exitCode = main(process.argv.slice(2))
