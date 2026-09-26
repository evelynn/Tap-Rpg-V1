// 유품(12 §5): 등록·자동 선택 점수·이전·잠재 상태. 잠재 상태 계산의 단일 출처는 items/stats(itemStats·dormantDef)이고,
// 여기서는 어떤 장비가 넘어가는지만 정한다.
import { characterOf, type RuleContext } from '../rules/context'
import { SLOTS, type END_KINDS } from '../schema/index'
import type { ItemInstance } from '../state/inventory'
import type { JournalDraft } from '../state/journal'
import { itemName } from '../items/bag'
import { isDormant } from '../items/stats'
import { RELIC_RETURN, RELIC_RETURN_DETAIL, textLine } from '../life/text'
import { renderTemplate } from '../text/index'
import { ageAt } from '../time/index'

type EndKind = (typeof END_KINDS)[number]

// 정산·유품 대상이 되는 소지 장비(착용·가방·수령 대기함). 순회 순서는 SLOTS 고정(ARCHITECTURE §3)
export function ownedItems(ctx: RuleContext): ItemInstance[] {
  const inv = ctx.state.inventory
  const uids = [...SLOTS.map((s) => inv.equipped[s]).filter((u): u is string => u !== null), ...inv.bag, ...inv.pending_box]
  return uids.map((u) => ctx.state.item_instances[u]).filter((i): i is ItemInstance => i !== undefined)
}

// 사연 점수(12 §5.3): 착용 누적 분 ÷ 60(상한 5) + 이 장비가 등장한 [장비]·[중요]·[인연] 기록 수(상한 3).
// 저장에 착용 누적 분이 없어 착용 중인 장비는 획득 시점부터 지금까지로 본다(T11 후보)
const STORY_TAGS = ['gear', 'important', 'bond'] as const

function wornMinutes(ctx: RuleContext, inst: ItemInstance): number {
  const equipped = SLOTS.some((s) => ctx.state.inventory.equipped[s] === inst.uid)
  if (!equipped) return 0
  const time = ctx.content.balance.time
  const ch = characterOf(ctx)
  return Math.max(0, ch.eff_min - (inst.acquired.age - time.start_age) * time.min_per_year)
}

export function relicScore(ctx: RuleContext, inst: ItemInstance): number {
  const rs = ctx.content.balance.inheritance.relic_score
  const def = ctx.content.get('item', inst.def_id)
  const story = ctx.state.journal.filter((e) => e.refs?.item_uid === inst.uid && (STORY_TAGS as readonly string[]).includes(e.tag)).length
  return (rs.grade[inst.grade] ?? 0)
    + (def.unique ? rs.unique_add : 0)
    + def.tier * rs.tier_mult
    + Math.min(rs.story.worn_cap, wornMinutes(ctx, inst) / rs.story.worn_min_div)
    + Math.min(rs.story.record_cap, story)
}

// 자동 선택(12 §5.3): 점수 내림차순, 동점이면 tie_slot_order → 먼저 얻은 것. 저주·이미 고른 것은 제외
export function autoPickRelics(ctx: RuleContext, count: number, exclude: readonly string[]): ItemInstance[] {
  const order = ctx.content.balance.inheritance.relic_score.tie_slot_order
  const cands = ownedItems(ctx).filter((i) => !exclude.includes(i.uid) && !ctx.content.get('item', i.def_id).cursed)
  const scored = cands.map((i) => ({ i, score: relicScore(ctx, i) }))
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const sa = order.indexOf(ctx.content.get('item', a.i.def_id).slot)
    const sb = order.indexOf(ctx.content.get('item', b.i.def_id).slot)
    if (sa !== sb) return sa - sb
    return a.i.uid.localeCompare(b.i.uid) // uid 일련번호 = 획득 순서
  })
  return scored.slice(0, Math.max(0, count)).map((s) => s.i)
}

// 생애 종료 때 넘길 유품(12 §5.2): 등록 1·2위 우선, 모자라면 자동 선택. 개수는 종료 종류별 상한
export function relicsToPass(ctx: RuleContext, kind: EndKind): ItemInstance[] {
  const max = ctx.content.balance.inheritance.relics_passed[kind] ?? 0
  const marked = [...ctx.state.inventory.relic_designations].sort((a, b) => a.priority - b.priority)
  const out: ItemInstance[] = []
  for (const d of marked) {
    if (out.length >= max) break
    const inst = ctx.state.item_instances[d.uid]
    if (inst && !out.includes(inst)) out.push(inst)
  }
  if (out.length < max) out.push(...autoPickRelics(ctx, max - out.length, out.map((i) => i.uid)))
  return out
}

// 유품 등록(12 §5.1). 마을에서만 바꿀 수 있고 최대 2개다
export function designateRelic(ctx: RuleContext, uid: string, priority: 1 | 2): boolean {
  const inv = ctx.state.inventory
  if (!ctx.state.item_instances[uid]) return false
  const max = ctx.content.balance.inheritance.relic_designations_max
  const kept = inv.relic_designations.filter((r) => r.uid !== uid && r.priority !== priority)
  kept.push({ uid, priority })
  inv.relic_designations = kept.sort((a, b) => a.priority - b.priority).slice(0, max)
  return true
}

