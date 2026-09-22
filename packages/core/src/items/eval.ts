// 장비 평가 점수와 개선률(08 §7). 전투 성분은 기준 적(인물 레벨의 일반 적 기준식)을 상대로 계산하고,
// 효과 가치 V는 balance.equip_eval.value_table + item_effect.value_pct에서 읽는다.
// 후보 장비를 실제로 입히지 않고, 그 슬롯에 후보를 넣은 가상 문맥(view)으로 rules/derived·check를 그대로 쓴다.
import { regionMatches, type Content, type RegionFilter } from '../content/index'
import type { Condition, Modifier, SLOTS } from '../schema/index'
import type { ItemInstance } from '../state/inventory'
import { characterOf, type RuleContext } from '../rules/context'
import { armorClass, damageProfile, maxHp } from '../rules/derived'
import { hitBonus, successChance } from '../rules/check'
import { collectModSources, modValue } from '../rules/modifiers'
import { enemyStats } from '../rules/enemy'
import { dormantDef, isDormant, itemStats } from './stats'

export type Slot = (typeof SLOTS)[number]
// 평가할 장비(인스턴스 또는 상점 품목). uid가 없으면 상점 품목
export type EvalItem = Pick<ItemInstance, 'def_id' | 'grade'> & Partial<Pick<ItemInstance, 'uid' | 'effects' | 'inherited_from_gen' | 'used'>>

export interface EvalOptions {
  mainPlace?: string | null // 주 활동 장소(최근 출정 3회 최빈, 08 §7.1). 저장에 출정 이력이 없어 부르는 쪽이 준다
}

export type ReasonKey =
  | 'weapon_damage' | 'weapon_hit' | 'family' | 'armor_ac' | 'armor_hp'
  | 'search' | 'travel' | 'fear' | 'start' | 'escape'

export interface Improvement {
  value: number // 개선률(08 §7.4)
  combat: number // 전투 성분 개선률 × 태도 배수
  vNew: number
  vCur: number
  reason: ReasonKey
}

const VIEW_UID = 'it_0' // 상점 품목을 가상으로 넣을 때 쓰는 uid(발급 번호는 1부터라 겹치지 않는다)

// 평가 기준 적(08 §7.1)
export function referenceEnemy(content: Content, level: number) {
  const e = enemyStats(content.balance.enemy_formula, level, 'normal')
  return { ac: e.ac, hit: e.hit, avgDamage: (e.dmg_min + e.dmg_max) / 2 }
}

// 시작 지급 장비(08 §7.4 W01·A01): 획득처에 start가 있는 장비
export function isStarterDef(content: Content, defId: string): boolean {
  return content.get('item', defId).sources.some((s) => s.kind === 'start')
}

// 슬롯에 item을 넣은 가상 문맥. 잠재 상태면 정의를 잠든 성능으로 바꾸고 부가 효과를 뺀다
function view(ctx: RuleContext, slot: Slot, item: EvalItem | null): RuleContext {
  const level = characterOf(ctx).level
  const uid = item?.uid ?? VIEW_UID
  const dormant = item ? isDormant(ctx.content, item as ItemInstance, level) : false
  const inst = item && ({ locked: false, acquired: undefined, history: [], ...item, uid, ...(dormant ? { effects: [] } : {}) } as unknown as ItemInstance)
  const state = {
    ...ctx.state,
    inventory: { ...ctx.state.inventory, equipped: { ...ctx.state.inventory.equipped, [slot]: item ? uid : null } },
    item_instances: inst ? { ...ctx.state.item_instances, [uid]: inst } : ctx.state.item_instances,
  }
  let content = ctx.content
  if (item && dormant) {
    const def = dormantDef(ctx.content, ctx.content.get('item', item.def_id), itemStats(ctx.content, item, level).tier)
    content = Object.create(ctx.content) as Content
    const get = ctx.content.get.bind(ctx.content)
    content.get = ((kind: string, id: string) => (kind === 'item' && id === def.id ? def : get(kind as 'item', id))) as Content['get']
  }
  return { content, state, test: ctx.test }
}

// 주 활동 장소 조우 표의 계열 비중(08 §7.1)
function familyShares(content: Content, mainPlace: string | null | undefined): [string, number][] {
  if (!mainPlace) return []
  const r = content.get('region', mainPlace)
  if (r.kind === 'town') return []
  const total = r.encounters.reduce((s, e) => s + e.weight, 0)
  const by = new Map<string, number>()
  for (const e of r.encounters) {
    const f = content.get('enemy', e.enemy_id).family
    by.set(f, (by.get(f) ?? 0) + e.weight / total)
  }
  return [...by]
}

interface WeaponParts { p: number; d: number; pNoFam: number; dNoFam: number }

