// 시뮬레이션 실행: 태도 × 시드마다 가문 하나를 돌리고 보고를 만든다(17 §5).
// 파일·시계는 만지지 않는다(cli.ts 몫).
import type { Content } from '@tap/core'
import type { SimArgs } from './args'
import { loadContent } from './content'
import { runFamily, type LifeRow } from './life'
import { buildReport, type SimReport } from './report'

// 생애당 유효 진행 분 상한. 주지 않으면 콘텐츠의 생애 길이에서 계산한다.
// 생명 연장(F02)·흡혈귀 긴 잠으로 은퇴가 늦어질 수 있어 기본 생애 길이의 3배를 안전 상한으로 둔다
export function lifeCap(content: Content, minutes: number): number {
  if (minutes > 0) return minutes
  const t = content.balance.time
  return (t.base_retire_age - t.start_age) * t.min_per_year * 3
}

export function resolveAttitudes(content: Content, attitude: string): string[] {
  const all = [...content.list('attitude')].sort((a, b) => a.order - b.order).map((a) => a.id)
  if (attitude === 'all') return all
  if (!all.includes(attitude)) throw new Error(`모르는 태도: ${attitude}(${all.join(', ')})`)
  return [attitude]
}

export interface SimResult {
  rows: LifeRow[]
  report: SimReport
}

// 가문끼리 상태를 나누지 않으므로 순서를 바꿔도 같은 결과가 나온다.
// clock은 소요 시간만 재므로 테스트는 고정 시계를 준다
export function runSim(
  args: SimArgs,
  clock: () => number = () => Date.now(),
  onProgress?: (done: number, total: number) => void,
): SimResult {
  const { content, contentHash, packs } = loadContent(args.content)
  const attitudes = resolveAttitudes(content, args.attitude)
  const minutes = lifeCap(content, args.minutes)
  const [lo, hi] = args.seeds
  const total = attitudes.length * (hi - lo + 1)
  const started = clock()
  const rows: LifeRow[] = []
  let done = 0
  for (const attitude of attitudes) {
    for (let seed = lo; seed <= hi; seed++) {
      rows.push(...runFamily(content, { attitude, seed, minutes, lives: args.lives }))
      done += 1
      onProgress?.(done, total)
    }
  }
  const report = buildReport({
    rows, content, contentHash, packs, attitudes, seeds: args.seeds, lives: args.lives, minutes,
    rules: args.rules, lethalAllowed: false, elapsedSec: (clock() - started) / 1000,
  })
  return { rows, report }
}
