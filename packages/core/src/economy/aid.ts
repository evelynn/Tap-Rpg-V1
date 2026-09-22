// 파산과 길드 지원(08 §11, 01 §9.6). S06 사건의 발화·문장은 사건 규칙 몫이고, 여기서는 조건·지급·종료선만 계산한다.
import { SLOTS } from '../schema/index'
import { characterOf, type RuleContext } from '../rules/context'
import { createItemInstance } from '../sim/create'
import { ageAt } from '../time/index'
import { levelTier } from '../items/stats'
import { innFee } from '../rules/cost'
import { levelTierPotionPrice } from './price'

const AID_COUNTER = 'guild_aids' // num counter.guild_aids(TA06 획득 조건)

// 회복약(heal_hp 소모품) 소지 수
export function potionCount(ctx: RuleContext): number {
  const inv = ctx.state.inventory.consumables
  return ctx.content.list('consumable').filter((c) => c.effect === 'heal_hp').reduce((s, c) => s + (inv[c.id] ?? 0), 0)
}

// 파산(01 §9.6): 소지금 < coins_lt 이고, 착용 무기 단계가 레벨 기준보다 gap 이상 낮거나 회복약이 or_potions_eq개
export function isBankrupt(ctx: RuleContext): boolean {
  const { content, state } = ctx
  const bk = content.balance.economy.bankruptcy
  const ch = characterOf(ctx)
  if (ch.coins >= bk.coins_lt) return false
  const w = state.inventory.equipped.weapon
  const wTier = w ? content.get('item', state.item_instances[w]!.def_id).tier : 0
  return levelTier(content, ch.level) - wTier >= bk.weapon_tier_gap_gte || potionCount(ctx) === bk.or_potions_eq
}

// 지원 종료선 = max(min, inn_mult × 기본 여관비 + potion_mult × 레벨 기준 단계 회복약 가격)(08 §11)
export function aidEndCoins(ctx: RuleContext): number {
  const e = ctx.content.balance.economy.aid.end_coins
  return Math.max(e.min, e.inn_mult * innFee(ctx, false) + e.potion_mult * levelTierPotionPrice(ctx.content, characterOf(ctx).level))
}

// 지원 시작: 빈 무기·방어구 칸에 지원 장비 지급(판매가 0), 지원 누계 +1. 회복약 지급은 데이터 필드가 없어 하지 않는다
export function startGuildAid(ctx: RuleContext): string[] {
  const { content, state } = ctx
  const ch = characterOf(ctx)
  ch.guild_aid = { active: true, started_eff_min: ch.eff_min, recovered: false }
  ch.counters[AID_COUNTER] = (ch.counters[AID_COUNTER] ?? 0) + 1
  const issued: string[] = []
  // uid 발급 순서가 record 키 순서에 매이지 않도록 SLOTS 순서로 돈다(ARCHITECTURE §3)
  for (const s of SLOTS) {
    const id = content.balance.economy.aid.issue_items[s]
    if (id === undefined || state.inventory.equipped[s]) continue
    const inst = createItemInstance(content, state, id, undefined, {
      gen: ch.generation, char_uid: ch.uid, age: ageAt(ch.eff_min, content.balance.time), location: ch.location, source: 'aid',
    })
    state.inventory.equipped[s] = inst.uid
    issued.push(inst.uid)
  }
  return issued
}

// 지원 종료 검사: 소지금이 종료선 이상이면 끝낸다. 끝냈으면 true
export function endGuildAidIfDue(ctx: RuleContext): boolean {
  const ch = characterOf(ctx)
  if (!ch.guild_aid.active || ch.coins < aidEndCoins(ctx)) return false
  ch.guild_aid = { ...ch.guild_aid, active: false, recovered: true }
  return true
}
