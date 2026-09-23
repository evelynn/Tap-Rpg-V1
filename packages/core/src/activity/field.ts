// 현장 판단(04 §7.5), 회복약 자동 사용(04 §7.6), 야영 판단(04 §7.7), 출정 중 몸 상태 진행(09 §7.5).
import { hookSum } from '../ai/index'
import { retreatHpRatio } from '../combat/index'
import { addJournal } from '../journal/index'
import { autoDrinkDue, drinkThirstConsumable, lifeEndDue, thirstFromProgress } from '../life/index'
import { maxHp } from '../rules/derived'
import { characterOf, type RuleContext } from '../rules/context'
import { carryGroupCount, hasSeriousInjury, tickInjuries, usePotions } from '../recovery/index'
import type { World } from '../sim/world'
import { addPendingSec, currentSortie, sortieElapsedMin } from './sortie'

export type FieldDecision = 'continue' | 'camp' | 'return'

// 피로 귀환 기준(01 §7.1)
export const fatigueLimit = (ctx: RuleContext): number => ctx.content.get('attitude', ctx.state.policies.attitude).return_fatigue

// 야영 식량(carry_group)이 있는가. 식량 묶음은 야영 회복 소모품의 carry_group이다
export function rationGroup(ctx: RuleContext): string | null {
  const c = ctx.content.list('consumable').find((x) => x.effect === 'camp_ration')
  return c?.carry_group ?? null
}

export function hasRation(ctx: RuleContext): boolean {
  const g = rationGroup(ctx)
  return g !== null && carryGroupCount(ctx, g) > 0
}

// 야영 가능 조건(04 §7.7). needRation = 체력 목적 야영
export function canCamp(world: World, needRation: boolean): boolean {
  const s = world.state.current_activity.sortie
  if (!s || s.activity === 'dungeon') return false
  const cfg = world.content.balance.activity_ai.camp
  const extra = hookSum(world, 'camp_extra', (v) => v as number)
  if (s.camps >= cfg.max_per_sortie + extra) return false
  if (sortieElapsedMin(world) >= cfg.max_elapsed_min) return false
  return !needRation || hasRation(world)
}

// 회복약 자동 사용. 마신 병 수를 출정에 적고, 연출 시간(한 병 3초, 04 §7.6)은 다음 행동으로 넘긴다
export function autoPotions(world: World): string[] {
  const used = usePotions(world, retreatHpRatio(world))
  const s = world.state.current_activity.sortie
  if (s) s.potions_used += used.length
  addPendingSec(world, used.length * world.content.balance.actions.potion_sec)
  return used
}

// CP08 자동 음용(09 §7.5, 08): 갈증이 기준을 넘으면 한 병 마신다. 마셨으면 true
export function autoDrink(world: World, where: 'sortie' | 'town'): boolean {
  if (!autoDrinkDue(world, where)) return false
  const r = drinkThirstConsumable(world)
  for (const d of r.journal) addJournal(world, d)
  return r.drank
}

// 출정 행동 1개가 끝날 때 몸 상태를 흘린다: 부상 시간 + 갈증(09 §7.5 "출정 중에만 오른다").
// 마을 행동은 tickInjuries만 부른다
export function tickSortieBody(world: World, minutes: number): void {
  tickInjuries(world, minutes)
  for (const d of thirstFromProgress(world, minutes).journal) addJournal(world, d)
}

// 이번 출정의 목표를 채웠는가(04 §7.2·§7.3, 07 §3.4 안전 상한)
export function goalReached(world: World): boolean {
  const s = currentSortie(world)
  const cap = world.content.balance.activity_ai.hunt
  if ('target_encounters' in s.plan) {
    return s.progress >= s.plan.target_encounters || s.progress >= s.plan.safety_cap || sortieElapsedMin(world) >= cap.safety_cap_min
  }
  if ('scenes' in s.plan) return s.progress >= s.plan.scenes
  return false // 던전은 07 §5.5 다음 방 진입 판단과 §5.6 관문 판단이 끝을 정한다
}

export interface FieldOptions {
  returnCommand?: boolean // 즉시 귀환 명령(사건 end_sortie 포함)
  // 던전: 07 §5.5 다음 방 진입 판단. 04 §2.3 D39 순서대로 회복약·사건 뒤에 재야 해서 지연 평가다
  nextRoomOk?: () => boolean
}

// 04 §7.5 현장 판단. 회복약 자동 사용과 CP08 자동 음용은 이 안에서 한다
export function fieldJudgment(world: World, opts: FieldOptions = {}): FieldDecision {
  const ch = characterOf(world)
  if (hasSeriousInjury(world)) return 'return'
  if (lifeEndDue(world)) return 'return' // 새 출정을 잡지 않고 다음 판단 지점에서 귀환한다(04 §11, 09 §3.1)
  autoPotions(world)
  autoDrink(world, 'sortie')
  const att = world.content.get('attitude', world.state.policies.attitude)
  if (ch.hp <= maxHp(world) * retreatHpRatio(world)) {
    return att.retreat_camp && canCamp(world, true) ? 'camp' : 'return'
  }
  if (ch.fatigue >= fatigueLimit(world)) return canCamp(world, false) ? 'camp' : 'return'
  if (opts.returnCommand) return 'return'
  if (goalReached(world)) return 'return'
  if (world.state.current_activity.sortie?.activity === 'dungeon' && opts.nextRoomOk && !opts.nextRoomOk()) return 'return'
  return 'continue'
}