// 유품 등록 해제(03 §5.3.1)
export function undesignateRelic(ctx: RuleContext, uid: string): void {
  const inv = ctx.state.inventory
  inv.relic_designations = inv.relic_designations.filter((r) => r.uid !== uid)
}

export interface RelicTransfer {
  uids: string[]
  journal: JournalDraft[]
}

// 후계자 가방으로 옮긴다: 잠재 상태 표식(inherited_from_gen)과 이력 한 줄을 남긴다(12 §5.5).
// 변이 조건부 효과는 수정자의 when이 거짓이 되어 저절로 사라진다(12 §5.4, 09 §7.10)
export function transferRelics(ctx: RuleContext, items: readonly ItemInstance[], fromGen: number, parentName: string): RelicTransfer {
  const journal: JournalDraft[] = []
  const uids: string[] = []
  const inv = ctx.state.inventory
  for (const inst of items) {
    inst.inherited_from_gen = fromGen
    inst.locked = false
    delete inst.lock_source
    inst.history.push({
      gen: fromGen,
      char_name: parentName,
      age: inst.acquired.age,
      kind: 'inherited',
      text: renderTemplate('{name:이/가} 남겼다', { name: parentName }),
    })
    if (!inv.bag.includes(inst.uid)) inv.bag.push(inst.uid)
    uids.push(inst.uid)
    journal.push({ tag: 'succession', line: renderTemplate('{item:을/를} 물려받았다', { item: itemName(ctx, inst) }), refs: { item_uid: inst.uid } })
  }
  return { uids, journal }
}

// 잠재 상태가 열린 유품(12 §5.5 개방 기록). 레벨이 오른 자리에서 부른다
export function dormantOpened(ctx: RuleContext, beforeLevel: number, afterLevel: number): JournalDraft[] {
  const out: JournalDraft[] = []
  for (const inst of ownedItems(ctx)) {
    if (!isDormant(ctx.content, inst, beforeLevel) || isDormant(ctx.content, inst, afterLevel)) continue
    inst.history.push({
      gen: inst.inherited_from_gen ?? 0,
      char_name: characterOf(ctx).name,
      age: currentAgeOf(ctx),
      kind: 'potential_opened',
      text: '손에 맞기 시작했다',
    })
    out.push({ tag: 'gear', line: renderTemplate('{item:이/가} 손에 맞기 시작했다', { item: itemName(ctx, inst) }), refs: { item_uid: inst.uid } })
  }
  return out
}

// 유품이 돌아오는 순간(12 §5.6, D76): 물려받아 착용 중인 유품 가운데 이 생애에 아직 돌아오지 않은 것 하나.
// 여럿이면 SLOTS 순서가 아니라 5.3절 동점 순서(무기 > 유물 > 장신구 > 방어구). 한 번 남긴 유품은 카운터로 막는다
const RETURN_ORDER = ['weapon', 'relic', 'accessory', 'armor'] as const
const RETURN_COUNTER = 'relic_return.'

export function relicReturn(ctx: RuleContext, place: string): JournalDraft | null {
  const ch = characterOf(ctx)
  const inv = ctx.state.inventory
  for (const slot of RETURN_ORDER) {
    const uid = inv.equipped[slot]
    const inst = uid ? ctx.state.item_instances[uid] : undefined
    if (!inst || inst.inherited_from_gen === undefined || ch.counters[RETURN_COUNTER + inst.uid]) continue
    ch.counters[RETURN_COUNTER + inst.uid] = 1
    // 부모에게서 받았으면 부르는 말, 더 윗세대면 그 인물 이름(이전 이력 가운데 마지막)
    const from = [...inst.history].reverse().find((h) => h.kind === 'inherited')
    const call = inst.inherited_from_gen === ch.generation - 1 && ch.parent_call ? ch.parent_call : from?.char_name ?? ch.parent_call ?? ''
    const values = { parent_call: call, item: itemName(ctx, inst), place: ctx.content.get('region', place).name }
    return {
      tag: 'gear',
      importance: 'major',
      sub: 'relic_return',
      line: textLine(ctx.content, RELIC_RETURN, values, '{parent_call}의 {item:이/가} 돌아왔다'),
      detail: textLine(ctx.content, RELIC_RETURN_DETAIL, values, '{parent_call}의 {item:이/가} 다시 {place}에 섰다.'),
      refs: { item_uid: inst.uid, location_id: place },
    }
  }
  return null
}

// 65세·치명 허용 안내에 쓰는 현재 나이(09 §2.2)
export function currentAgeOf(ctx: RuleContext): number {
  return ageAt(characterOf(ctx).eff_min, ctx.content.balance.time)
}
