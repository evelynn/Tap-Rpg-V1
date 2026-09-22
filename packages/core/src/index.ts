// @tap/core — 텝 시뮬레이션 코어의 공개 진입점.
// 이 패키지는 DOM·Node API를 쓰지 않는다(tsconfig types: []).
export const ENGINE_VERSION = '0.1.0'
// 콘텐츠 스키마와 등록부(docs/dev/CONTENT_SCHEMA.md). import하면 기본 등록이 실행된다.
export * from './schema/index'
// 결정적 난수: PCG32와 용도별 흐름(13 §8.3, 16 §5.8)
export * from './rng/index'
// 생애 시계. SEASONS·LIFE_STAGES는 schema/common의 같은 값을 쓴다(I08).
export {
  type TimeBalance,
  type Season,
  type LifeStage,
  type StageBoundaries,
  ageAt,
  seasonAt,
  lifeStageAt,
  stageBoundaryReached,
} from './time/index'
// 문장 템플릿 렌더러. 변수 추출 함수는 등록부 templateVars와 이름이 겹쳐 extractTemplateVars로 내보낸다(I08).
export { type TemplateValues, renderTemplate, templateVars as extractTemplateVars } from './text/index'
// 콘텐츠 조회기(번들 → 종류·ID 조회)
export * from './content/index'
// 저장 상태 스키마(16 §5, CONTENT_SCHEMA §6)와 uid 발급기
export * from './state/index'
// 규칙: 수정자 집계, 유도 수치, 판정, 성장, 출생
export * from './rules/index'
// 일지 기록과 보존
export * from './journal/index'
// 전투·패배·사망. 사건 포트의 CombatResult(결과 이름)와 겹쳐 이쪽은 BattleResult로 내보낸다(I36)
export { type CombatResult as BattleResult } from './combat/index'
export * from './combat/combat'
export * from './combat/defeat'
export * from './combat/specials'
export {
  COMBAT_CHECKS, type Battle, type CombatKind, type CombatOutcome, type CombatReward, type EnemyRank, type Foe,
  type Initiative, type RoundRecord, type SavedEffectLike,
} from './combat/types'
// 회복·부상
export * from './recovery/index'
// 장비 굴림·평가·가방
export * from './items/index'
// 가격·상점·마을 정비·길드 지원
export * from './economy/index'
// 사건 엔진(조건·효과·선택지·연속·운명)과 포트
export * from './events/index'
// 시뮬레이션 세계와 행동 골격, 사건 포트 조립
export * from './sim/index'
