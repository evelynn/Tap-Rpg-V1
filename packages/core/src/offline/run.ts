// 부재 측정 → 정산 → 복귀 요약을 한 번에 돈다(13 §2). 게임 창과 시뮬레이터가 시작할 때 부르는 자리다.
// 정산 중 예외가 나면 세계(난수 흐름 포함)가 중간 상태로 남는다. 13 §2.3대로 "정산 전 상태를 유지하고
// 오프라인 진행 없이 시작"하려면 부르는 쪽이 이 World를 버리고 같은 저장 파일로 다시 불러야 한다.
import type { World } from '../sim/world'
import { measureAbsence, type Absence, type AbsenceInput } from './absence'
import { settleOffline, type SettleOptions } from './settle'
import type { ReturnSummary } from './summary'

export interface OfflineResult {
  absence: Absence
  summary: ReturnSummary | null // 정산을 건너뛰었으면 null(absence.skip이 이유)
}

export function runOffline(world: World, input: AbsenceInput, opts: SettleOptions = {}): OfflineResult {
  const absence = measureAbsence(world.content, world.state, input)
  if (absence.skip) return { absence, summary: null }
  const summary = settleOffline(world, absence.settleable_sec, opts)
  // 16 §5.8 last_settlement. 요약 전체가 아니라 수치 몇 개만 저장한다
  world.state.offline_state.last_settlement = {
    absent_sec: absence.absent_sec,
    settled_min: summary.settled_min,
    stop_reason: summary.stop_reason,
    from_age: summary.from_age,
    to_age: summary.to_age,
    summary: {
      sorties: summary.sorties,
      gates: summary.gate_wins,
      level_from: summary.level_from,
      level_to: summary.level_to,
    },
  }
  return { absence, summary }
}
