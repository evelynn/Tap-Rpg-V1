// 적 특수능력 핸들러(CONTENT_SCHEMA §4.4, 07 §4). 등록부 enemySpecials의 kind마다 핸들러 1개.
// 무효화는 장비·특성 ID가 아니라 수정자 flag(fear_immunity, dark_penalty_ignore)와 special.{kind}.{param} 가산으로 본다.
import { COMBAT_CHECKS, type Battle, type Condition, type EnemySpecial, type Foe, type Modifier, type SavedEffectLike } from './types'
import { modFlag, modValue } from '../rules/modifiers'

// 한 전투 안에서 핸들러가 부르는 자리. 값을 돌려주는 훅은 없으면 0(가산) 또는 1(배수)로 본다
export interface SpecialHandler<S = EnemySpecial> {
  start?(b: Battle, foe: Foe, sp: S): void // 1라운드 전(돌 던지기)
  roundStart?(b: Battle, foe: Foe, sp: S): void // 라운드 시작(울부짖음·종 울림)
  acAdd?(b: Battle, foe: Foe, sp: S): number // 적 방어 가감
  charHitAdd?(b: Battle, foe: Foe, sp: S): number // 인물이 이 적을 칠 때 명중 가감
  damageTaken?(b: Battle, foe: Foe, sp: S, dmg: number): number // 이 적이 받는 피해(계열 가산 전)
  afterStruck?(b: Battle, foe: Foe, sp: S, hpBefore: number): void // 인물 공격을 받은 뒤(체력 경계)
  act?(b: Battle, foe: Foe, sp: S): 'skip' | undefined // 적 차례 시작. skip이면 공격하지 않는다
  attacks?(b: Battle, foe: Foe, sp: S): number // 라운드당 공격 수
  hitAdd?(b: Battle, foe: Foe, sp: S): number // 적 명중 가감
  damageMult?(b: Battle, foe: Foe, sp: S): number // 적 피해 배수(곱한 뒤 올림)
  onHit?(b: Battle, foe: Foe, sp: S): void // 적 공격이 명중한 뒤
  end?(b: Battle, foe: Foe, sp: S): void // 전투가 끝난 뒤
}

type P<T> = EnemySpecial & T
const ratio = (f: Foe) => f.hp / f.maxHp

// 공포 판정(울부짖음·종 울림). fear_immunity면 굴리지 않는다
function fearCheck(b: Battle, kind: string, dcOffset: number): 'pass' | 'partial' | 'fail' | null {
  if (modFlag(b.ctx, 'fear_immunity', b.sources)) return null
  const r = b.check(kind, dcOffset)
  return r === 'partial' ? 'partial' : r === 'failure' || r === 'crit_failure' ? 'fail' : 'pass'
}

function addHitMods(b: Battle, mods: readonly Modifier[], until: number): void {
  for (const m of mods) {
    if (m.target === 'hit' && m.op === 'add' && typeof m.value === 'number') b.hitMods.push({ value: m.value, until })
    else throw new Error(`전투 특수능력 수정자는 hit add만 받는다: ${m.target} ${m.op}`)
  }
}

// EB03 단계: hp_above 내림차순으로 처음 넘는 단계
function phaseOf(foe: Foe, sp: P<{ phases: Phase[] }>): Phase {
  const sorted = [...sp.phases].sort((x, y) => y.hp_above - x.hp_above)
  return sorted.find((p) => ratio(foe) > p.hp_above) ?? sorted[sorted.length - 1]!
}

interface Phase {
  hp_above: number
  name: string
  fear_check?: { every_rounds: number; dc_offset: number; fail: Modifier[]; partial: Modifier[]; duration_rounds: number }
  attacks_per_round?: number
  damage_mult?: number
  ac_add?: number
}

