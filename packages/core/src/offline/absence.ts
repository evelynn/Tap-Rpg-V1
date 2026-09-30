// 부재 시간 측정(13 §2.1). 최고 관측 시각(high_water)을 기준으로 삼아 같은 구간을 두 번 정산하지 않는다.
// 현재 시각은 코어가 읽지 않고 밖에서 받는다(I19).
import type { Content } from '../content/index'
import type { SaveBody } from '../state/save'

const MIN_MS = 60 * 1000
const HOUR_MS = 60 * MIN_MS

// 이 값이 새로 정한 수치다(13 "이 문서가 새로 정한 값")
export const CLOCK_BACKWARD_TOLERANCE_MS = 5 * MIN_MS
export const FORWARD_JUMP_MS = 48 * HOUR_MS

export type SkipReason = 'clock_backward' | 'too_short' | 'policy_off' | 'paused' | 'no_character'

export interface Absence {
  absent_sec: number // 부재 시간(상한 적용 전)
  settleable_sec: number // 정산 가능 시간(상한 적용 후)
  skip: SkipReason | null // null이면 정산한다
}

export interface AbsenceInput {
  now_utc: number // 현재 실제 시각(UTC 밀리초)
  saved_at_utc: number // 마지막 저장 시각(save_root.header)
}

// offline_state를 제자리에서 갱신한다(high_water_utc, clock_anomalies)
export function measureAbsence(content: Content, state: SaveBody, input: AbsenceInput): Absence {
  const off = state.offline_state
  const { now_utc: now, saved_at_utc: last } = input
  const hw = off.high_water_utc
  let absent = 0

  if (now < hw - CLOCK_BACKWARD_TOLERANCE_MS) {
    // 시계 역행: hw는 유지한다. 시계가 다시 hw를 넘어설 때까지 정산하지 않는다
    off.clock_anomalies.push({ kind: 'backward', now, hw })
    return { absent_sec: 0, settleable_sec: 0, skip: 'clock_backward' }
  }
  if (now >= hw) {
    absent = Math.max(0, now - Math.max(last, hw)) // 저장 시각이 now보다 늦으면 0(음수 부재는 없다)
    // 미래 점프는 막지 않는다. 상한과 정지 지점만으로 이득을 제한하고 기록만 남긴다
    if (absent > FORWARD_JUMP_MS) off.clock_anomalies.push({ kind: 'forward_jump', now, hw, absent })
    off.high_water_utc = now
  }

  const o = content.balance.offline
  const settleableSec = Math.min(Math.floor(absent / 1000), o.cap_sec)
  const skip = pickSkip(state, settleableSec, o.min_sec)
  return { absent_sec: Math.floor(absent / 1000), settleable_sec: settleableSec, skip }
}

function pickSkip(state: SaveBody, settleableSec: number, minSec: number): SkipReason | null {
  // 일시정지로 종료한 경우 부재 시간은 계산하되 정산하지 않는다(13 §2.1)
  if (state.current_activity.state === 'paused') return 'paused'
  if (!state.policies.offline_progress) return 'policy_off' // 01 §18.2
  if (!state.character) return 'no_character'
  if (settleableSec < minSec) return 'too_short' // 01 §15 최소 정산 단위
  return null
}
