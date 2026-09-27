// 가방·수령 대기함·현장 정리(08 §9.1·§9.3·§9.4), 수동 장착·잠금(08 §8.1), 교체 제안(08 §8.2), 출정 중 획득 장비 판단(08 §8).
import type { JournalDraft } from '../state/journal'
import { GRADES } from '../schema/index'
import type { ItemInstance } from '../state/inventory'
import { characterOf, type RuleContext } from '../rules/context'
import { renderTemplate } from '../text/index'
import { earnCoins } from '../economy/earn'
import { fieldSellPrice, sellPrice } from '../economy/price'
import { ageAt } from '../time/index'
import type { Rng } from '../rules/random'
import { improvement, worthSwapping, type EvalOptions, type Slot } from './eval'
import { materializeItem, NAMED_PREFIX, replaceUnique, rollEffects, rollGrade } from './roll'
import type { Grade } from './stats'

const LINE_PICKUP_EQUIP = '주운 {item:을/를} 바로 찼다.' // 08 §8
const LINE_SUGGEST = '{item:이/가} 더 나아 보인다.' // 08 §8.2
const LINE_FIELD_SOLD = '가방이 차서 {count}개를 현장에서 팔았다.' // 08 §9.3
const LINE_REPLACED = '대신 {item:을/를} 받았다.' // 08 §9.5
const LINE_REPLACED_DETAIL = '같은 물건은 이미 집에 있었다.'
const LINE_GAIN = '{item:을/를} 손에 넣었다' // 14 §5.1 희귀 이상 획득

export const itemName = (ctx: RuleContext, inst: Pick<ItemInstance, 'def_id' | 'prefix'>) => {
  const name = ctx.content.get('item', inst.def_id).name
  return inst.prefix ? `${inst.prefix} ${name}` : name
}

const instOf = (ctx: RuleContext, uid: string) => {
  const i = ctx.state.item_instances[uid]
  if (!i) throw new Error(`장비 인스턴스가 없다: ${uid}`)
  return i
}

export function isEquipped(ctx: RuleContext, uid: string): boolean {
  return Object.values(ctx.state.inventory.equipped).includes(uid)
}

// 보호 대상(08 §9.1): 착용·잠금·유품 지정·고유·계승받은 유품
export function isProtected(ctx: RuleContext, uid: string): boolean {
  const inst = instOf(ctx, uid)
  return isEquipped(ctx, uid) || inst.locked || ctx.state.inventory.relic_designations.some((r) => r.uid === uid)
    || ctx.content.get('item', inst.def_id).unique || inst.inherited_from_gen !== undefined
}

// 인스턴스를 가방·대기함에서 빼고 동전을 준다. 일반·좋은은 기록을 지우고, 희귀 이상·고유는 기록을 남긴다(08 §13.3)
export function removeSold(ctx: RuleContext, uid: string): void {
  const inv = ctx.state.inventory
  inv.bag = inv.bag.filter((u) => u !== uid)
  inv.pending_box = inv.pending_box.filter((u) => u !== uid)
  inv.equip_suggestions = inv.equip_suggestions.filter((sg) => !('uid' in sg.source && sg.source.uid === uid))
  if (inv.equip_orders) inv.equip_orders = inv.equip_orders.filter((o) => o.uid !== uid)
  const inst = instOf(ctx, uid)
  if ((inst.grade === 'common' || inst.grade === 'good') && !ctx.content.get('item', inst.def_id).unique) delete ctx.state.item_instances[uid]
}

// 출정 중 새 장비를 가방에 넣는다(08 §9.3). 가방이 차면 판매가가 가장 낮은 비보호 장비 1개를 현장 환전하고,
// 모두 보호 대상이면 일반·좋은은 현장 환전, 희귀·고유는 수령 대기함. 현장 환전한 수를 돌려준다(기록은 출정마다 묶음)
export function stowLoot(ctx: RuleContext, uid: string): { fieldSold: number } {
  const inv = ctx.state.inventory
  const b = ctx.content.balance
  if (inv.bag.length < b.stats.bag_slots) {
    inv.bag.push(uid)
    return { fieldSold: 0 }
  }
  const pool = [uid, ...inv.bag].filter((u) => !isProtected(ctx, u))
  if (pool.length) {
    // 같은 값이면 먼저 든 것(새 장비가 맨 앞)
    const victim = pool.reduce((a, u) => (fieldSellPrice(ctx, instOf(ctx, u)) < fieldSellPrice(ctx, instOf(ctx, a)) ? u : a))
    earnCoins(ctx, fieldSellPrice(ctx, instOf(ctx, victim)))
    if (victim !== uid) inv.bag.push(uid)
    removeSold(ctx, victim)
    return { fieldSold: 1 }
  }
  const inst = instOf(ctx, uid)
  if (inst.grade === 'common' || inst.grade === 'good') {
    earnCoins(ctx, fieldSellPrice(ctx, inst))
    removeSold(ctx, uid)
    return { fieldSold: 1 }
  }
  putPending(ctx, uid)
  return { fieldSold: 0 }
}

