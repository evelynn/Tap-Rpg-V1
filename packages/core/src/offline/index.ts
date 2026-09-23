// 오프라인 진행(13 §2·§3·§6): 부재 시간 측정, 정산, 정지 지점, 복귀 요약 데이터.
export { STOP_REASONS, type StopReason } from './stop'
export {
  CLOCK_BACKWARD_TOLERANCE_MS, FORWARD_JUMP_MS, type Absence, type AbsenceInput, type SkipReason, measureAbsence,
} from './absence'
export { type SettleOptions, settleOffline } from './settle'
export { type ActionTally, type LifeSnapshot, type ReturnSummary, buildSummary, lifeSnapshot } from './summary'
export { type OfflineResult, runOffline } from './run'
