// 정지 지점(13 §3.1)과 멈춘 이유 코드(13 §6.2). 같은 판단 지점에서 겹치면 위에서부터 처리한다.
export const STOP_REASONS = [
  'life_end_retired', // 1 생애 종료(자동 계승 꺼짐)
  'life_end_died',
  'life_end_long_sleep',
  'heir_ready', // 1·3 생애 종료 + 자동 계승 켜짐(12 §1.2 5단계 `출발` 확인에서 정지)
  'fate_pending', // 2 운명 사건 대기
  'chain_branch_pending', // 2 연속 사건 중대 분기
  'stage_boundary', // 4 생애 단계 경계
  'cap_reached', // 5 상한 도달
] as const
export type StopReason = (typeof STOP_REASONS)[number]