export function fieldSoldLine(count: number): JournalDraft {
  return { tag: 'gear', line: renderTemplate(LINE_FIELD_SOLD, { count }), bundle_count: count }
}

// 수령 대기함(08 §9.4): 용량 10개. 가득 차면 가장 오래된 희귀(보호 대상 제외)를 판매가로 환전한다.
// 희귀 후보가 없으면 정원을 지키려고 가장 오래된 비보호 장비를 환전한다(모두 보호 대상이면 넘칠 수 있다)
export function putPending(ctx: RuleContext, uid: string): void {
  const inv = ctx.state.inventory
  if (inv.pending_box.length >= ctx.content.balance.economy.bag.pending_box_cap) {
    const free = inv.pending_box.filter((u) => !isProtected(ctx, u) && sellPrice(ctx, instOf(ctx, u)) !== null)
    const rareIdx = GRADES.indexOf('rare')
    const old = free.find((u) => GRADES.indexOf(instOf(ctx, u).grade) >= rareIdx) ?? free[0]
    if (old !== undefined) {
      earnCoins(ctx, sellPrice(ctx, instOf(ctx, old)) ?? 0)
      removeSold(ctx, old)
    }
  }
  inv.pending_box.push(uid)
}

// 마을: 가방에 빈칸이 있으면 대기함의 오래된 것부터 옮긴다
export function movePendingToBag(ctx: RuleContext): void {
  const inv = ctx.state.inventory
  while (inv.pending_box.length && inv.bag.length < ctx.content.balance.stats.bag_slots) inv.bag.push(inv.pending_box.shift()!)
}

// 장착: 이전 장비는 가방으로. 가방·대기함에 있던 장비면 거기서 뺀다
export function equipItem(ctx: RuleContext, uid: string): string | null {
  const inv = ctx.state.inventory
  const slot = ctx.content.get('item', instOf(ctx, uid).def_id).slot
  const prev = inv.equipped[slot]
  inv.bag = inv.bag.filter((u) => u !== uid)
  inv.pending_box = inv.pending_box.filter((u) => u !== uid)
  inv.equipped[slot] = uid
  if (prev) inv.bag.push(prev)
  inv.equip_suggestions = inv.equip_suggestions.filter((sg) => sg.slot !== slot)
  return prev
}

// 사용자 장착(08 §8.1): 자동 잠금. 저주 장비는 확인한 뒤에만
export function equipManual(ctx: RuleContext, uid: string, confirmCursed = false): void {
  const inst = instOf(ctx, uid)
  if (ctx.content.get('item', inst.def_id).cursed && !confirmCursed) throw new Error('저주 장비는 사용자 확인 뒤에만 장착한다')
  equipItem(ctx, uid)
  inst.locked = true
  inst.lock_source = 'manual_equip'
}

// 사용자 해제: 가방으로. 빈 슬롯은 다음 정비가 채운다
export function unequip(ctx: RuleContext, slot: Slot): void {
  const inv = ctx.state.inventory
  const uid = inv.equipped[slot]
  if (!uid) return
  inv.equipped[slot] = null
  inv.bag.push(uid)
}

const slotOf = (ctx: RuleContext, uid: string): Slot => ctx.content.get('item', instOf(ctx, uid).def_id).slot

// 출정 중 장착·해제 예약(03 §5.3.1). 같은 슬롯의 이전 예약을 바꾼다. 저주 장비는 확인한 뒤에만 예약한다
export function orderEquip(ctx: RuleContext, uid: string, op: 'equip' | 'unequip', confirmCursed = false): void {
  if (op === 'equip' && ctx.content.get('item', instOf(ctx, uid).def_id).cursed && !confirmCursed) throw new Error('저주 장비는 사용자 확인 뒤에만 장착한다')
  const inv = ctx.state.inventory
  const slot = slotOf(ctx, uid)
  inv.equip_orders = [...(inv.equip_orders ?? []).filter((o) => slotOf(ctx, o.uid) !== slot), { uid, op }]
}

