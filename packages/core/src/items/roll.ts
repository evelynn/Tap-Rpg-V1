// 장비 굴림(08 §3.6·§3.7·§6·§9.5): 부가 효과, 드롭 여부·등급·단계·정의, 첫 출정 보장 드롭, 고유 장비 재획득 대체.
// 굴림은 상태를 바꾸지 않고 DropSpec을 돌려준다(행동 시작 때 확정, 13 §8.3). 인스턴스는 materializeItem이 만든다.
// 난수는 loot 흐름(I07)을 넘겨받는다.
import type { Content } from '../content/index'
import type { ROOM_KINDS } from '../schema/index'
import type { ItemInstance } from '../state/inventory'
import { createItemInstance } from '../sim/create'
import type { RuleContext } from '../rules/context'
import { characterOf } from '../rules/context'
import { effectiveStat } from '../rules/derived'
import { modValue } from '../rules/modifiers'
import { weightedPick, type Rng } from '../rules/random'
import { levelTier, placeTier, type Grade, type ItemDef } from './stats'

export interface DropSpec {
  def_id: string
  grade: Grade
  effects: string[]
  prefix?: string
  replaced_from?: string // 고유 장비 대체로 바뀐 원래 정의(08 §9.5)
}

// 정예 관문 전설 결과의 이름 접두(08 §6.2)
export const NAMED_PREFIX = '이름난'
// 드롭 등급 순서(balance.economy.drops.*.grades 키)
const DROP_GRADES = ['common', 'good', 'rare', 'legendary'] as const

// 그 장비·등급에 붙을 수 있는 부가 효과(allowed_effects가 없으면 효과 정의의 slots)
export function effectPool(content: Content, def: ItemDef, grade: 'good' | 'rare'): string[] {
  if (def.allowed_effects) return def.allowed_effects.filter((id) => content.get('item_effect', id).grade === grade)
  return content.list('item_effect').filter((e) => e.grade === grade && e.slots.includes(def.slot)).map((e) => e.id)
}

// 부가 효과 굴림: 변동 장비만. 좋은 = good_effect_chance로 1개, 희귀 = rare_effect_count개(이름난 희귀는 named_rare_effect_count)
export function rollEffects(content: Content, rng: Rng, def: ItemDef, grade: Grade, named = false): string[] {
  if (def.grade_mode !== 'rolled') return []
  const eco = content.balance.economy
  let pool: string[]
  let count: number
  if (grade === 'good') {
    pool = effectPool(content, def, 'good')
    count = rng.chance(eco.good_effect_chance) ? 1 : 0
  } else if (grade === 'rare' || grade === 'legendary') {
    pool = effectPool(content, def, 'rare')
    count = named ? eco.named_rare_effect_count : eco.rare_effect_count
  } else return []
  const out: string[] = []
  for (let i = 0; i < count && pool.length; i++) {
    const e = rng.pick(pool)
    out.push(e)
    pool = pool.filter((x) => x !== e)
  }
  return out
}

// 등급 가중치 + 행운 보정(08 §6.3): 희귀·전설 × (1 + per_point × 행운, 최대 1 + cap), 늘어난 만큼 일반에서 뺀다
export function dropGradeWeights(content: Content, table: string, luck: number): number[] {
  const t = content.balance.economy.drops[table]
  if (!t) throw new Error(`드롭 표 '${table}'가 balance.economy.drops에 없다`)
  const l = content.balance.stats.luck
  const mult = 1 + Math.min(l.rare_drop_cap, Math.max(0, l.rare_drop_per_point * luck))
  const w = DROP_GRADES.map((g) => t.grades[g])
  const rare = w[2]! * mult
  const leg = w[3]! * mult
  const common = Math.max(0, w[0]! - (rare - w[2]!) - (leg - w[3]!))
  return [common, w[1]!, rare, leg]
}

