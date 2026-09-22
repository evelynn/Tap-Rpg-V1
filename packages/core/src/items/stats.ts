// 장비 등급별 실제 성능(08 §3.1, 01 §9.3)과 유품 잠재 상태(12 §5.5, 01 §14).
// 단계·등급 수치는 balance.economy에서 읽는다. 반올림은 08 §3.1(0.5는 올림, roundHalfUp).
import type { Content, ContentDef } from '../content/index'
import type { GRADES } from '../schema/index'
import type { ItemInstance } from '../state/inventory'
import { roundHalfUp } from '../rules/num'

export type Grade = (typeof GRADES)[number]
export type ItemDef = ContentDef<'item'>

// 레벨 → 레벨 기준 단계(1~). economy.tier_levels 범위 밖이면 가까운 끝
export function levelTier(content: Content, level: number): number {
  const t = content.balance.economy.tier_levels
  const i = t.findIndex(([lo, hi]) => level >= lo && level <= hi)
  if (i >= 0) return i + 1
  return level < t[0]![0] ? 1 : t.length
}

// 장소 단계 = 권장 레벨 중앙값의 단계(08 §6.1)
export function placeTier(content: Content, regionId: string): number {
  const r = content.get('region', regionId)
  if (r.kind === 'town') throw new Error(`마을 '${regionId}'에는 장소 단계가 없다`)
  return levelTier(content, r.level_mid)
}

// 잠재 상태: 계승된 유품이 후계자 레벨 기준 단계보다 높은 단계일 때(12 §5.5)
export function isDormant(content: Content, inst: ItemInstance, level: number): boolean {
  if (inst.inherited_from_gen === undefined) return false
  return content.get('item', inst.def_id).tier > levelTier(content, level)
}

export interface ItemStats {
  tier: number // 성능에 적용한 단계(잠재 상태면 레벨 기준 단계)
  dormant: boolean // 특수 효과·장신구·유물 효과·저주가 잠듦
  damage: [number, number] | null // 무기만
  hit: number // 등급 명중 보정 + base.hit(잠재 상태에서도 유지)
  ac: number | null // 방어구만(등급 방어 보정 포함)
  hp: number | null // 방어구만
}

// level을 주면 잠재 상태를 적용한다
export function itemStats(content: Content, inst: Pick<ItemInstance, 'def_id' | 'grade' | 'inherited_from_gen'>, level?: number): ItemStats {
  const def = content.get('item', inst.def_id)
  const eco = content.balance.economy
  const g = eco.grade_stats[inst.grade]
  const dormant = level !== undefined && isDormant(content, inst as ItemInstance, level)
  const tier = dormant ? levelTier(content, level!) : def.tier
  const tb = eco.tier_base[tier - 1]
  if (!tb) throw new Error(`장비 단계 ${tier}의 기본 성능이 없다`)
  // base 덮어쓰기(W01·A01)는 정의 단계 성능일 때만 쓴다
  const base = dormant ? undefined : def.base
  const hit = g.hit + (def.base?.hit ?? 0)
  if (def.slot === 'weapon') {
    const [lo, hi] = base?.damage ?? tb.weapon_dmg
    return { tier, dormant, damage: [Math.max(1, roundHalfUp(lo * g.dmg_mult)), Math.max(1, roundHalfUp(hi * g.dmg_mult))], hit, ac: null, hp: null }
  }
  if (def.slot === 'armor') {
    return { tier, dormant, damage: null, hit, ac: (base?.ac ?? tb.armor_ac) + g.ac, hp: base?.hp ?? tb.armor_hp }
  }
  return { tier, dormant, damage: null, hit: 0, ac: null, hp: null }
}

// 잠재 상태를 반영한 정의 사본: 성능은 적용 단계의 기본값, 특수 효과는 뺀다.
// rules/derived가 이 정의로 계산하면 12 §5.5 표와 같은 값이 나온다(등급 배수는 derived가 곱한다)
export function dormantDef(content: Content, def: ItemDef, tier: number): ItemDef {
  const tb = content.balance.economy.tier_base[tier - 1]!
  const hit = def.base?.hit
  return {
    ...def,
    base: def.slot === 'weapon' ? { damage: tb.weapon_dmg, ...(hit ? { hit } : {}) } : def.slot === 'armor' ? { ac: tb.armor_ac, hp: tb.armor_hp } : undefined,
    modifiers: [],
    grade_modifiers: {},
  }
}