// 무기: 라운드당 기대 피해 P = p_c × d_c(08 §7.2)
function weaponParts(v: RuleContext, shares: [string, number][]): WeaponParts {
  const b = v.content.balance
  const lvl = characterOf(v).level
  const enemy = referenceEnemy(v.content, lvl)
  const src = collectModSources(v)
  const hit = hitBonus(v, undefined, src).bonus
  const dp = damageProfile(v, undefined, src)
  const pc = (h: number) => successChance(v, enemy.ac - h)
  const dBase = (dp.min + dp.max) / 2 + dp.bonus
  let famHit = 0
  let famDmg = 0
  for (const [f, share] of shares) {
    famHit += modValue(v, `hit_vs.${f}`, 0, src) * share
    famDmg += modValue(v, `damage_vs.${f}`, 0, src) * share
  }
  return { p: pc(hit + famHit), d: dBase + famDmg, pNoFam: pc(hit), dNoFam: dBase }
}

// 방어구: 버팀 라운드 B = 최대 HP / (p_e × 적 평균 피해)
function armorParts(v: RuleContext): { hp: number; pe: number; dmg: number } {
  const enemy = referenceEnemy(v.content, characterOf(v).level)
  const src = collectModSources(v)
  return { hp: maxHp(v, src), pe: successChance(v, armorClass(v, src) - enemy.hit), dmg: enemy.avgDamage }
}

// 가치 표 행 when 평가: main_place는 여기서, 나머지 단말은 ctx.test(ARCHITECTURE §3 조건 평가 범위)
function scopedTest(ctx: RuleContext, content: Content, mainPlace: string | null | undefined) {
  const test = (c: Condition): boolean => {
    if (typeof c === 'boolean') return c
    const o = c as Record<string, unknown>
    if ('all' in o) return (o.all as Condition[]).every(test)
    if ('any' in o) return (o.any as Condition[]).some(test)
    if ('not' in o) return !test(o.not as Condition)
    if ('main_place' in o) return !!mainPlace && regionMatches(content, mainPlace, o.main_place as RegionFilter)
    return ctx.test(c)
  }
  return test
}

// 수정자 크기(equip_eval 주석): add = 값, mul = 값 − 1, charges = 충전 수
function magnitude(m: Modifier): number {
  if (typeof m.value !== 'number') return m.value === true ? 1 : 0
  return m.op === 'mul' ? m.value - 1 : m.value
}

const REASON_BY_TARGET: [RegExp, ReasonKey][] = [
  [/^check\.(skill\.search|trap_detect|trap_disarm|trap_evade)$/, 'search'],
  [/travel_time_mult$|^discovery_chance/, 'travel'],
  [/^check\.fear$|^fear_immunity$/, 'fear'],
  [/^escape_on_defeat$/, 'escape'],
]
const reasonOf = (target: string): ReasonKey | null => REASON_BY_TARGET.find(([re]) => re.test(target))?.[1] ?? null

// 효과 가치 V(08 §7.3): 장비 한 개의 비전투 효과 가치 합, 상한 v_cap. 잠든 유품·저주 불리는 0
export function itemValue(ctx: RuleContext, item: EvalItem | null, opts: EvalOptions = {}): { v: number; parts: [ReasonKey | null, number][] } {
  if (!item || item.used) return { v: 0, parts: [] }
  const { content } = ctx
  const def = content.get('item', item.def_id)
  if (def.cursed || isDormant(content, item as ItemInstance, characterOf(ctx).level)) return { v: 0, parts: [] }
  const ee = content.balance.equip_eval
  const test = scopedTest(ctx, content, opts.mainPlace)
  const parts: [ReasonKey | null, number][] = []
  for (const m of [...(def.modifiers ?? []), ...(def.grade_modifiers?.[item.grade] ?? [])]) {
    const row = ee.value_table.find((r) => 'target' in r && r.target === m.target)
    if (!row || !('target' in row)) continue
    const mult = row.mults.filter((x) => test(x.when)).reduce((s, x) => s * x.mult, 1)
    parts.push([reasonOf(m.target), row.value * (magnitude(m) / row.unit) * mult])
  }
  for (const e of item.effects ?? []) {
    const ef = content.get('item_effect', e)
    if (ef.value_pct !== null) parts.push([reasonOf(ef.modifiers[0]?.target ?? ''), ef.value_pct])
  }
  return { v: Math.min(ee.v_cap, parts.reduce((s, [, x]) => s + x, 0)), parts }
}

