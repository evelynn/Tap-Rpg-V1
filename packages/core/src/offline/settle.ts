// 오프라인 정산(13 §2.2). 연출만 빼고 온라인과 같은 규칙으로 행동을 하나씩 돌린다.
// 매 판단 지점에서 정지 지점(13 §3.1)을 보고, 멈추면 남은 정산 가능 시간은 버린다(13 §3.2).
import { activityDecide, COUNTERS } from '../activity/index'
import { characterOf } from '../rules/context'
import { stageBoundaries } from '../life/index'
import type { ActionKind, ResolvedAction } from '../state/activity'
import { ageAt, stageBoundaryReached } from '../time/index'
import type { World } from '../sim/world'
import { buildSummary, lifeSnapshot, type ActionTally, type LifeSnapshot, type ReturnSummary } from './summary'
import type { StopReason } from './stop'

export interface SettleOptions {
  // 다음 행동을 고르는 규칙. 기본은 활동 층의 상태 기계(04 §2.2)
  decide?: (world: World) => ActionKind
}

const toMs = (min: number): number => Math.round(min * 60000)

// 생애 종료로 멈춘 이유(13 §6.2). 자동 계승이 켜져 있으면 계승 5단계 `출발` 확인에서 기다린다
function lifeEndReason(world: World): StopReason {
  if (world.state.policies.auto_succession) return 'heir_ready'
  const rec = world.state.family.chronicle[world.state.family.chronicle.length - 1]
  if (rec?.end_kind === 'died') return 'life_end_died'
  if (rec?.end_kind === 'long_sleep') return 'life_end_long_sleep'
  return 'life_end_retired'
}

// 확정 결과 하나를 끝까지 진행하고 적용한다. 쓴 밀리초를 돌려준다
function runAction(world: World, action: ResolvedAction, durMs: number): number {
  const used = durMs > 0 ? world.advance(durMs / 1000) : 0
  world.applyAction(action) // 0초 행동은 advance가 적용하지 않는다
  return Math.round(used * 1000)
}

// settleableSec만큼 정산한다. 세계는 이미 불러온 상태여야 한다(loadGameWorld)
export function settleOffline(world: World, settleableSec: number, opts: SettleOptions = {}): ReturnSummary {
  const decide = opts.decide ?? activityDecide
  const time = world.content.balance.time
  const boundaries = stageBoundaries(world.content)
  const chronicleAt = world.state.family.chronicle.length
  const journalFrom = world.state.journal.reduce((m, e) => Math.max(m, e.id), 0)

  const start = characterOf(world)
  const before = lifeSnapshot(start, ageAt(start.eff_min, time))
  const startCounters = { ...start.counters }
  let after: LifeSnapshot = before
  const tally: ActionTally = { sorties: 0, gate_wins: 0, returns: 0, defeats: 0 }

  let budgetMs = Math.round(settleableSec * 1000)
  const budgetStart = budgetMs
  let boundary: number | null = null

  const stopNow = (): StopReason | null => {
    if (world.state.family.chronicle.length > chronicleAt) return lifeEndReason(world)
    const p = world.state.pending_choice
    if (p) return p.kind === 'fate' ? 'fate_pending' : 'chain_branch_pending'
    // 이미 계승 대기인 저장을 불러온 경우에도 그 자리에서 멈춘다(13 §3.1 3순위)
    if (world.state.current_activity.state === 'awaiting_succession') return lifeEndReason(world)
    // 생애 단계 경계 정지는 오프라인 정산에만 적용한다(13 §3.1)
    if (world.state.policies.stage_boundary_stop && boundary !== null) return 'stage_boundary'
    return null
  }

  const afterAction = (action: ResolvedAction, fromAge: number): void => {
    if (action.kind === 'gate' && action.outcome === 'win') tally.gate_wins += 1
    if (action.outcome === 'defeat') tally.defeats += 1
    const ch = world.state.character
    if (!ch || ch.uid !== before.uid) return
    boundary = stageBoundaryReached(fromAge, ageAt(ch.eff_min, time), boundaries)
    after = lifeSnapshot(ch, ageAt(ch.eff_min, time))
  }

  // 1. 저장 파일에 남은 확정 결과를 먼저 적용한다(13 §2.2 1). 이미 정해진 결과라 다시 굴리지 않는다
  const left = world.state.current_activity.resolved_action
  if (left && !left.applied && world.clockRunning) {
    const fromAge = ageAt(characterOf(world).eff_min, time)
    const remainMs = Math.max(0, toMs(left.started_eff_min) + left.duration_sec * 1000 - toMs(characterOf(world).eff_min))
    budgetMs -= runAction(world, left, remainMs)
    afterAction(left, fromAge)
  }

  // 2. 판단 지점마다 정지 지점을 보고 행동 1개씩 진행한다
  let reason = stopNow()
  while (!reason) {
    if (budgetMs <= 0) {
      reason = 'cap_reached'
      break
    }
    const fromAge = ageAt(characterOf(world).eff_min, time)
    const action = world.startAction(decide(world))
    const durMs = action.duration_sec * 1000
    // 예산이 다음 행동 1개보다 작으면 그 행동을 진행하지 않고 끝낸다(13 §2.2 5).
    // 확정 결과는 그대로 남아 다음 접속에서 이어진다(13 §8.3)
    if (durMs > budgetMs) {
      reason = 'cap_reached'
      break
    }
    budgetMs -= runAction(world, action, durMs)
    afterAction(action, fromAge)
    reason = stopNow()
  }

  const ch = world.state.character
  if (ch && ch.uid === before.uid) {
    tally.sorties = (ch.counters[COUNTERS.sorties] ?? 0) - (startCounters[COUNTERS.sorties] ?? 0)
    tally.returns = (ch.counters[COUNTERS.safeReturns] ?? 0) - (startCounters[COUNTERS.safeReturns] ?? 0)
  }
  // 이번 정산에서 남은 기록은 오프라인 기록이다(16 §5.6 offline)
  for (const e of world.state.journal) if (e.id > journalFrom) e.offline = true

  const settledSec = Math.max(0, budgetStart - budgetMs) / 1000
  return buildSummary(world.state, {
    before,
    after,
    tally,
    stop_reason: reason,
    settled_sec: settledSec,
    discarded_sec: Math.max(0, budgetMs) / 1000,
    journal_from: journalFrom,
  })
}
