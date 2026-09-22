// 부상(01 §6.2, 05 §6.2): 부상 판정, 경상·중상 추가와 합치기, 경상 자연 회복, 중상 누적 → 카운터 획득 특성(TA03).
import type { Rng } from '../rules/random'
import { characterOf, type RuleContext } from '../rules/context'
import { checkDc, rollCheck, type CheckRoll } from '../rules/check'
import type { Stat } from '../rules/derived'
import { recoveryCoef } from '../rules/growth'
import type { Modifier } from '../schema/index'
import { COMBAT_CHECKS } from '../combat/types'

export type InjuryGrade = 'light' | 'serious'

// 부상 판정: d20 + 의지 + 생존 + 기타 ≥ 12 + ⌊지역 레벨 / 3⌋. 성공(대성공 포함) 경상, 나머지 중상
export function rollInjuryCheck(ctx: RuleContext, rng: Rng, regionLevel: number, situational: readonly Modifier[] = []): CheckRoll {
  const dc = checkDc(ctx, COMBAT_CHECKS.injury, { regionLevel })
  return rollCheck(ctx, rng, { kinds: [COMBAT_CHECKS.injury], dc, situational })
}

export const injuryGradeOf = (roll: Pick<CheckRoll, 'result'>): InjuryGrade =>
  roll.result === 'success' || roll.result === 'crit_success' ? 'light' : 'serious'

// 부상 원인별 관련 능력치(05 §6.2): 전투 패배는 힘·민첩 중 무작위(life 흐름), 함정은 민첩, 공포·저주는 의지
export type InjuryCause = 'combat' | 'trap' | 'fear' | 'curse'
export function injuryStat(rng: Rng, cause: InjuryCause): Stat {
  return cause === 'combat' ? rng.pick(['str', 'dex'] as const) : cause === 'trap' ? 'dex' : 'wil'
}

export interface InjuryAdded {
  grade: InjuryGrade // 실제로 붙은 등급(경상 합치기면 serious)
  stat: Stat
  merged: boolean // 경상 상한을 넘어 중상 1개로 합쳤다
  serious_total: number // 생애 중상 누적(카운터 serious_injuries)
  trait_triggers: string[] // 이번에 문턱을 넘은 카운터 획득 특성(TA03). 부여는 특성 규칙 쪽
}

// 부상 추가. 경상이 이미 light_cap개면 그 경상들과 새 경상을 중상 1개로 합친다(01 §6.2, 새 부상의 능력치).
// 중상이면 카운터 serious_injuries를 올리고, 그 카운터 문턱을 이번에 넘은 미보유 특성을 알려 준다
export function addInjury(ctx: RuleContext, grade: InjuryGrade, stat: Stat, source: string): InjuryAdded {
  const inj = ctx.content.balance.injury
  const ch = characterOf(ctx)
  const lights = ch.injuries.filter((i) => i.grade === 'light')
  let merged = false
  if (grade === 'light' && lights.length >= inj.light_cap) {
    ch.injuries = ch.injuries.filter((i) => i.grade !== 'light')
    grade = 'serious'
    merged = true
  }
  ch.injuries.push({ grade, stat, remaining_min: grade === 'light' ? inj.light.heal_min : 0, source })
  const from = ch.counters.serious_injuries ?? 0
  const to = from + (grade === 'serious' ? 1 : 0)
  ch.counters.serious_injuries = to
  return { grade, stat, merged, serious_total: to, trait_triggers: counterTraitTriggers(ctx, 'serious_injuries', from, to) }
}

// 카운터 획득 특성 중 from < 문턱 ≤ to이고 아직 없는 것(장소별 거르개 where가 있는 특성은 제외)
export function counterTraitTriggers(ctx: RuleContext, counter: string, from: number, to: number): string[] {
  const owned = new Set(characterOf(ctx).traits.map((t) => t.id))
  return ctx.content.list('trait')
    .filter((t) => t.acquire?.type === 'counter' && t.acquire.counter === counter && !t.acquire.where
      && from < t.acquire.threshold && t.acquire.threshold <= to && !owned.has(t.id))
    .map((t) => t.id)
}

// 경상 자연 회복: 유효 진행 min분 × 회복 계수만큼 남은 시간을 줄이고 다 된 경상을 없앤다. 나은 부상을 돌려준다.
// 중상은 자연 회복이 없다(치료소·무료 치료)
export function tickInjuries(ctx: RuleContext, min: number): { grade: InjuryGrade; stat: Stat }[] {
  const ch = characterOf(ctx)
  const step = min * recoveryCoef(ctx)
  const healed: { grade: InjuryGrade; stat: Stat }[] = []
  ch.injuries = ch.injuries.filter((i) => {
    if (i.grade !== 'light') return true
    i.remaining_min = Math.max(0, i.remaining_min - step)
    if (i.remaining_min > 0) return true
    healed.push({ grade: i.grade, stat: i.stat })
    return false
  })
  return healed
}

export const hasSeriousInjury = (ctx: RuleContext) => characterOf(ctx).injuries.some((i) => i.grade === 'serious')
