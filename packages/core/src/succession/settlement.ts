// 재산 정산(12 §6). 실물로 넘어가는 것은 유품뿐이고, 나머지는 판매가를 모아 비율·상한으로 자른다.
import { sellPrice } from '../economy/price'
import { characterOf, type RuleContext } from '../rules/context'
import { GRADES, type END_KINDS } from '../schema/index'
import type { ItemInstance } from '../state/inventory'
import { ownedItems } from './relics'

type EndKind = (typeof END_KINDS)[number]

export interface Settlement {
  coins: number // 소지금
  soldValue: number // 유품 아닌 일반·좋은 장비 판매가 합
  total: number // 정산 총액
  ratio: number
  transferred: number // 이전액(상한 적용)
  capped: boolean
  keepsakes: ItemInstance[] // 기념품으로 바뀌는 희귀 이상·고유 장비
}

// 희귀 이상 또는 고유 장비는 정산하지 않고 기념품이 된다(12 §6.1)
function isKeepsake(ctx: RuleContext, inst: ItemInstance): boolean {
  const def = ctx.content.get('item', inst.def_id)
  return def.unique || GRADES.indexOf(inst.grade) >= GRADES.indexOf('rare')
}

// 정산: 소모품은 제외하고(08 규칙), 잠금·착용도 대상이다. TA06 판매가 보정은 적용하지 않는다(12 §6.1)
export function settle(ctx: RuleContext, kind: EndKind, passedUids: readonly string[]): Settlement {
  const inh = ctx.content.balance.inheritance
  const ch = characterOf(ctx)
  let soldValue = 0
  const keepsakes: ItemInstance[] = []
  for (const inst of ownedItems(ctx)) {
    if (passedUids.includes(inst.uid)) continue
    if (isKeepsake(ctx, inst)) {
      keepsakes.push(inst)
      continue
    }
    soldValue += sellPrice(ctx, inst, []) ?? 0
  }
  const total = ch.coins + soldValue
  const ratio = inh.coin_ratio[kind] ?? 0
  const raw = Math.floor(total * ratio + 1e-9)
  const transferred = Math.min(raw, inh.coin_cap)
  return { coins: ch.coins, soldValue, total, ratio, transferred, capped: raw > inh.coin_cap, keepsakes }
}

// 기념품 선반에 올린다(12 §6.1: 성능 없음, 장착·판매·재전환 불가 → 인스턴스는 지운다)
export function storeKeepsakes(ctx: RuleContext, list: readonly ItemInstance[]): void {
  const fam = ctx.state.family
  for (const inst of list) {
    const def = ctx.content.get('item', inst.def_id)
    fam.keepsakes.push({
      name: (inst.prefix ? `${inst.prefix} ` : '') + def.name,
      from_def_id: def.id,
      gen: fam.generation,
      text: inst.history.at(-1)?.text ?? def.description ?? '',
    })
  }
}
