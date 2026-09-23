// 유효 레벨·위험 차·위험 등급(01 §7.2)과 유효 위험 상한(04 §10.1).
import type { Content } from '../content/index'
import { levelTier } from '../items/stats'
import { characterOf, type RuleContext } from '../rules/context'
import { ACTIVITIES, ACTIVITY_RISKS } from '../schema/index'

export type Activity = (typeof ACTIVITIES)[number]
export type ActivityRisk = (typeof ACTIVITY_RISKS)[number]

// 장소 종류 → 활동(04 §1)
export function activityOf(kind: string): Activity {
  return kind === 'dungeon_floor' ? 'dungeon' : kind === 'adventure_route' ? 'adventure' : 'hunt'
}

// 유효 레벨 = 레벨 + (무기·방어구 평균 단계 − 레벨 기준 단계) × 단계당 보정(01 §7.2)
export function effectiveLevel(ctx: RuleContext): number {
  const { content, state } = ctx
  const ch = characterOf(ctx)
  const tierOf = (slot: 'weapon' | 'armor'): number => {
    const uid = state.inventory.equipped[slot]
    return uid ? content.get('item', state.item_instances[uid]!.def_id).tier : 0
  }
  const gap = (tierOf('weapon') + tierOf('armor')) / 2 - levelTier(content, ch.level)
  return ch.level + Math.round(gap * content.balance.risk.gear_level_per_tier)
}

// 장소 권장 레벨 중앙값(마을은 인물 레벨)
export function regionLevel(ctx: RuleContext, regionId: string): number {
  const r = ctx.content.get('region', regionId)
  return r.kind === 'town' ? characterOf(ctx).level : r.level_mid
}

// 위험 차 = 권장 중앙값 − 유효 레벨. 밤 출정은 적 레벨 +1이라 위험 차도 +1(01 §1.2·§7.2)
export function riskDiff(ctx: RuleContext, regionId: string, night: boolean): number {
  return regionLevel(ctx, regionId) - effectiveLevel(ctx) + (night ? ctx.content.balance.combat.night.risk_add : 0)
}

export function riskGrade(content: Content, diff: number): ActivityRisk {
  return content.balance.risk.bands.find((b) => b.max === undefined || diff <= b.max)!.grade
}

export const riskRank = (grade: ActivityRisk): number => ACTIVITY_RISKS.indexOf(grade)

// 유효 위험 상한(04 §10.1). 태도 기본일 때만 모험적의 모험 활동 예외를 쓴다
export function riskCap(ctx: RuleContext, activity?: Activity): ActivityRisk {
  const cap = ctx.state.policies.risk_cap
  if (cap !== 'attitude_default') return cap
  const att = ctx.content.get('attitude', ctx.state.policies.attitude)
  return activity === 'adventure' && att.max_risk_adventure ? att.max_risk_adventure : att.max_risk
}

// 관문 위험 차(07 §5.6): 관문 적 레벨(밤 +1) − 유효 레벨
export function gateRiskDiff(ctx: RuleContext, enemyId: string, night: boolean): number {
  const lv = ctx.content.get('enemy', enemyId).level + (night ? ctx.content.balance.combat.night.enemy_level_add : 0)
  return lv - effectiveLevel(ctx)
}
