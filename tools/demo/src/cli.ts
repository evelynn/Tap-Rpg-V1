// 데모 실행기 진입점: pnpm demo [옵션]. 터미널 출력·입력과 일지 저장만 맡는다.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs, renderIntro, USAGE, type DemoArgs } from './args'
import { createLineSource, makeAsk } from './input'
import { budgetMinutes, play, type PlayDeps, type PlayResult } from './play'
import { renderStatus, type StatusView } from './render'
import { createDemoWorld, loadContent, seedHex } from './world'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))

// 화면 출력: 터미널이면 상태 줄을 한 줄에 덮어쓰고, --plain이면 줄 단위로만 쓴다
function makeOut(plain: boolean): { write(text: string): void; raw(text: string): void; status(view: StatusView): void; end(): void } {
  const tty = !plain && process.stdout.isTTY === true
  let bar = ''
  let barShown = false // 커서가 있는 줄에 상태 줄이 그려져 있다
  let mark = ''
  return {
    write(text) {
      if (tty) process.stdout.write('\r\x1b[2K')
      process.stdout.write(text + '\n')
      if (tty && bar) process.stdout.write(bar)
      barShown = tty && bar !== ''
    },
    // 줄바꿈 없이 그대로 쓴다(선택 물음). 상태 줄이 그려져 있으면 먼저 지운다
    raw(text) {
      if (barShown) process.stdout.write('\r\x1b[2K')
      barShown = false
      process.stdout.write(text)
    },
    status(view) {
      bar = renderStatus(view)
      if (tty) {
        process.stdout.write('\r\x1b[2K' + bar)
        barShown = true
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

  let world
  try {
    world = createDemoWorld(loadContent(args.content), args)
  } catch (e) {
    console.error((e as Error).message)
    return 1
  }
  const out = makeOut(args.plain)
  console.log(renderIntro(args))

  let stop = false
  // 입력 줄은 미리 들어온 것(파이프)까지 차례로 쓴다. 입력이 끝나면 이후 선택은 자동이다
  const source = args.auto ? null : createLineSource(process.stdin)
  // Ctrl+C: 입력을 기다리던 중이면 물음을 끊고(abort) 루프를 멈춘다
  const abort = new AbortController()
  const onSigint = (): void => {
    stop = true
    abort.abort()
    source?.close()
  }
  process.on('SIGINT', onSigint)

  const ask = source
    ? makeAsk({
        source,
        write: (t) => out.raw(t),
        // 터미널끼리면 입력이 되비치지만, 파이프·파일이 끼면 답과 줄바꿈을 직접 남긴다
        echo: !(process.stdin.isTTY === true && process.stdout.isTTY === true),
        // 터미널 입력이면 잘못 친 번호를 다시 묻는다. 파이프·파일은 다음 줄이 다음 선택의 답이라 다시 묻지 않는다
        retry: process.stdin.isTTY === true,
        signal: abort.signal,
        stopped: () => stop,
      })
    : null

  const deps: PlayDeps = {
    write: (t) => out.write(t),
    status: (v) => out.status(v),
    sleep: (ms) => delay(ms),
    stopped: () => stop,
    ...(ask ? { ask } : {}),
  }

  let result: PlayResult
  try {
    result = await play(world, args, deps)
  } finally {
    process.off('SIGINT', onSigint)
    source?.close()
    out.end()
  }

  console.log(`\n끝. 생애 ${result.lives}회 · 유효 진행 ${Math.round(result.minutes)}분 · 기록 ${result.lines.length}줄`)
  if (args.minutes === null && result.lives < args.gen && !stop) {
    console.log(`안전 상한 ${budgetMinutes(world, args)}유효분에 닿아 멈췄다(생애가 끝나지 않았다). --minutes 로 늘릴 수 있다.`)
  }
  if (args.save) console.log(`일지 저장: ${saveReport(args, result)}`)
  return 0
}

process.exitCode = await main(process.argv.slice(2))