export function cancelEquipOrder(ctx: RuleContext, uid: string): void {
  const inv = ctx.state.inventory
  if (inv.equip_orders) inv.equip_orders = inv.equip_orders.filter((o) => o.uid !== uid)
}

// 마을 도착 때 예약을 적용한다. 그사이 입었거나 가방에 없거나, 해제할 가방 칸이 없으면 버린다
export function applyEquipOrders(ctx: RuleContext): void {
  const inv = ctx.state.inventory
  for (const o of inv.equip_orders ?? []) {
    if (!ctx.state.item_instances[o.uid]) continue
    if (o.op === 'equip' && (inv.bag.includes(o.uid) || inv.pending_box.includes(o.uid))) equipManual(ctx, o.uid, true)
    else if (o.op === 'unequip' && isEquipped(ctx, o.uid) && inv.bag.length < ctx.content.balance.stats.bag_slots) unequip(ctx, slotOf(ctx, o.uid))
  }
  inv.equip_orders = []
}

export function setLock(ctx: RuleContext, uid: string, locked: boolean): void {
  const inst = instOf(ctx, uid)
  inst.locked = locked
  if (locked) inst.lock_source = 'user'
  else delete inst.lock_source
}

// 잠긴 착용 장비의 슬롯(자동 교체 제외)
export function lockedSlots(ctx: RuleContext): Set<Slot> {
  const out = new Set<Slot>()
  for (const [slot, uid] of Object.entries(ctx.state.inventory.equipped) as [Slot, string | null][]) {
    if (uid && instOf(ctx, uid).locked) out.add(slot)
  }
  return out
}

type Suggestion = RuleContext['state']['inventory']['equip_suggestions'][number]

// 교체 제안 추가(08 §8.2): 슬롯당 1건(새 것으로 바꿈). 새로 생기면 기록 1회
export function suggest(ctx: RuleContext, sg: Suggestion, name: string): JournalDraft | null {
  const inv = ctx.state.inventory
  const old = inv.equip_suggestions.find((x) => x.slot === sg.slot)
  inv.equip_suggestions = [...inv.equip_suggestions.filter((x) => x.slot !== sg.slot), sg]
  if (old && JSON.stringify(old.source) === JSON.stringify(sg.source)) return null
  return { tag: 'gear', line: renderTemplate(LINE_SUGGEST, { item: name }) }
}

// 제안 무시: 같은 정의·등급은 그 계절 동안 다시 제안하지 않는다
export function dismissSuggestion(ctx: RuleContext, slot: Slot, seasonKey: string): void {
  const inv = ctx.state.inventory
  const sg = inv.equip_suggestions.find((x) => x.slot === slot)
  if (!sg) return
  const it = 'uid' in sg.source ? instOf(ctx, sg.source.uid) : { def_id: sg.source.shop_def_id, grade: sg.source.grade }
  inv.dismissed_suggestions.push({ def_id: it.def_id, grade: it.grade, season_key: seasonKey })
  inv.equip_suggestions = inv.equip_suggestions.filter((x) => x !== sg)
}

// 가방·대기함 장비 제안 수락(마을): 장착 + 잠금. 상점 제안 수락은 다음 마을 정비의 교체 단계가 처리한다(economy/town)
export function acceptSuggestion(ctx: RuleContext, slot: Slot): boolean {
  const sg = ctx.state.inventory.equip_suggestions.find((x) => x.slot === slot)
  if (!sg || !('uid' in sg.source)) return false
  equipManual(ctx, sg.source.uid, true)
  return true
}