// 등급 굴림(행운 보정). 전설 장비는 굴림으로 나오지 않으므로(W10은 관문 첫 격파 고정 보상) 전설 결과는
// 이름난 희귀(희귀 + 효과 named_rare_effect_count개)로 둔다. legendary_as가 없는 표도 같다(08 §6.2)
export function rollGrade(ctx: RuleContext, rng: Rng, table: string): RolledGrade {
  return namedRare(DROP_GRADES[weightedPick(rng, dropGradeWeights(ctx.content, table, effectiveStat(ctx, 'luk')))]!)
}

export interface RolledGrade { grade: Exclude<Grade, 'legendary'>; named: boolean }

const namedRare = (g: Grade): RolledGrade => (g === 'legendary' ? { grade: 'rare', named: true } : { grade: g as Exclude<Grade, 'legendary'>, named: false })

// 가중치를 직접 준 등급 추첨(사건 grade_weights). 전설 처리는 rollGrade와 같은 규칙이다
export function pickGradeWeighted(rng: Rng, weights: Partial<Record<Grade, number>>): RolledGrade {
  const pool = DROP_GRADES.filter((g) => (weights[g] ?? 0) > 0)
  if (!pool.length) throw new Error('등급 가중치가 비었다')
  return namedRare(pool[weightedPick(rng, pool.map((x) => weights[x]!))]!)
}

// 가문 안에 그 정의가 있는가(착용·가방·수령 대기함). 쓴 1회용(빈 병 기념품)은 없는 것으로 본다(08 §9.5)
export function familyHasItem(ctx: Pick<RuleContext, 'state'>, defId: string): boolean {
  const inv = ctx.state.inventory
  const uids = [...Object.values(inv.equipped), ...inv.bag, ...inv.pending_box]
  return uids.some((u) => {
    const inst = u ? ctx.state.item_instances[u] : undefined
    return inst?.def_id === defId && !inst.used
  })
}

// 생애 1회 제한 카운터 키(08 §6.1 J05 once_per_life, §5.1 생애 1개 구매)
export const onceKey = (kind: 'drop_once' | 'purchased', defId: string) => `${kind}.${defId}`

// 고유 장비 보상(사건·관문)을 줄 때 부른다. 가문에 이미 있으면 대체(08 §9.5). reroll이면 null(부르는 쪽이 이 장비를 빼고 다시 굴린다)
export function replaceUnique(ctx: RuleContext, rng: Rng, spec: DropSpec): DropSpec | null {
  const def = ctx.content.get('item', spec.def_id)
  if (!def.unique || !familyHasItem(ctx, def.id)) return spec
  const r = def.reacquire
  if (!r || 'reroll' in r) return null
  const id = rng.pick(r.pool)
  return { def_id: id, grade: r.grade, effects: rollEffects(ctx.content, rng, ctx.content.get('item', id), r.grade), replaced_from: def.id }
}

export interface DropInput {
  table: string // balance.economy.drops 키(hunt·dungeon_combat·treasure_chest·elite_gate·boss_gate)
  location: string
  room?: (typeof ROOM_KINDS)[number]
  gateEnemy?: string // 관문 보상: 단계 = 관문 적 레벨의 단계(08 §6.1)
}

