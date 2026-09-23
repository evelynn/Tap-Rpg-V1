// T8 테스트 픽스처: 기반 팩으로 활동 세계를 만들고 멈춤 없이 유효 진행을 흘린다.
import { createActivityWorld, submitPendingAuto } from '../../src/activity/index'
import { dungeonTargets } from '../../src/ai/index'
import type { World } from '../../src/sim/world'
import { baseContent } from '../combat/base-content'
import { APPEARANCE, SEED } from '../fixture'

export { baseContent }

export interface SimOptions {
  seed?: string
  attitude?: string
  coins?: number
}

export function makeSim(opts: SimOptions = {}): World {
  const world = createActivityWorld(baseContent(), {
    familyName: '조약돌',
    familySeed: opts.seed ?? SEED,
    foundedUtc: 1789500000000,
    character: { name: '모라', background: 'bg_river', birthSeason: 'spring', appearance: APPEARANCE },
  }, {
    // 생애 종료는 T10 몫이다. 테스트는 계승 대기로 두어 시계를 멈춘다
    onLifeEnd: (w) => {
      w.state.current_activity.state = 'awaiting_succession'
    },
  })
  if (opts.attitude) world.state.policies.attitude = opts.attitude
  if (opts.coins !== undefined) world.state.character!.coins = opts.coins
  return world
}

export interface RunReport {
  minutes: number // 실제로 흐른 유효 진행 분
  stalls: number // 같은 상태에서 10분 동안 행동이 바뀌지 않은 횟수
  ended: boolean // 계승 대기로 끝났다
  choices: number // 자동으로 푼 선택 대기 수
  byActivity: Record<string, number> // 활동별 유효 진행 분(세 활동이 모두 후보가 된 뒤만)
  sorties: Record<string, number> // 활동별 출정 수(같은 조건)
  lengths: number[] // 출정 길이(분)
}

// 멈춤 검사(17 §4 단계 2): 같은 상태로 10분 동안 행동 일련번호가 그대로면 멈춤 1회
export function runMinutes(world: World, minutes: number): RunReport {
  const step = 60 // 1분씩 흘린다
  const report: RunReport = { minutes: 0, stalls: 0, ended: false, choices: 0, byActivity: {}, sorties: {}, lengths: [] }
  let lastSortie: string | null = null
  let lastSeq = -1
  let lastState = ''
  let same = 0
  let dungeonOpen = false
  for (let i = 0; i < minutes; i++) {
    const before = world.state.character?.eff_min ?? 0
    const state = world.state.current_activity.state
    const sortie = world.state.current_activity.sortie
    world.advance(step)
    const after = world.state.character?.eff_min ?? before
    report.minutes += after - before
    // 출정 중 시간 비중(04 §13)은 현장에서 보낸 시간만 센다. 이동·마을은 따로 센다.
    // 던전이 아직 해금되지 않은 초반은 비중 비교에서 뺀다(01 §7.1 가중치는 세 활동이 모두 후보일 때의 값이다)
    if (!dungeonOpen) dungeonOpen = dungeonTargets(world, false, { night: false }).length > 0
    const field = state === 'hunt' || state === 'adventure' || state === 'dungeon' || state === 'camp'
    const key = field && sortie ? sortie.activity : state === 'travel' || state === 'return' ? 'travel' : 'town'
    if (dungeonOpen) report.byActivity[key] = (report.byActivity[key] ?? 0) + (after - before)
    const now2 = world.state.current_activity.sortie
    if (now2 && now2.id !== lastSortie) {
      lastSortie = now2.id
      if (dungeonOpen) report.sorties[now2.activity] = (report.sorties[now2.activity] ?? 0) + 1
    }
    if (!now2 && sortie) report.lengths.push(after - sortie.started_eff_min)
    if (world.state.current_activity.state === 'awaiting_succession') {
      report.ended = true
      break
    }
    if (world.state.pending_choice) {
      submitPendingAuto(world)
      report.choices++
      continue
    }
    const act = world.state.current_activity.resolved_action
    const seq = act?.seq ?? -1
    const now = world.state.current_activity.state
    // 길이가 10분을 넘는 행동(무료 중상 치료 12분)은 멈춤이 아니다
    const longAction = (act?.duration_sec ?? 0) > 10 * 60
    same = seq === lastSeq && now === lastState && !longAction ? same + 1 : 0
    if (same >= 10 || after === before) {
      report.stalls++
      same = 0
    }
    lastSeq = seq
    lastState = now
  }
  return report
}