// 개선률(08 §7.4) = 전투 성분 개선률 × 태도 배수 + (V_새 − V_현재). 현재 = 그 슬롯의 착용 장비
export function improvement(ctx: RuleContext, candidate: EvalItem, opts: EvalOptions = {}): Improvement {
  const { content, state } = ctx
  const ch = characterOf(ctx)
  const slot = content.get('item', candidate.def_id).slot
  const curUid = state.inventory.equipped[slot]
  const cur = curUid ? state.item_instances[curUid]! : null
  const att = content.get('attitude', state.policies.attitude)
  const spec = ch.specialization !== 'none' ? content.balance.specializations[ch.specialization] : undefined

  const vNew = itemValue(ctx, candidate, opts)
  const vCur = itemValue(ctx, cur, opts)
  let combat = 0
  const reasons: [ReasonKey, number][] = []
  // 장신구·유물도 명중·피해·방어·HP를 바꾸면 그 성분에 반영한다(08 §7.2). 안 바꾸면 전투 성분 0
  const vNewCtx = view(ctx, slot, candidate)
  const vCurCtx = view(ctx, slot, cur)
  const shares = familyShares(content, opts.mainPlace)
  const n = weaponParts(vNewCtx, shares)
  const c = weaponParts(vCurCtx, shares)
  if (slot === 'weapon' || (slot !== 'armor' && (n.p !== c.p || n.d !== c.d))) {
    const pCur = c.p * c.d
    const mult = att.eval_mult.weapon
    combat += (n.p * n.d / pCur - 1) * mult
    // 이유 분해: 계열 대상 / 명중 / 피해(08 §7.5)
    reasons.push(['family', ((n.p * n.d - n.pNoFam * n.dNoFam) - (pCur - c.pNoFam * c.dNoFam)) / pCur * mult])
    reasons.push(['weapon_hit', (n.pNoFam - c.pNoFam) * c.dNoFam / pCur * mult])
    reasons.push(['weapon_damage', n.pNoFam * (n.dNoFam - c.dNoFam) / pCur * mult])
  }
  const na = armorParts(vNewCtx)
  const ca = armorParts(vCurCtx)
  if (slot === 'armor' || (slot !== 'weapon' && (na.hp !== ca.hp || na.pe !== ca.pe))) {
    const bCur = ca.hp / (ca.pe * ca.dmg)
    const mult = att.eval_mult.armor + (spec?.eval_armor_add ?? 0)
    combat += (na.hp / (na.pe * na.dmg) / bCur - 1) * mult
    reasons.push(['armor_hp', (na.hp / (ca.pe * ca.dmg) / bCur - 1) * mult])
    reasons.push(['armor_ac', (na.hp / (na.pe * na.dmg) - na.hp / (ca.pe * ca.dmg)) / bCur * mult])
  }
  // 효과 가치 차이는 항목별로 이유 후보에 더한다
  const vDiff = new Map<ReasonKey, number>()
  for (const [k, x] of vNew.parts) if (k) vDiff.set(k, (vDiff.get(k) ?? 0) + x)
  for (const [k, x] of vCur.parts) if (k) vDiff.set(k, (vDiff.get(k) ?? 0) - x)
  reasons.push(...vDiff)

  let reason: ReasonKey
  if (!cur || isStarterDef(content, cur.def_id)) reason = 'start'
  else {
    const best = reasons.reduce<[ReasonKey, number] | null>((a, r) => (!a || r[1] > a[1] ? r : a), null)
    reason = best && best[1] > 0 ? best[0] : slot === 'weapon' ? 'weapon_damage' : slot === 'armor' ? 'armor_ac' : 'search'
  }
  return { value: combat + (vNew.v - vCur.v), combat, vNew: vNew.v, vCur: vCur.v, reason }
}

// 교체 조건(08 §7.4): 개선률 ≥ 최소, 또는 현재 슬롯이 비었거나 시작 지급 장비
export function worthSwapping(ctx: RuleContext, candidate: EvalItem, imp: Improvement): boolean {
  const slot = ctx.content.get('item', candidate.def_id).slot
  const cur = ctx.state.inventory.equipped[slot]
  if (!cur || isStarterDef(ctx.content, ctx.state.item_instances[cur]!.def_id)) return true
  return imp.value >= ctx.content.balance.economy.auto_buy_min_improvement - 1e-9
}

// 교체 이유 문장(08 §7.5). 코어 문형 슬롯이 정해지기 전까지 엔진이 조립한다(I23)
export const REASON_LINES: Record<ReasonKey, { short: string; long: string }> = {
  weapon_damage: { short: '{item:을/를} 새로 들었다.', long: '더 깊이 베려고 {old_item:을/를} 내려놓고 {item:을/를} 샀다.' },
  weapon_hit: { short: '손에 맞는 {item:을/를} 찾았다.', long: '손에 더 잘 맞아 {old_item:을/를} {item:으로/로} 바꿨다.' },
  family: { short: '{item:을/를} 새로 들었다.', long: '{enemy_kind:을/를} 상대하려고 {item:을/를} 샀다.' },
  armor_ac: { short: '{item:을/를} 걸쳤다.', long: '더 단단한 옷이 필요해 {item:을/를} 입었다.' },
  armor_hp: { short: '{item:을/를} 걸쳤다.', long: '오래 버티려고 {old_item:을/를} {item:으로/로} 바꿨다.' },
  search: { short: '{item:을/를} 달았다.', long: '함정 감지가 높아져 {item:으로/로} 바꿨다.' },
  travel: { short: '{item:을/를} 챙겼다.', long: '발걸음을 가볍게 하려고 {item:을/를} 샀다.' },
  fear: { short: '{item:을/를} 챙겼다.', long: '어둠이 덜 무섭도록 {item:을/를} 챙겼다.' },
  start: { short: '{item:을/를} 걸쳤다.', long: '{old_item:을/를} 접어 두고 {item:을/를} 걸쳤다.' },
  escape: { short: '{item:을/를} 품에 넣었다.', long: '한 번은 돌아오려고 {item:을/를} 샀다.' },
}
