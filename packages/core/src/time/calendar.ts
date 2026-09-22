// 생애 시계: 인물의 유효 진행 분(eff_min, 생성 시점 0)으로 나이·계절·생애 단계를 구한다(01 §1, 09 §1~2).
// 계절·생애 단계 순서는 schema/common의 열거를 쓴다(I08).
import { LIFE_STAGES, SEASONS } from '../schema/common'

// balance.time(16 §2.1) 중 이 모듈이 쓰는 필드
export interface TimeBalance {
  min_per_year: number // 나이 +1에 드는 유효 진행 분
  season_min: number // 계절 하나의 유효 진행 분
  start_age: number // 활동 시작 나이
}

export type Season = (typeof SEASONS)[number]
export type LifeStage = (typeof LIFE_STAGES)[number]

// prime·veteran·elder가 시작하는 나이, 오름차순(balance.aging.life_stages의 from_age, I10)
export type StageBoundaries = readonly [prime: number, veteran: number, elder: number]

export function ageAt(effMin: number, time: TimeBalance): number {
  return time.start_age + Math.floor(effMin / time.min_per_year)
}

export function seasonAt(effMin: number, startSeason: Season, time: TimeBalance): Season {
  const i = SEASONS.indexOf(startSeason) + Math.floor(effMin / time.season_min)
  return SEASONS[i % SEASONS.length] as Season
}

export function lifeStageAt(age: number, boundaries: StageBoundaries): LifeStage {
  return LIFE_STAGES[boundaries.filter((b) => age >= b).length] as LifeStage
}

// fromAge → toAge 사이에 새로 도달한 경계 나이 중 가장 이른 것. 없으면 null.
export function stageBoundaryReached(fromAge: number, toAge: number, boundaries: StageBoundaries): number | null {
  return boundaries.find((b) => fromAge < b && b <= toAge) ?? null
}
