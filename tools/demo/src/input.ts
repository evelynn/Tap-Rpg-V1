// 선택 번호 입력. 파이프로 미리 들어온 줄도 순서대로 하나씩 쓰고, 입력이 끝나면(EOF)
// 그 뒤 선택은 사전 방침 자동 선택으로 넘긴다. 스트림만 받으므로 단위 테스트로 검사한다.
import { createInterface } from 'node:readline'

export interface LineSource {
  next(signal?: AbortSignal): Promise<string | null> // 다음 한 줄. 입력이 끝났거나 중단되면 null
  close(): void
}

// readline 의 question() 은 묻지 않을 때 들어온 줄을 버리고, 입력이 끝나면 영영 답하지 않는다.
// 그래서 'line' 을 큐에 모아 두고 차례로 내준다
export function createLineSource(input: NodeJS.ReadableStream): LineSource {
  const rl = createInterface({ input, terminal: false, crlfDelay: Infinity })
  const lines: string[] = []
  const waiters: Array<(line: string | null) => void> = []
  let ended = false
  rl.on('line', (line) => {
    const w = waiters.shift()
    if (w) w(line)
    else lines.push(line)
  })
  rl.on('close', () => {
    ended = true
    for (const w of waiters.splice(0)) w(null)
  })
  return {
    next(signal) {
      if (lines.length) return Promise.resolve(lines.shift()!)
      if (ended || signal?.aborted) return Promise.resolve(null)
      return new Promise((resolve) => {
        const onAbort = (): void => {
          const i = waiters.indexOf(done)
          if (i >= 0) waiters.splice(i, 1)
          resolve(null)
        }
        const done = (line: string | null): void => {
          signal?.removeEventListener('abort', onAbort)
          resolve(line)
        }
        waiters.push(done)
        signal?.addEventListener('abort', onAbort, { once: true })
      })
    },
    close() {
      rl.close()
    },
  }
}

export interface AskIo {
  source: LineSource
  write(text: string): void // 줄바꿈을 붙이지 않고 그대로 쓴다
  echo: boolean // 입력이 화면에 되비치지 않을 때(파이프·파일) 받은 답과 줄바꿈을 직접 쓴다
  signal?: AbortSignal
  stopped?(): boolean // Ctrl+C 같은 중단 신호
}

export const EOF_NOTICE = '입력이 끝났다 — 이번과 이후 선택은 사전 방침으로 자동 처리한다.'
export const AUTO_NOTICE = '(입력 없음 — 사전 방침으로 자동 선택)'

// 번호 1~N 을 돌려준다. 0·NaN 이면 재생 쪽이 자동 선택으로 처리한다
export function makeAsk(io: AskIo): (view: { options: readonly unknown[] }) => Promise<number> {
  let inputEnded = false
  return async (view) => {
    if (io.stopped?.()) return 0
    if (inputEnded) {
      io.write(AUTO_NOTICE + '\n')
      return 0
    }
    io.write(`번호를 고르세요 (1~${view.options.length}, 그냥 Enter면 자동): `)
    const line = await io.source.next(io.signal)
    if (line === null) {
      io.write('\n')
      if (io.stopped?.()) return 0
      inputEnded = true
      io.write(EOF_NOTICE + '\n')
      return 0
    }
    if (io.echo) io.write(line + '\n')
    return Number(line.trim())
  }
}