// 드롭 결정(08 §6.1). 드롭이 없으면 null
export function rollDrop(ctx: RuleContext, rng: Rng, input: DropInput): DropSpec | null {
  const { content } = ctx
  const eco = content.balance.economy
  const table = eco.drops[input.table]
  if (!table) throw new Error(`드롭 표 '${input.table}'가 balance.economy.drops에 없다`)
  // 1. 드롭 여부(드롭 확률 가산 수정자 포함). 확률 1이어도 난수 1개를 쓴다(I06)
  const p = Math.min(1, Math.max(0, table.chance + modValue(ctx, 'drop_chance_add', 0)))
  if (!rng.chance(p)) return null
  // 2. 등급
  const { grade, named } = rollGrade(ctx, rng, input.table)
  // 3. 조건부 장소 전용 장비(room·grade_is·chance): J05 류
  const ch = characterOf(ctx)
  for (const def of content.list('item')) {
    for (const s of def.sources) {
      if (s.kind !== 'drop' || s.id !== input.location) continue
      if (s.room === undefined && s.grade_is === undefined && s.chance === undefined) continue
      if (s.room !== undefined && s.room !== input.room) continue
      if (s.grade_is !== undefined && s.grade_is !== grade) continue
      if (s.once_per_life && (ch.counters[onceKey('drop_once', def.id)] ?? 0) > 0) continue
      if (!rng.chance(s.chance ?? 1)) continue
      if (def.unique && familyHasItem(ctx, def.id)) continue // reacquire reroll: 일반 굴림으로
      return { def_id: def.id, grade: def.fixed_grade ?? grade, effects: rollEffects(content, rng, def, grade, named) }
    }
  }
  // 4. 단계와 장비 정의
  const tier = input.gateEnemy
    ? levelTier(content, content.get('enemy', input.gateEnemy).level)
    : placeTier(content, input.location)
  const def = pickDropDef(content, rng, input.location, tier)
  // 후보는 변동 장비뿐이라 고유 장비 대체가 필요 없다(고유 장비 보상은 replaceUnique를 거친다)
  return { def_id: def.id, grade, effects: rollEffects(content, rng, def, grade, named), ...(named ? { prefix: NAMED_PREFIX } : {}) }
}

// 후보 = 장소 전용 장비(단계가 같으면 drop_pick.local, 다르면 local_off_tier) + 그 단계 상점 품목(drop_pick.shop)
export function dropCandidates(content: Content, location: string, tier: number): { def: ItemDef; weight: number }[] {
  const w = content.balance.economy.drop_pick
  const out = new Map<string, { def: ItemDef; weight: number }>()
  for (const def of content.list('item')) {
    if (def.grade_mode !== 'rolled' || def.cursed) continue
    const local = def.sources.some((s) => s.kind === 'drop' && s.id === location && s.room === undefined && s.grade_is === undefined && s.chance === undefined)
    if (local) out.set(def.id, { def, weight: def.tier === tier ? w.local : w.local_off_tier })
    else if (def.shop?.length && def.tier === tier) out.set(def.id, { def, weight: w.shop })
  }
  return [...out.values()]
}

function pickDropDef(content: Content, rng: Rng, location: string, tier: number): ItemDef {
  const cands = dropCandidates(content, location, tier)
  if (!cands.length) throw new Error(`단계 ${tier}의 드롭 후보가 없다`)
  return cands[weightedPick(rng, cands.map((c) => c.weight))]!.def
}

// 첫 출정 보장 드롭(08 §6.4, balance.first_sortie): 조건이 맞고 그 조우 번호(1부터)면 드롭 판정을 대신한다
export function guaranteedDrop(ctx: RuleContext, encounterNo: number): DropSpec | null {
  const fs = ctx.content.balance.first_sortie
  const g = fs.guaranteed_drop
  if (encounterNo !== g.encounter || !ctx.test(fs.when) || !ctx.test(g.when)) return null
  return { def_id: g.item, grade: g.grade, effects: [] }
}

// 조우 드롭: 보장 드롭이 있으면 그것, 아니면 rollDrop
export function rollEncounterDrop(ctx: RuleContext, rng: Rng, input: DropInput & { encounterNo?: number }): DropSpec | null {
  return (input.encounterNo !== undefined ? guaranteedDrop(ctx, input.encounterNo) : null) ?? rollDrop(ctx, rng, input)
}

// 굴림 결과로 인스턴스를 만든다. 생애 1회 드롭은 카운터를 올린다
export function materializeItem(ctx: RuleContext, spec: DropSpec, acquired: ItemInstance['acquired']): ItemInstance {
  const inst = createItemInstance(ctx.content, ctx.state, spec.def_id, spec.grade, acquired)
  if (spec.effects.length) inst.effects = [...spec.effects]
  if (spec.prefix) inst.prefix = spec.prefix
  const def = ctx.content.get('item', spec.def_id)
  if (def.sources.some((s) => s.kind === 'drop' && s.once_per_life)) {
    const ch = characterOf(ctx)
    const k = onceKey('drop_once', def.id)
    ch.counters[k] = (ch.counters[k] ?? 0) + 1
  }
  return inst
}
