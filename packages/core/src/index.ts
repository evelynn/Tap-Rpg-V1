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
