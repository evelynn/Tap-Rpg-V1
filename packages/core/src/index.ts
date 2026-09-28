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
// 행동 결정(04 §3~§6): 위험 등급, 후보 필터, 활동 가중치·장소 점수, 다음 출정 선택
export * from './ai/index'
// 활동(04 §7·§8, 07): 출정 진행, 사냥·던전·모험, 현장 판단, 마을 루틴, 상태 기계.
// 은퇴·긴 잠 도래 판정은 생애 쪽 lifeEndDue 한 벌뿐이다(활동 쪽 retirePending은 없앴다, I08)
export * from './activity/index'
// 이름이 겹치는 것은 먼저 있던 쪽을 그대로 두고 새 쪽에 별칭을 준다(I08)
export { riskCap } from './events/index'
export { type Region, lifeStage, line } from './schema/index'
export { type Candidate } from './state/index'
export { type Candidate as PlaceCandidate, type Region as PlaceDef, lifeStage as aiLifeStage, riskCap as placeRiskCap } from './ai/index'
export { line as activityLine } from './activity/index'
// 생애(09): 나이·노화, 은퇴와 역할, 사망 기록, 흡혈귀 변이, 시스템 사건 발화.
// 은퇴·긴 잠 도래는 lifeEndDue/retirePending 한 벌이 단일 출처다. EndKind는 활동 쪽 이름을 쓴다(I08)
export {
  type AgeTick, type CauseLines, type EarlyRetire, type LetterKind, type LetterState, type LifeEndDue, type LifeEndFire,
  type LongSleepCause, type MutationSpec, type PolicyRow, type RelicOffer, type RetireRolePick, type Retiree, type RoleScore,
  type SystemPhase, type ThirstStage, type FireOptions,
  AGE_DETAIL, CHILDHOOD_DETAIL, NEW_NAME_DETAIL, RELIC_NOTICE_AGE, RELIC_NOTICE_LETHAL, RELIC_WARN, THIRST_MAX, THIRST_MIN,
  addThirst, ageNotices, ageOf, ageTick, appearanceStage, applyBloodRest, applyMutation, atThirstLimit, autoDrinkDue,
  bloodRestPlan, causeLines, cellarRestSec, currentAge, deathNotice, defaultRelicOffer, drinkThirstConsumable, earlyRetireCheck,
  familyChoice, fateItemPort, fireLifeEnd, fireSuccession, fireSystemEvent, letterChoice, letterState, lethalRelicNotice,
  lifeEndChoice, lifeEndDue, lifeEndEvent, lifeStageOf, livingRetirees, longSleepAgeFor, longSleepDue, mutationSpec,
  nextGenPolicies, nightRatio, pickFamilyForm, pickRetireRole, registerRetiree, relicOfferCandidates, retireAgeOf, retirePending,
  retireRoleScores, retireeHeirEvents, retireeModSources, showNoticeOnce, stageBoundaries, systemEvents, textLine, thirst,
  thirstConsumable, thirstFromProgress, thirstOnSortieStart, thirstOnWin, thirstStage, thirstStages, visibleChoiceIds,
  type GrowthSeen, growthNotes, growthSeenOf, skillUseText, statUseText,
} from './life/index'
// 계승(12): 선천 특성 유전, 동반자·자녀 후보, 유품, 정산, 가문 기록, 5단계 계승
export * from './succession/index'
// 생애의 책(18): 엮기·검사·봉인과 덧붙임 3칸(opened·received_by·afterword)
export * from './book/index'
// 시뮬레이션 세계와 행동 골격, 사건 포트 조립, 생애 루프
export * from './sim/index'
// 저장·불러오기(13 §8, 16 §7.1): 정규 JSON·체크섬·스키마 버전과 이전·로드 검사 K1~K7·보정 B1~B15
export * from './save/index'
// 오프라인 진행(13 §2·§3·§6). 세계를 쓰므로 sim 다음에 둔다
export * from './offline/index'
// 가호(01 §19, 04 §10.3, D78)
export * from './blessing/index'
// 직업·기술(05 §8·§10, D79)
export * from './jobs/index'