// 출정 중 획득 장비의 판단 지점 처리(08 §8): 개선이면 비용 없이 장착(자동 교체 켬), 끔이면 제안.
// 잠긴 슬롯·저주 장비는 건드리지 않는다. 벗은 장비는 가방으로(가방이 차면 현장 정리)
export function considerPickup(ctx: RuleContext, uid: string, opts: EvalOptions = {}): { equipped: boolean; fieldSold: number; journal: JournalDraft[] } {
  const inst = instOf(ctx, uid)
  const def = ctx.content.get('item', inst.def_id)
  const none = { equipped: false, fieldSold: 0, journal: [] as JournalDraft[] }
  if (def.cursed || lockedSlots(ctx).has(def.slot)) return none
  const imp = improvement(ctx, inst, opts)
  if (!worthSwapping(ctx, inst, imp)) return none
  const name = itemName(ctx, inst)
  if (!ctx.state.policies.auto_equip) {
    const d = suggest(ctx, { slot: def.slot, source: { uid }, improvement: imp.value, reason: imp.reason, created_eff_min: characterOf(ctx).eff_min }, name)
    return { ...none, journal: d ? [d] : [] }
  }
  const inv = ctx.state.inventory
  inv.bag = inv.bag.filter((u) => u !== uid)
  inv.pending_box = inv.pending_box.filter((u) => u !== uid)
  const prev = inv.equipped[def.slot]
  inv.equipped[def.slot] = uid
  const r = prev ? stowLoot(ctx, prev) : { fieldSold: 0 }
  return { equipped: true, fieldSold: r.fieldSold, journal: [{ tag: 'gear', line: renderTemplate(LINE_PICKUP_EQUIP, { item: name }), refs: { item_uid: uid } }] }
}


// 희귀 이상·고유 장비 획득(14 §2 주요, 18 §4.1 rare_gain, 03 §2.5 8초·D76). 줍기 기록이 이미 그 장비를 말하면
// (바로 찼다) 그 기록을 주요 rare_gain으로 올리고, 가방에만 들어갔으면 획득 한 줄을 더한다. 그 밖은 그대로 돌려준다
export function markRareGain(ctx: RuleContext, uid: string, journal: JournalDraft[]): JournalDraft[] {
  const inst = ctx.state.item_instances[uid]
  if (!inst) return journal
  const rare = inst.grade === 'rare' || inst.grade === 'legendary' || ctx.content.get('item', inst.def_id).unique
  if (!rare) return journal
  const said = journal.find((d) => d.refs?.item_uid === uid)
  if (said) return journal.map((d) => (d === said ? { ...d, importance: 'major' as const, sub: 'rare_gain' as const } : d))
  const inv = ctx.state.inventory
  const kept = inv.bag.includes(uid) || inv.pending_box.includes(uid) || Object.values(inv.equipped).includes(uid)
  if (!kept) return journal
  return [...journal, { tag: 'gear', importance: 'major', sub: 'rare_gain', line: renderTemplate(LINE_GAIN, { item: itemName(ctx, inst) }), refs: { item_uid: uid } }]
}

// 지정 장비 지급(사건 add_item·관문 보상 등): 등급이 없으면 변동 장비는 table로 굴린다. 고유 장비는 가문에 있으면 대체(08 §9.5).
// reroll 대체(J05 류)는 부르는 쪽 굴림에 맡기고 null. 넣을 곳: 가방(차면 현장 정리) 또는 수령 대기함
export function grantItem(
  ctx: RuleContext,
  rng: Rng,
  p: { item_id: string; grade?: Grade; table?: string; to: 'bag' | 'pending_box' | 'bag_or_pending'; source: string },
): { uid: string; replaced_from?: string } | null {
  const def = ctx.content.get('item', p.item_id)
  let grade: Grade
  let named = false
  if (p.grade ?? def.fixed_grade) grade = (p.grade ?? def.fixed_grade)!
  else if (p.table) ({ grade, named } = rollGrade(ctx, rng, p.table))
  else throw new Error(`장비 '${def.id}' 지급에 등급도 등급 표도 없다`)
  const spec = replaceUnique(ctx, rng, {
    def_id: def.id, grade, effects: rollEffects(ctx.content, rng, def, grade, named), ...(named ? { prefix: NAMED_PREFIX } : {}),
  })
  if (!spec) return null
  const ch = characterOf(ctx)
  const inst = materializeItem(ctx, spec, {
    gen: ch.generation, char_uid: ch.uid, age: ageAt(ch.eff_min, ctx.content.balance.time), location: ch.location, source: p.source,
  })
  if (p.to === 'pending_box') putPending(ctx, inst.uid)
  else if (p.to === 'bag' || ctx.state.inventory.bag.length < ctx.content.balance.stats.bag_slots) stowLoot(ctx, inst.uid)
  else putPending(ctx, inst.uid)
  return { uid: inst.uid, ...(spec.replaced_from ? { replaced_from: spec.replaced_from } : {}) }
}

// 고유 장비 대체 기록(08 §9.5)
export function replacedLine(ctx: RuleContext, uid: string): JournalDraft {
  return { tag: 'gear', line: renderTemplate(LINE_REPLACED, { item: itemName(ctx, ctx.state.item_instances[uid]!) }), detail: LINE_REPLACED_DETAIL, refs: { item_uid: uid } }
}
