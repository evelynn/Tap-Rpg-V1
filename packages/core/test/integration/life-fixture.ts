// 생애 루프 통합 테스트 도우미: 기반 팩으로 활동 + 생애 + 계승이 모두 붙은 세계를 만들고 끝까지 돌린다.
import { createGameWorld, sha256, submitPendingAuto, utf8, type World } from '../../src/index'
import { baseContent } from '../combat/base-content'
import { APPEARANCE, SEED } from '../fixture'

export { baseContent }

export interface GameOptions {
  seed?: string
  attitude?: string
  autoSuccession?: boolean
  lethal?: boolean
}

export function makeGame(opts: GameOptions = {}): World {
  const world = createGameWorld(baseContent(), {
    familyName: '조약돌',
    familySeed: opts.seed ?? SEED,
    foundedUtc: 1789500000000,
    character: { name: '모라', background: 'bg_river', birthSeason: 'spring', appearance: APPEARANCE },
  })
  const p = world.state.policies
  if (opts.attitude) p.attitude = opts.attitude
  if (opts.autoSuccession !== undefined) p.auto_succession = opts.autoSuccession
  if (opts.lethal !== undefined) p.lethal_allowed = opts.lethal
  return world
}

export interface RunReport {
  minutes: number // 흐른 유효 진행 분
  steps: number // 1분 걸음 수
  stalls: number // 같은 상태로 10분 동안 행동이 바뀌지 않은 횟수
  choices: number // 자동으로 푼 선택 대기 수
  waits: number // 계승 대기에서 시계가 멈춘 걸음 수
  generations: number // 마지막 세대 번호
}

export interface RunOptions {
  steps?: number // 최대 1분 걸음 수
  until?: (world: World) => boolean // 참이 되면 멈춘다
}

// 1분씩 흘린다. 선택 대기는 자동 선택 규칙(10 §5)으로 풀고, 계승 대기는 부르는 쪽이 정한다(자동 계승이면 훅이 이미 풀었다).
// 멈춤 판정은 17 §4 단계 2와 같다: 같은 상태로 10분 동안 행동 일련번호가 그대로면 1회.
// 길이가 10분을 넘는 행동(무료 중상 치료 12분)은 설계된 대기라 빼고 센다
export function run(world: World, opts: RunOptions = {}): RunReport {
  const limit = opts.steps ?? 2000
  const report: RunReport = { minutes: 0, steps: 0, stalls: 0, choices: 0, waits: 0, generations: 1 }
  let lastSeq = -1
  let lastState = ''
  let same = 0
  for (let i = 0; i < limit; i++) {
    if (opts.until?.(world)) break
    report.steps += 1
    report.generations = world.state.family.generation
    if (world.state.pending_choice) {
      const before = world.state.character?.eff_min ?? 0
      submitPendingAuto(world)
      report.choices += 1
      // 선택 대기에서는 시간이 멈춘다(04 §2.1)
      if ((world.state.character?.eff_min ?? 0) !== before) throw new Error('선택 대기 중에 시간이 흘렀다')
      continue
    }
    if (world.state.current_activity.state === 'awaiting_succession') {
      report.waits += 1
      if (world.advance(60) !== 0) throw new Error('계승 대기 중에 시간이 흘렀다')
      break
    }
    const before = world.state.character?.eff_min ?? 0
    world.advance(60)
    const after = world.state.character?.eff_min ?? before
    report.minutes += Math.max(0, after - before)
    const act = world.state.current_activity.resolved_action
    const seq = act?.seq ?? -1
    const now = world.state.current_activity.state
    const longAction = (act?.duration_sec ?? 0) > 10 * 60
    same = seq === lastSeq && now === lastState && !longAction ? same + 1 : 0
    if (same >= 10) {
      report.stalls += 1
      same = 0
    }
    lastSeq = seq
    lastState = now
  }
  report.generations = world.state.family.generation
  return report
}

// 일지 해시: 기록 순서·태그·문장·상세를 그대로 이어 붙여 해시한다(결정성 비교용)
export function journalHash(world: World): string {
  const text = world.state.journal.map((e) => `${e.id}|${e.char_uid}|${e.tag}|${e.line}|${e.detail ?? ''}`).join('\n')
  return [...sha256(utf8(text))].map((b) => b.toString(16).padStart(2, '0')).join('')
}
