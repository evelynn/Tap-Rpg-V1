// 유도 수치(01 §2.5, 05 §7.1): 유효 능력치, 최대 체력, 방어, 무기. 저장하지 않고 매번 계산한다.
import type { ContentDef } from '../content/index'
import type { STATS } from '../schema/index'
import { characterOf, type RuleContext } from './context'
import { collectModSources, modValue, type ModSource } from './modifiers'

export type Stat = (typeof STATS)[number]

// 자연 상한 8 + 변이가 더하는 상한(TM01 힘·민첩 9)
export function statCap(ctx: RuleContext, stat: Stat): number {
  const ch = characterOf(ctx)
  const add = ch.mutation ? (ctx.content.get('trait', ch.mutation.trait_id).mutation?.natural_cap_add[stat] ?? 0) : 0
  return ctx.content.balance.stats.natural_cap + add
}

// 원값 + stat.{x} 수정자, 0~상한. 부상 감소는 판정에서 따로 뺀다(05 §6.2)
export function effectiveStat(ctx: RuleContext, stat: Stat, sources: readonly ModSource[] = collectModSources(ctx)): number {
  const raw = characterOf(ctx).stats[stat]
  const v = Math.floor(modValue(ctx, `stat.${stat}`, raw, sources))
  return Math.max(0, Math.min(statCap(ctx, stat), v))
}

// 부상 감소: 경상 1개당 −1, 중상 −2(01 §6.2, balance.injury.*.stat_add). 음수 합
export function injuryPenalty(ctx: RuleContext, stat: Stat): number {
  const inj = ctx.content.balance.injury
  return characterOf(ctx).injuries.filter((i) => i.stat === stat).reduce((s, i) => s + inj[i.grade].stat_add, 0)
}

// 부동소수 잡음을 없앤 반올림(08 §3.1: 5 × 1.3 = 6.5 → 7)
export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5 + 1e-9)
}

interface GradeStats { dmg_mult: number; hit: number; ac: number }

function equippedDef(ctx: RuleContext, slot: 'weapon' | 'armor'): { def: ContentDef<'item'>; grade: GradeStats } | null {
  const uid = ctx.state.inventory.equipped[slot]
  if (!uid) return null
  const inst = ctx.state.item_instances[uid]
  if (!inst) throw new Error(`장착 장비 인스턴스가 없다: ${uid}`)
  return { def: ctx.content.get('item', inst.def_id), grade: ctx.content.balance.economy.grade_stats[inst.grade] }
}

function tierBase(ctx: RuleContext, tier: number) {
  const t = ctx.content.balance.economy.tier_base[tier - 1]
  if (!t) throw new Error(`장비 단계 ${tier}의 기본 성능이 없다`)
  return t
}

export interface WeaponProfile {
  item: string | null
  stat: Stat
  damage: [number, number] // 등급 배수 반영
  hit: number // 무기 명중 보정(등급 + base.hit)
}

// 무기 없음(길드 지원 전 잠깐)은 힘, 피해 1~1(피해 최소값 1, 05 §7.1)
export function weaponProfile(ctx: RuleContext, sources: readonly ModSource[] = collectModSources(ctx)): WeaponProfile {
  const w = equippedDef(ctx, 'weapon')
  if (!w) return { item: null, stat: 'str', damage: [1, 1], hit: 0 }
  const { def, grade } = w
  const stat: Stat =
    def.stat === 'best_of_str_dex'
      ? (effectiveStat(ctx, 'dex', sources) > effectiveStat(ctx, 'str', sources) ? 'dex' : 'str')
      : (def.stat ?? 'str')
  const [lo, hi] = def.base?.damage ?? tierBase(ctx, def.tier).weapon_dmg
  return {
    item: def.id,
    stat,
    damage: [Math.max(1, roundHalfUp(lo * grade.dmg_mult)), Math.max(1, roundHalfUp(hi * grade.dmg_mult))],
    hit: grade.hit + (def.base?.hit ?? 0),
  }
}

// 최대 HP = (20 + 4×레벨 + 3×힘 + 방어구 체력 + hp_max_add) × (1 + Σhp_max_mult), 소수 버림(05 §4.4)
export function maxHp(ctx: RuleContext, sources: readonly ModSource[] = collectModSources(ctx)): number {
  const d = ctx.content.balance.stats.derived
  const ch = characterOf(ctx)
  const armor = equippedDef(ctx, 'armor')
  const armorHp = armor ? (armor.def.base?.hp ?? tierBase(ctx, armor.def.tier).armor_hp) : 0
  const base = d.hp_base + d.hp_per_level * ch.level + d.hp_per_str * effectiveStat(ctx, 'str', sources) + armorHp
  const flat = modValue(ctx, 'hp_max_add', base, sources)
  return Math.max(1, Math.floor(flat * modValue(ctx, 'hp_max_mult', 1, sources) + 1e-9))
}

// 방어 = 10 + 방어구 방어(등급 포함) + ⌊민첩/2⌋ + ac 수정자
export function armorClass(ctx: RuleContext, sources: readonly ModSource[] = collectModSources(ctx)): number {
  const d = ctx.content.balance.stats.derived
  const armor = equippedDef(ctx, 'armor')
  const armorAc = armor ? (armor.def.base?.ac ?? tierBase(ctx, armor.def.tier).armor_ac) + armor.grade.ac : 0
  const base = d.ac_base + armorAc + Math.floor(effectiveStat(ctx, 'dex', sources) / d.ac_dex_div)
  return Math.floor(modValue(ctx, 'ac', base, sources))
}

export interface DamageProfile {
  min: number
  max: number
  bonus: number // ⌊무기 능력치/2⌋ + damage(·damage_vs) 수정자
  mult: number // damage_mult
}

// 피해 = 무기 범위(균등 정수) + 보너스. 계열 특화는 enemyFamily를 준다
export function damageProfile(ctx: RuleContext, enemyFamily?: string, sources: readonly ModSource[] = collectModSources(ctx)): DamageProfile {
  const d = ctx.content.balance.stats.derived
  const w = weaponProfile(ctx, sources)
  let bonus = Math.floor(effectiveStat(ctx, w.stat, sources) / d.damage_stat_div) + modValue(ctx, 'damage', 0, sources)
  if (enemyFamily) bonus += modValue(ctx, `damage_vs.${enemyFamily}`, 0, sources)
  return { min: w.damage[0], max: w.damage[1], bonus, mult: modValue(ctx, 'damage_mult', 1, sources) }
}
