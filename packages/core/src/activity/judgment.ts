// 판단 지점 처리(04 §2.3, 10 §3): 숨 고르기 → 사건 검사·적용 → 현장 판단.
import { runJudgment, type JudgmentTrigger } from '../events/index'
import type { World } from '../sim/world'
import { addPendingSec, beginReturn, currentSortie } from './sortie'
import { fieldJudgment, type FieldDecision } from './field'

// 연출 시간 이월은 출정 쪽이 카운터로 든다(I44 후보). 부르는 쪽이 이 이름을 써 온다
export { addPendingSec, takePendingSec } from './sortie'

export interface JudgmentOptions {
  encounter?: number // 이번 출정에서 끝난 조우 번호(10 §3.4 첫 출정 보장)
  nextRoomOk?: () => boolean // 던전 다음 방 진입 판단(07 §5.5). 04 §2.3 D39 순서대로 사건·회복약 뒤에 잰다
}

// 사건 검사 1회. 즉시 귀환을 부르는 결과(end_sortie)면 true
export function checkEvents(world: World, trigger: JudgmentTrigger, place: string, opts: JudgmentOptions = {}): boolean {
  const res = runJudgment(world, { trigger, place, ...(opts.encounter !== undefined ? { encounter: opts.encounter } : {}) }, world.ports)
  if (!res) return false
  addPendingSec(world, res.addSec)
  return res.endSortie !== null
}

// 현장 판단 지점(J3~J6): 사건 검사 뒤 04 §7.5를 돌리고 상태를 옮긴다.
// trigger가 null이면 사건 검사를 건너뛴다(함정 방 뒤, D38)
export function fieldPoint(world: World, trigger: JudgmentTrigger | null, opts: JudgmentOptions = {}): FieldDecision {
  const s = currentSortie(world)
  const command = trigger !== null && checkEvents(world, trigger, s.location_id, opts)
  // 선택 대기가 걸리면 시계가 멈춘다(04 §2.1). 판단은 선택이 해소된 뒤 다시 한다
  if (world.state.pending_choice) return 'continue'
  const d = fieldJudgment(world, { returnCommand: command, ...(opts.nextRoomOk !== undefined ? { nextRoomOk: opts.nextRoomOk } : {}) })
  const ca = world.state.current_activity
  if (d === 'return') beginReturn(world)
  else if (d === 'camp') ca.state = 'camp'
  return d
}
