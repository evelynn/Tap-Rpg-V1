// 데모 실행기 진입점: pnpm demo [옵션]. 터미널 출력·입력과 일지 저장만 맡는다.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs, renderIntro, USAGE, type DemoArgs } from './args'
import { play, type PlayDeps, type PlayResult } from './play'
import { renderStatus, type ChoiceView, type StatusView } from './render'
import { createDemoWorld, loadContent, seedHex } from './world'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))

// 화면 출력: 터미널이면 상태 줄을 한 줄에 덮어쓰고, --plain이면 줄 단위로만 쓴다
function makeOut(plain: boolean): { write(text: string): void; status(view: StatusView): void; end(): void } {
  const tty = !plain && process.stdout.isTTY === true
  let bar = ''
  let mark = ''
  return {
    write(text) {
      if (tty) process.stdout.write('\r\x1b[2K')
      process.stdout.write(text + '\n')
      if (tty && bar) process.stdout.write(bar)
    },
    status(view) {
      bar = renderStatus(view)
      if (tty) {
        process.stdout.write('\r\x1b[2K' + bar)
        return
      }
      // 줄 단위 출력에서는 나이·레벨이 바뀔 때만 상태를 남긴다
      const key = `${view.gen}|${view.age}|${view.level}`
      if (key === mark) return
      mark = key
      process.stdout.write(bar + '\n')
    },
    end() {
      if (tty && bar) process.stdout.write('\n')
    },
  }
}

function saveReport(args: DemoArgs, result: PlayResult): string {
  const path = join(ROOT, 'reports', `demo-${seedHex(args.seed)}.md`)
  mkdirSync(dirname(path), { recursive: true })
  const head = [
    `# 텝 데모 일지 — ${args.family} 가문`,
    '',
    `- 씨앗: ${args.seed} (${seedHex(args.seed)})`,
    `- 생애 ${result.lives}회 · 유효 진행 ${Math.round(result.minutes)}분`,
    '',
  ]
  // 저장본에는 색 코드를 남기지 않는다
  const body = result.lines.map((l) => l.replace(/\x1b\[[0-9;]*m/g, ''))
  writeFileSync(path, head.concat(body).join('\n') + '\n', 'utf8')
  return path
}

async function main(argv: string[]): Promise<number> {
  let args: DemoArgs
  try {
    args = parseArgs(argv)
  } catch (e) {
    console.error((e as Error).message)
    return 2
  }
  if (args.help) {
    console.log(USAGE)
    return 0
  }

  const world = createDemoWorld(loadContent(), args)
  const out = makeOut(args.plain)
  console.log(renderIntro(args))

  let stop = false
  const rl = args.auto ? null : createInterface({ input: process.stdin, output: process.stdout })
  // Ctrl+C: 입력을 기다리던 중이면 물음을 끊고(abort) 루프를 멈춘다
  const abort = new AbortController()
  const onSigint = (): void => {
    stop = true
    abort.abort()
    rl?.close()
  }
  process.on('SIGINT', onSigint)

  const ask = async (view: ChoiceView): Promise<number> => {
    if (!rl || stop) return 0
    try {
      const answer = await rl.question(`번호를 고르세요 (1~${view.options.length}, 그냥 Enter면 자동): `, { signal: abort.signal })
      return Number(answer.trim())
    } catch {
      // 중단(Ctrl+C)이면 자동 선택으로 넘긴다
      stop = true
      return 0
    }
  }

  const deps: PlayDeps = {
    write: (t) => out.write(t),
    status: (v) => out.status(v),
    sleep: (ms) => delay(ms),
    stopped: () => stop,
    ...(rl ? { ask } : {}),
  }

  let result: PlayResult
  try {
    result = await play(world, args, deps)
  } finally {
    process.off('SIGINT', onSigint)
    rl?.close()
    out.end()
  }

  console.log(`\n끝. 생애 ${result.lives}회 · 유효 진행 ${Math.round(result.minutes)}분 · 기록 ${result.lines.length}줄`)
  if (args.save) console.log(`일지 저장: ${saveReport(args, result)}`)
  return 0
}

process.exitCode = await main(process.argv.slice(2))
