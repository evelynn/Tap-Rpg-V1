// 생명 연장 F02의 기계 규칙 중 코어가 고를 것(09 §6.2 헌납 유물 기본 선택).
// 선택 결과 자체(연장·유물 헌납·행운 −2·R03)는 사건 데이터의 효과가 이미 적용한다:
// extend_lifespan(상한 balance.inheritance.lifespan.extend_cap) / remove_item chosen_relic /
// life_stat_add luk −2 floor 0 / add_item R03. 흡혈귀 제외는 사건 condition(mutation none)이 본다.
import { basePrice } from '../economy/price'
import type { ItemPort } from '../events/ports'
import { itemName } from '../items/bag'
import type { RuleContext } from '../rules/context'
import { GRADES, SLOTS } from '../schema/index'
import type { ItemInstance } from '../state/inventory'

// 이 장비는 유품으로 등록되어 있다는 경고(09 §6.2, 한 번만 띄운다)
export const RELIC_WARN = '이 유물은 다음 세대에 남길 물건입니다'

function ownedUids(ctx: RuleContext): string[] {
  const inv = ctx.state.inventory
  return [...SLOTS.map((s) => inv.equipped[s]).filter((u): u is string => u !== null), ...inv.bag, ...inv.pending_box]
}

// 헌납 후보: 착용·가방·수령 대기함의 희귀 이상 유물 슬롯 장비(09 §6.2)
export function relicOfferCandidates(ctx: RuleContext, minGrade: (typeof GRADES)[number] = 'rare'): ItemInstance[] {
  const floor = GRADES.indexOf(minGrade)
  const out: ItemInstance[] = []
  for (const uid of ownedUids(ctx)) {
    const inst = ctx.state.item_instances[uid]
    if (!inst || inst.used) continue
    if (ctx.content.get('item', inst.def_id).slot !== 'relic') continue
    if (GRADES.indexOf(inst.grade) < floor) continue
    out.push(inst)
  }
  return out
}

export interface RelicOffer {
  uid: string
  name: string
  note: string // 유품 등록분이면 경고 문구
  registered: boolean
}

// 기본 선택 = 유품 등록이 안 된 것 중 기준 가격이 가장 낮은 것. 모두 등록분이면 가장 싼 것에 경고를 단다
export function defaultRelicOffer(ctx: RuleContext): RelicOffer | null {
  const cands = relicOfferCandidates(ctx)
  if (!cands.length) return null
  const marked = new Set(ctx.state.inventory.relic_designations.map((r) => r.uid))
  const price = (i: ItemInstance) => basePrice(ctx.content, i.def_id, i.grade)
  const cheapest = (list: ItemInstance[]) => list.reduce((a, b) => (price(b) < price(a) ? b : a))
  const free = cands.filter((i) => !marked.has(i.uid))
  const pick = cheapest(free.length ? free : cands)
  const registered = marked.has(pick.uid)
  return { uid: pick.uid, name: itemName(ctx, pick), note: registered ? RELIC_WARN : '', registered }
}

// 사건 포트 갈아끼우기(WorldOptions.ports): 기본 어댑터는 감정가가 가장 높은 유물을 고르므로 09 §6.2와 다르다
export function fateItemPort(base: ItemPort): Pick<ItemPort, 'offeredRelic'> {
  return {
    offeredRelic(w) {
      const ctx: RuleContext = { content: w.content, state: w.state, test: () => false }
      if (!w.state.character) return base.offeredRelic(w)
      const got = defaultRelicOffer(ctx)
      return got ? { uid: got.uid, name: got.name, note: got.note } : null
    },
  }
}