export const ENEMY_SPECIAL_HANDLERS: Record<string, SpecialHandler<never>> = {
  // 체력 비율 이하에서 차례마다 확률로 달아난다(경험치 비율만, 동전 없음)
  cowardly_flee: {
    act(b, foe, sp: P<{ hp_ratio_lte: number; chance: number; xp_ratio: number }>) {
      if (ratio(foe) > sp.hp_ratio_lte) return undefined
      if (!b.rng.chance(sp.chance)) return undefined
      foe.status = 'fled'
      foe.xpRatio = sp.xp_ratio
      return 'skip'
    },
  },
  // 명중 시 확률로 인물 방어 가감(이번 전투, max_times회)
  gnaw: {
    onHit(b, foe, sp: P<{ chance: number; ac_add: number; max_times: number }>) {
      if ((foe.uses.gnaw ?? 0) >= sp.max_times) return
      if (!b.rng.chance(sp.chance)) return
      foe.uses.gnaw = (foe.uses.gnaw ?? 0) + 1
      b.acAdd += sp.ac_add
    },
  },
  // 살아 있는 적이 min_count 이상이면 명중 가산
  pack_hunt: {
    hitAdd(b, _foe, sp: P<{ min_count: number; hit_add: number }>) {
      return b.foes.filter((f) => f.status === 'alive').length >= sp.min_count ? sp.hit_add : 0
    },
  },
  // 1라운드 시작에 공포 판정, 실패하면 on_fail(이번 전투)
  howl: {
    roundStart(b, _foe, sp: P<{ check: string; on_fail: Modifier[] }>) {
      if (b.round !== 1) return
      if (fearCheck(b, sp.check, 0) === 'fail') addHitMods(b, sp.on_fail, Infinity)
    },
  },
  // 인물이 이 적을 처음 칠 때 명중 가감
  erratic_flight: {
    charHitAdd(_b, foe, sp: P<{ first_attack_hit_add: number }>) {
      return foe.struck === 0 ? sp.first_attack_hit_add : 0
    },
  },
  // 전투 뒤 피로 추가(special.screech.fatigue 가산)
  screech: {
    end(b, _foe, sp: P<{ fatigue: number }>) {
      b.fatigue += modValue(b.ctx, 'special.screech.fatigue', sp.fatigue, b.sources)
    },
  },
  // 조건이 참이면 방어 가산. dark_penalty_ignore면 없다
  dark_defense: {
    acAdd(b, _foe, sp: P<{ ac_add: number; when: Condition }>) {
      if (modFlag(b.ctx, 'dark_penalty_ignore', b.sources)) return 0
      return b.ctx.test(sp.when) ? sp.ac_add : 0
    },
  },
  // 1라운드 전 원거리 공격 1회(기습이면 하지 않는다)
  stone_throw: {
    start(b, foe, sp: P<{ damage: [number, number]; hit_check: boolean }>) {
      if (b.initiative === 'surprise') return
      b.enemyAttack(foe, { damage: sp.damage, hitCheck: sp.hit_check })
    },
  },
  // 지정 라운드 피해 배수
  heavy_swing: {
    damageMult(b, _foe, sp: P<{ rounds: number[]; damage_mult: number }>) {
      return sp.rounds.includes(b.round) ? sp.damage_mult : 1
    },
  },
  // 받는 피해 감소(최소 min)
  damage_reduction: {
    damageTaken(_b, _foe, sp: P<{ value: number; min: number }>, dmg) {
      return Math.max(sp.min, dmg - sp.value)
    },
  },
  // 체력 비율 이하가 된 뒤 적 차례에 동료를 부른다. skip_attack이면 그 차례에 공격하지 않는다
  summon: {
    act(b, foe, sp: P<{ hp_ratio_lte: number; enemy_id: string; level?: number; skip_attack: boolean; max_times: number }>) {
      if (ratio(foe) > sp.hp_ratio_lte || (foe.uses.summon ?? 0) >= sp.max_times) return undefined
      foe.uses.summon = (foe.uses.summon ?? 0) + 1
      b.addFoe(sp.enemy_id, sp.level)
      return sp.skip_attack ? 'skip' : undefined
    },
  },
  // 체력 경계에 처음 닿을 때마다 판정. 실패·부분 효과(피해)
  cave_shake: {
    afterStruck(b, foe, sp: P<{ hp_thresholds: number[]; check: string; dc_offset: number; fail: SavedEffectLike[]; partial: SavedEffectLike[] }>, hpBefore) {
      for (const t of sp.hp_thresholds) {
        if (!(hpBefore / foe.maxHp > t && ratio(foe) <= t)) continue
        const r = b.check(sp.check, sp.dc_offset)
        if (r === 'failure' || r === 'crit_failure') b.applyEffects(sp.fail)
        else if (r === 'partial') b.applyEffects(sp.partial)
      }
    },
  },
  // 체력 구간별 단계(EB03): 공포 판정, 공격 수, 피해 배수, 방어 가감
  phases: {
    roundStart(b, foe, sp: P<{ phases: Phase[] }>) {
      const fc = phaseOf(foe, sp).fear_check
      if (!fc || (b.round - 1) % fc.every_rounds !== 0) return
      const r = fearCheck(b, COMBAT_CHECKS.fear, fc.dc_offset)
      if (r === 'fail') addHitMods(b, fc.fail, b.round + fc.duration_rounds - 1)
      else if (r === 'partial') addHitMods(b, fc.partial, b.round + fc.duration_rounds - 1)
    },
    attacks(_b, foe, sp: P<{ phases: Phase[] }>) {
      return phaseOf(foe, sp).attacks_per_round ?? 1
    },
    damageMult(_b, foe, sp: P<{ phases: Phase[] }>) {
      return phaseOf(foe, sp).damage_mult ?? 1
    },
    acAdd(_b, foe, sp: P<{ phases: Phase[] }>) {
      return phaseOf(foe, sp).ac_add ?? 0
    },
  },
}

export function specialHandler(kind: string): SpecialHandler<EnemySpecial> {
  const h = ENEMY_SPECIAL_HANDLERS[kind]
  if (!h) throw new Error(`적 특수능력 핸들러가 없다: ${kind}`)
  return h as SpecialHandler<EnemySpecial>
}
