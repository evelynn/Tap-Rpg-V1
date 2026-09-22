// 상점 진열과 재고(08 §5.1). 판매 선언은 장비·소모품의 shop에만 있다(DS-42).
// 일반 등급 상시 품목은 콘텐츠에서 바로 만들고, 무작위 재고(좋은 등급 good_stock개, pick_group 1개)만 ShopState에 저장한다.
// 재고 갱신은 계절이 바뀐 뒤 처음 마을 정비할 때(출정 중이면 다음 귀환, 08 §5.1). 난수는 loot 흐름(I07).
import { z } from 'zod'
import type { Content, ContentDef } from '../content/index'
import { GRADES } from '../schema/index'
import { defId, s } from '../state/common'
import { characterOf, type RuleContext } from '../rules/context'
import type { Rng } from '../rules/random'
import { familyHasItem, onceKey, rollEffects } from '../items/roll'
import { levelTier, type Grade } from '../items/stats'

const grade = z.enum(GRADES)
const offerSchema = s({ facility: defId, def_id: defId, grade, effects: z.array(defId) })
export type ShopOffer = z.infer<typeof offerSchema>

// 저장 후보(통합자가 SaveBody에 둔다): 재고 계절, 무작위 재고, 이번 계절에 판 장비(같은 계절 재구매 금지, 08 §14)
export const shopStateSchema = s({
  season_key: z.string().nullable(),
  offers: z.array(offerSchema),
  sold: z.array(s({ def_id: defId, grade })),
})
export type ShopState = z.infer<typeof shopStateSchema>

export const emptyShopState = (): ShopState => ({ season_key: null, offers: [], sold: [] })

// 계절 키: 인물마다 유효 진행 season_min분 단위(dismissed_suggestions.season_key와 같은 키)
export function seasonKey(ctx: RuleContext): string {
  const ch = characterOf(ctx)
  return `${ch.uid}:${Math.floor(ch.eff_min / ctx.content.balance.time.season_min + 1e-9)}`
}

type ItemDef = ContentDef<'item'>
type ShopEntry = NonNullable<ItemDef['shop']>[number]

function rankOrder(content: Content, id: string): number {
  return content.get('guild_rank', id).order
}

// 진열 조건: 길드 등급, 레벨 기준 단계 이하(길드 특별 상점 품목 = grades가 있는 항목은 단계 제한 없음),
// 가문에 있는 고유 장비와 이번 생애에 산 고유 장비는 빼고, 지원 기간에는 희귀 이상을 빼고, 저주 장비는 없다
function entryVisible(ctx: RuleContext, def: ItemDef, e: ShopEntry): boolean {
  const { content } = ctx
  const ch = characterOf(ctx)
  if (def.cursed) return false
  if (e.guild_rank_req && rankOrder(content, ch.guild_rank) < rankOrder(content, e.guild_rank_req)) return false
  if (!e.grades && def.tier > levelTier(content, ch.level)) return false
  if (def.unique && (familyHasItem(ctx, def.id) || (ch.counters[onceKey('purchased', def.id)] ?? 0) > 0)) return false
  return true
}

function entries(content: Content, facility: string): [ItemDef, ShopEntry][] {
  const out: [ItemDef, ShopEntry][] = []
  for (const def of content.list('item')) for (const e of def.shop ?? []) if (e.facility === facility) out.push([def, e])
  return out
}

function facilities(content: Content) {
  return content.list('region').flatMap((r) => (r.kind === 'town' ? r.facilities : []))
}

// 재고 갱신: 계절이 바뀌었으면 무작위 재고를 다시 뽑고 판매 기록을 비운다. 갱신했으면 true
export function restockIfNeeded(ctx: RuleContext, rng: Rng, shop: ShopState): boolean {
  const key = seasonKey(ctx)
  if (shop.season_key === key) return false
  const { content } = ctx
  const offers: ShopOffer[] = []
  for (const f of facilities(content)) {
    const list = entries(content, f.id).filter(([def, e]) => entryVisible(ctx, def, e))
    // 좋은 등급 good_stock개: grades 제한이 없는 변동 장비 중 무작위(같은 품목이 두 번 나올 수 있다)
    const goodPool = list.filter(([def, e]) => !e.grades && def.grade_mode === 'rolled')
    for (let i = 0; i < (f.good_stock ?? 0) && goodPool.length; i++) {
      const [def] = rng.pick(goodPool)
      offers.push({ facility: f.id, def_id: def.id, grade: 'good', effects: rollEffects(content, rng, def, 'good') })
    }
    // pick_group: 그룹마다 1개(08 §5.1 길드 2단계)
    const groups = [...new Set(list.map(([, e]) => e.pick_group).filter((g): g is string => g !== undefined))]
    for (const g of groups) {
      const [def, e] = rng.pick(list.filter(([, x]) => x.pick_group === g))
      const gr: Grade = def.fixed_grade ?? rng.pick(e.grades ?? ['common'])
      offers.push({ facility: f.id, def_id: def.id, grade: gr, effects: rollEffects(content, rng, def, gr) })
    }
  }
  shop.season_key = key
  shop.offers = offers
  shop.sold = []
  return true
}

// 지금 보이는 장비 진열: 일반 상시 + grades 고정 항목(그룹 없음) + 무작위 재고. 무작위 재고는 index로 가리킨다
export interface VisibleOffer extends ShopOffer {
  stock_index: number | null // shop.offers 색인(무작위 재고), 상시 품목은 null
}

export function visibleOffers(ctx: RuleContext, shop: ShopState): VisibleOffer[] {
  const { content } = ctx
  const aid = characterOf(ctx).guild_aid.active
  const out: VisibleOffer[] = []
  for (const f of facilities(content)) {
    for (const [def, e] of entries(content, f.id)) {
      if (e.pick_group !== undefined || !entryVisible(ctx, def, e)) continue
      for (const gr of e.grades ?? ['common' as const]) {
        if (def.fixed_grade && def.fixed_grade !== gr) continue
        out.push({ facility: f.id, def_id: def.id, grade: gr, effects: [], stock_index: null })
      }
    }
  }
  shop.offers.forEach((o, i) => {
    const def = content.get('item', o.def_id)
    const e = def.shop?.find((x) => x.facility === o.facility)
    if (e && entryVisible(ctx, def, e)) out.push({ ...o, stock_index: i })
  })
  // 지원 기간: 희귀 이상 구매 불가(08 §11)
  return aid ? out.filter((o) => o.grade === 'common' || o.grade === 'good') : out
}

// 판매 중인 소모품(08 §4): 회복약은 레벨 기준 단계까지, requires 조건(CP08 흡혈귀·밤 귀환)
export function consumablesOnSale(ctx: RuleContext): ContentDef<'consumable'>[] {
  const tier = levelTier(ctx.content, characterOf(ctx).level)
  return ctx.content.list('consumable').filter((c) =>
    c.shop.length > 0 && !(c.effect === 'heal_hp' && (c.tier ?? 0) > tier) && (c.requires === undefined || ctx.test(c.requires)))
}
