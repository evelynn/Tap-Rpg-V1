// 가격(01 §9.2·§9.4, 08 §2·§4·§5.2·§9.3·§11): 기준가·평가가·판매가·상점가·소모품가·여관비·치료비·정비비.
// 반올림은 08 규칙(0.5는 올림, roundHalfUp). 사건 특가(L02·L10 류)는 이 식을 거치지 않는다(08 §5.2).
import type { Content, ContentDef } from '../content/index'
import type { SLOTS } from '../schema/index'
import type { ItemInstance } from '../state/inventory'
import { characterOf, type RuleContext } from '../rules/context'
import { roundHalfUp } from '../rules/derived'
import { collectModSources, modValue, type ModSource } from '../rules/modifiers'
import { levelTier, type Grade } from '../items/stats'

const EPS = 1e-9
type Slot = (typeof SLOTS)[number]

// 반올림 전 단계·슬롯·등급 가격(01 §9.2). 전설은 같은 단계 희귀와 같다(08 §2)
export function tierSlotPrice(content: Content, tier: number, slot: Slot, grade: Grade): number {
  const eco = content.balance.economy
  const t = eco.tier_price[tier - 1]
  if (t === undefined) throw new Error(`장비 단계 ${tier}의 가격이 없다`)
  const g = eco.grade_price_mult[grade === 'legendary' ? 'rare' : grade]
  if (g === undefined) throw new Error(`등급 ${grade}의 가격 배수가 없다`)
  return t * eco.slot_price_mult[slot] * g
}

// 반올림 전 기준가(price_override가 있으면 그 값)
export function rawBasePrice(content: Content, defId: string, grade: Grade): number {
  const def = content.get('item', defId)
  return def.price_override ?? tierSlotPrice(content, def.tier, def.slot, grade)
}

// 기준 구매가(01 §9.2 표, 08 §3 구매가 열)
export function basePrice(content: Content, defId: string, grade: Grade): number {
  return roundHalfUp(rawBasePrice(content, defId, grade))
}

// 평가가: 판매하지 않는 장비의 가치 기준(정비비·계승 정산)
export function appraisal(content: Content, defId: string, grade: Grade): number {
  return content.get('item', defId).appraisal_override ?? basePrice(content, defId, grade)
}

// 판매가 = 기준가 × sell_ratio × sell_mult(TA06), 반올림. 판매 불가는 null, 지원 지급품은 0(08 §11)
export function sellPrice(ctx: RuleContext, inst: Pick<ItemInstance, 'def_id' | 'grade' | 'acquired'>, sources?: readonly ModSource[]): number | null {
  const def = ctx.content.get('item', inst.def_id)
  if (!def.sellable) return null
  if (inst.acquired.source === 'aid') return 0
  if (def.sell_price_override !== undefined) return def.sell_price_override
  const mult = modValue(ctx, 'sell_mult', 1, sources)
  return roundHalfUp(rawBasePrice(ctx.content, def.id, inst.grade) * ctx.content.balance.economy.sell_ratio * mult)
}

// 현장 환전가 = 판매가 × field_sell_ratio, 내림(08 §9.3)
export function fieldSellPrice(ctx: RuleContext, inst: Pick<ItemInstance, 'def_id' | 'grade' | 'acquired'>): number {
  return Math.floor((sellPrice(ctx, inst) ?? 0) * ctx.content.balance.economy.bag.field_sell_ratio + EPS)
}

// 상점 가격 배수(08 §5.2): 할인(price_mult 합산)은 −discount_cap까지, 할증(shop_surcharge)은 상한 없이 더한다
export function shopPriceFactor(ctx: RuleContext, sources: readonly ModSource[] = collectModSources(ctx)): number {
  const cap = ctx.content.balance.economy.discount_cap
  const disc = Math.max(-cap, modValue(ctx, 'price_mult', 1, sources) - 1)
  return 1 + disc + modValue(ctx, 'shop_surcharge', 0, sources)
}

// 장비 상점가 = 기준가(반올림 전) × 배수, 반올림
export function itemBuyPrice(ctx: RuleContext, defId: string, grade: Grade, sources?: readonly ModSource[]): number {
  return roundHalfUp(rawBasePrice(ctx.content, defId, grade) * shopPriceFactor(ctx, sources))
}

type Consumable = ContentDef<'consumable'>

// 레벨 기준 단계 회복약 가격(CP08 가격·파산 종료선의 기준, 08 §4·§11). 회복약 = heal_hp이고 단계가 같은 소모품
export function levelTierPotionPrice(content: Content, level: number): number {
  const tier = levelTier(content, level)
  const p = content.list('consumable').find((c) => c.effect === 'heal_hp' && c.tier === tier && c.price.kind === 'fixed')
  if (!p || p.price.kind !== 'fixed') throw new Error(`단계 ${tier}의 회복약 가격이 없다`)
  return p.price.value
}

// 소모품 정가(할인 전). 야영 식량 값은 food_cost_mult(TI08)를 곱한다
export function consumableBasePrice(ctx: RuleContext, c: Consumable, sources?: readonly ModSource[]): number {
  const base = c.price.kind === 'fixed' ? c.price.value : levelTierPotionPrice(ctx.content, characterOf(ctx).level) * c.price.mult
  return c.effect === 'camp_ration' ? base * modValue(ctx, 'food_cost_mult', 1, sources) : base
}

// 소모품 상점가 = 정가 × 상점 배수, 반올림
export function consumableBuyPrice(ctx: RuleContext, c: Consumable, sources: readonly ModSource[] = collectModSources(ctx)): number {
  return roundHalfUp(consumableBasePrice(ctx, c, sources) * shopPriceFactor(ctx, sources))
}

// 여관비는 rules/cost의 innFee가 단일 출처다(휴식·마을 정비·사건 손실이 같은 값을 쓴다)

// 경상·중상 치료비(01 §9.4)
export function treatmentCost(ctx: RuleContext, grade: 'light' | 'serious'): number {
  const c = ctx.content.balance.injury[grade].cost
  return c.base + c.per_level * characterOf(ctx).level
}

// 정비비 = 착용 장비 평가가 합 × maintenance_ratio × maintenance_mult(TI04), 올림(08 §2, 01 §9.4)
export function maintenanceFee(ctx: RuleContext): number {
  const { content, state } = ctx
  let sum = 0
  for (const uid of Object.values(state.inventory.equipped)) {
    if (!uid) continue
    const inst = state.item_instances[uid]!
    sum += appraisal(content, inst.def_id, inst.grade)
  }
  return Math.ceil(sum * content.balance.economy.maintenance_ratio * modValue(ctx, 'maintenance_mult', 1) - EPS)
}
