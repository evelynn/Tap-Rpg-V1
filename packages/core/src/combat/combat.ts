// 전투(05 §7, 01 §4, 07 §2·§4). resolveCombat은 combat 흐름만 굴려 결과를 확정하고 상태를 바꾸지 않는다.
// applyCombat이 체력·회복약·충전·피로·성장 누적·승리 카운터를 적용한다(13 §8.3 확정 → 적용).
import type { Rng } from '../rules/random'
import { characterOf, type ConditionTest, type RuleContext } from '../rules/context'
import { attackKindId, checkBonus, checkDc, checkKind, recordCheckUse, rollCheck, type CheckRoll } from '../rules/check'
import { addFatigue } from '../rules/fatigue'
import { armorClass, damageProfile, maxHp, weaponProfile } from '../rules/derived'
import { enemyStats } from '../rules/enemy'
import { addSkillUses, addStatUse, encounterXp, type RankUp } from '../rules/growth'
import { collectModSources, modValue } from '../rules/modifiers'
import type { Condition } from '../schema/index'
import type { CheckResult } from '../state/journal'
import { chargesLeft, potionsOwned, useCharge } from '../recovery/rest'
import { specialHandler, type SpecialHandler } from './specials'
import {
  COMBAT_CHECKS, type Battle, type CombatKind, type CombatOutcome, type CombatResult, type EnemyRank, type Foe,
  type RoundRecord, type SavedEffectLike,
} from './types'

export interface CombatEnemySpec {
  id: string
  level?: number // 등록 레벨 대신(관문 잔당 10 + ⌊방 수/2⌋ 등). 밤·방 순번 가산은 이 위에 더한다
  rank?: EnemyRank // 등급 바꾸기(관문 잔당 elite)
}

export interface CombatSpec {
  enemies: readonly CombatEnemySpec[]
  regionLevel: number // 지역 기준 DC(공포·매복 대응·은밀·특수능력 판정)
  kind?: CombatKind // 기본 normal
  night?: boolean // 기본: 출정 시간대
  roomIndex?: number // 던전 방 순번(0부터). 적 레벨 + ⌊순번 / dungeon_room_level_div⌋
  ambush?: boolean // 매복 시도. 주지 않으면 combat 흐름으로 굴린다(기본 확률 + 밤 + ambush_chance_add)
  stealth?: boolean // 은밀 시도. 기본: 밤이고 매복이 아닐 때
  flee?: boolean // 도주 판정 허용(기본 true)
  activity?: 'hunt' | 'adventure' | 'dungeon_room' // 경험치 활동 계수(기본 hunt)
  coinMult?: number // 동전 배수(던전 방 = balance.dungeon.room_coin_mult)
  test?: ConditionTest // 범위를 묶은 조건 평가기. 없으면 world.test에 combat_kind를 더해 감싼다
}

// combat_kind 단말만 이 전투 종류로 답하고 나머지는 base에 넘긴다(all·any·not은 따라 들어간다)
export function combatTest(base: ConditionTest, kind: CombatKind): ConditionTest {
  const t: ConditionTest = (c: Condition) => {
    if (typeof c !== 'object') return base(c)
    if ('combat_kind' in c) return (c.combat_kind as string[]).includes(kind)
    if ('all' in c) return (c.all as Condition[]).every(t)
    if ('any' in c) return (c.any as Condition[]).some(t)
    if ('not' in c) return !t(c.not as Condition)
    return base(c)
  }
  return t
}

// 퇴각 기준(ratio): 태도 + 특성 ai_hooks.retreat_hp_add + retreat_hp_add 수정자(01 §7.1, DS-29)
export function retreatHpRatio(ctx: RuleContext, sources = collectModSources(ctx)): number {
  const ch = characterOf(ctx)
  const att = ctx.content.get('attitude', ctx.state.policies.attitude)
  const hooks = ch.traits.filter((t) => !t.inactive).reduce((s, t) => s + ((ctx.content.get('trait', t.id).ai_hooks?.retreat_hp_add as number | undefined) ?? 0), 0)
  return att.retreat_hp + hooks + modValue(ctx, 'retreat_hp_add', 0, sources)
}

const clean = (x: number) => Math.round(x * 1e9) / 1e9
const ceilMul = (x: number, m: number) => (m === 1 ? x : Math.ceil(clean(x * m)))

export function resolveCombat(world: RuleContext & { rng: { combat: Rng } }, spec: CombatSpec): CombatResult {
  const { content } = world
  const b0 = content.balance
  const cb = b0.combat
  const kind = spec.kind ?? 'normal'
  const rng = world.rng.combat
  const ctx: RuleContext = { content, state: world.state, test: spec.test ?? combatTest(world.test, kind) }
  const sources = collectModSources(ctx)
  const ch = characterOf(ctx)
  const night = spec.night ?? world.state.current_activity.sortie?.time_of_day === 'night'
  const levelAdd = (night ? cb.night.enemy_level_add : 0) + Math.floor((spec.roomIndex ?? 0) / cb.dungeon_room_level_div)
  const maxHpV = maxHp(ctx, sources)
  const baseAc = armorClass(ctx, sources)
  const dmgBase = damageProfile(ctx, undefined, sources)
  const dmgMult = dmgBase.mult + (night ? modValue(ctx, 'night_damage_mult', 1, sources) - 1 : 0) // 합산(09 §7.7)
  const pairTakenMult = modValue(ctx, 'pair_damage_taken_mult', 1, sources)
  const firstRoundEnemyHit = modValue(ctx, 'enemy_hit_first_round_add', 0, sources)
  const firstRoundHit = modValue(ctx, 'first_round_hit_add', 0, sources)
  const firstStrikeHit = modValue(ctx, 'first_strike_hit_add', 0, sources)
  const attackKind = attackKindId(ctx)
  const potions = potionsOwned(ctx) // 작은 병부터
  const potionMax = new Map(potions.map((p) => [p.id, p.count]))
  const rounds: RoundRecord[] = []
  const checks: CheckRoll[] = []
  const checkEffects: SavedEffectLike[] = []
  const charges: { uid: string; target: string }[] = []
  const drunk: string[] = []
  let enemyMisses = 0
  let nat20 = 0
  let enemyHitThisRound = 0 // 이번 라운드 적 명중 가산(대실패·매복 실패)
  let enemyHitNextRound = 0 // 다음 라운드(도주 실패)
  let potionReserved = false
  let potionUses = 0

  const makeFoe = (id: string, level?: number, rank?: EnemyRank): Foe => {
    const def = content.get('enemy', id)
    const r = rank ?? def.rank
    const lv = (level ?? def.level) + levelAdd
    const s = lv === def.level && r === def.rank
      ? { hp: def.hp, ac: def.ac, hit: def.hit, dmg_min: def.damage[0], dmg_max: def.damage[1], xp: def.xp, coins: def.coins }
      : enemyStats(b0.enemy_formula, lv, r)
    return {
      id, family: def.family, level: lv, rank: r, maxHp: s.hp, hp: s.hp, ac: s.ac, hit: s.hit, dmg: [s.dmg_min, s.dmg_max],
      xp: s.xp, coins: s.coins, specials: def.specials, status: 'alive', xpRatio: 1, struck: 0, uses: {},
    }
  }

  // 판정 종류의 '실패 시 기본 결과'·'부분 성공 비용'(05 §6.1). 사건이 결과를 정의하면 사건 쪽을 쓴다(CONTENT_SCHEMA §5.10)
  const collectCheckEffects = (kindId: string, result: CheckResult): void => {
    const k = checkKind(ctx, kindId)
    const list = result === 'partial' ? k.partial_effects
      : result === 'failure' || result === 'crit_failure' ? k.fail_effects
      : undefined
    if (list) checkEffects.push(...(list as readonly SavedEffectLike[]))
  }

  const b: Battle = {
    ctx, rng, kind, round: 0, initiative: 'char', foes: spec.enemies.map((e) => makeFoe(e.id, e.level, e.rank)),
    hp: ch.hp, maxHp: maxHpV, sources, acAdd: 0, hitMods: [], fatigue: 0,
    check(k, dcOffset) {
      const dc = checkDc(ctx, k, { regionLevel: spec.regionLevel, dcOffset, gate: kind !== 'normal' })
      const r = rollCheck(ctx, rng, { kinds: [k], dc })
      checks.push(r)
      collectCheckEffects(k, r.result)
      return r.result
    },
    addFoe(id, level) {
      const f = makeFoe(id, level)
      this.foes.push(f)
      return f
    },
    enemyAttack(foe, opts = {}) {
      enemyAttack(foe, opts.damage, opts.hitCheck ?? true)
    },
    applyEffects(effects) {
      for (const e of effects) applyEffect(e)
    },
  }
  const pair = b.foes.length >= 2
  const hooks = (f: Foe) => f.specials.map((sp) => ({ h: specialHandler(sp.kind), sp }))
  const sum = (f: Foe, pick: (h: SpecialHandler, sp: Foe['specials'][number]) => number | undefined, base: number) =>
    hooks(f).reduce((v, { h, sp }) => v + (pick(h, sp) ?? 0), base)

  // 전투 안 효과: 피해(체력 1 아래로 내리지 않음, 효과 등록부 damage 뜻)
  function applyEffect(e: SavedEffectLike): void {
    if (e.type !== 'damage') throw new Error(`전투 특수능력 효과는 damage만 받는다: ${e.type}`)
    const d = typeof e.hp === 'number' ? e.hp : Math.max(1, Math.round(clean(maxHpV * (e.hp_ratio as number))))
    b.hp = Math.max(Math.min(b.hp, 1), b.hp - d)
  }

  function enemyAttack(foe: Foe, range = foe.dmg, hitCheck = true): void {
    const ac = baseAc + b.acAdd
    const hit = foe.hit + sum(foe, (h, sp) => h.hitAdd?.(b, foe, sp as never), 0) + enemyHitThisRound + (b.round === 1 ? firstRoundEnemyHit : 0)
    const dice = rng.d20()
    const total = dice + hit
    const ok = !hitCheck || total >= ac
    let damage = 0
    if (ok) {
      damage = rng.int(range[0], range[1])
      for (const { h, sp } of hooks(foe)) damage = ceilMul(damage, h.damageMult?.(b, foe, sp as never) ?? 1)
      if (pair && pairTakenMult !== 1) damage -= Math.ceil(clean(damage * (1 - pairTakenMult))) // 올림 후 차감(08 X08)
      damage = Math.max(1, damage)
      b.hp = Math.max(0, b.hp - damage)
      for (const { h, sp } of hooks(foe)) h.onHit?.(b, foe, sp as never)
    } else enemyMisses++
    rounds.push({ round: b.round, actor: foe.id, dice, total, target_ac: ac, hit: ok, damage })
  }

  // 인물 공격 대상: 남은 체력 낮은 적 → 명중 높은 적 → 먼저 나온 적(05 §7.4, 07 §2)
  function target(): Foe {
    const alive = b.foes.filter((f) => f.status === 'alive')
    return alive.reduce((best, f) => (f.hp < best.hp || (f.hp === best.hp && f.hit > best.hit) ? f : best))
  }

  function charAttack(): void {
    const foe = target()
    const add = b.hitMods.filter((m) => m.until >= b.round).reduce((s, m) => s + m.value, 0)
      + sum(foe, (h, sp) => h.charHitAdd?.(b, foe, sp as never), 0)
      + (b.round === 1 ? firstRoundHit + (b.initiative !== 'enemy' ? firstStrikeHit : 0) : 0)
    const situational = add ? [{ target: 'hit', op: 'add' as const, value: add }] : []
    const bonus = checkBonus(ctx, attackKind, { situational, extraTargets: ['hit', `hit_vs.${foe.family}`] }, sources)
    const ac = foe.ac + sum(foe, (h, sp) => h.acAdd?.(b, foe, sp as never), 0)
    const dice = rng.d20()
    const total = dice + bonus.bonus
    const crit = dice === b0.check.crit
    const ok = crit || (dice !== b0.check.fumble && total >= ac)
    foe.struck++
    let damage = 0
    if (ok) {
      // 피해 순서: 굴림 + 능력치·damage → 대성공 ×2 → 배수(damage_mult·밤 피해 합산, 올림) → 적 피해 감소 → 계열 가산(07 §4.1 EN10)
      damage = rng.int(dmgBase.min, dmgBase.max) + dmgBase.bonus
      if (crit) damage *= cb.crit_mult
      damage = ceilMul(damage, dmgMult)
      for (const { h, sp } of hooks(foe)) damage = h.damageTaken?.(b, foe, sp as never, damage) ?? damage
      damage = Math.max(1, damage + modValue(ctx, `damage_vs.${foe.family}`, 0, sources))
      const before = foe.hp
      foe.hp = Math.max(0, foe.hp - damage)
      if (foe.hp === 0) foe.status = 'defeated'
      if (crit) nat20++
      for (const { h, sp } of hooks(foe)) h.afterStruck?.(b, foe, sp as never, before)
    } else if (dice === b0.check.fumble) enemyHitThisRound += cb.fumble_enemy_bonus
    rounds.push({ round: b.round, actor: 'char', dice, total, target_ac: ac, hit: ok, damage })
  }

  // 선공(05 §7.3): 매복 시도 → 매복 무효 충전 → 매복 대응 판정. 아니면 밤 은밀 판정
  const ambushChance = cb.ambush.chance + (night ? cb.ambush.night_add : 0) + modValue(ctx, 'ambush_chance_add', 0, sources)
  let ambush = spec.ambush ?? rng.chance(ambushChance)
  if (ambush) {
    const charge = chargesLeft(ctx, 'ambush_negate')[0]
    if (charge) {
      charges.push({ uid: charge.uid, target: 'ambush_negate' })
      ambush = false
    } else if (!isPass(b.check(COMBAT_CHECKS.ambush, 0))) {
      b.initiative = 'enemy'
      enemyHitThisRound = cb.ambush.fail_enemy_hit_add
    }
  } else if (spec.stealth ?? night) {
    const r = b.check(COMBAT_CHECKS.stealth, 0)
    if (r === 'success' || r === 'crit_success') b.initiative = 'surprise'
  }
  const firstRoundEnemyAdd = enemyHitThisRound
  enemyHitThisRound = 0 // 매복 실패 +2는 1라운드만(05 §7.3). 전투 전 공격(돌 던지기, round 0)에는 걸리지 않는다

  for (const f of [...b.foes]) for (const { h, sp } of hooks(f)) h.start?.(b, f, sp as never)

  const maxRounds = cb.max_rounds[kind]
  const fleeLine = spec.flee === false ? -1 : maxHpV * retreatHpRatio(ctx, sources) * cb.flee.hp_ratio_mult
  let outcome: CombatOutcome = 'stalemate'
  const aliveFoes = () => b.foes.filter((f) => f.status === 'alive')

  for (let r = 1; r <= maxRounds && outcome === 'stalemate'; r++) {
    b.round = r
    enemyHitThisRound = (r === 1 ? firstRoundEnemyAdd : 0) + enemyHitNextRound
    enemyHitNextRound = 0
    for (const f of aliveFoes()) for (const { h, sp } of hooks(f)) h.roundStart?.(b, f, sp as never)

    if (r === 1 && b.initiative === 'enemy') {
      // 매복 실패: 1라운드 인물 공격 없음
    } else {
      if (potionReserved) {
        // 급히 한 모금: 마신 라운드에도 공격한다(05 §7.7)
        const p = potions.filter((x) => (potionMax.get(x.id) ?? 0) > 0).pop()!
        potionMax.set(p.id, potionMax.get(p.id)! - 1)
        drunk.push(p.id)
        b.hp = Math.min(maxHpV, b.hp + p.amount)
        potionReserved = false
        potionUses++
      }
      charAttack()
    }

    if (!aliveFoes().length) {
      outcome = 'win'
      break
    }
    if (b.hp > 0 && !(r === 1 && b.initiative === 'surprise')) {
      for (const f of aliveFoes()) {
        const skipped = hooks(f).some(({ h, sp }) => h.act?.(b, f, sp as never) === 'skip')
        if (skipped || f.status !== 'alive') continue
        const n = hooks(f).reduce((v, { h, sp }) => h.attacks?.(b, f, sp as never) ?? v, 1)
        for (let i = 0; i < n && b.hp > 0; i++) enemyAttack(f)
        if (b.hp <= 0) break
      }
    }
    if (b.hp <= 0) {
      outcome = 'defeat'
      break
    }
    if (!aliveFoes().length) {
      outcome = 'win'
      break
    }
    if (b.hp <= fleeLine) {
      const maxLevel = Math.max(...aliveFoes().map((f) => f.level))
      const dc = checkDc(ctx, COMBAT_CHECKS.flee, { maxEnemyLevel: maxLevel })
      const roll = rollCheck(ctx, rng, { kinds: [COMBAT_CHECKS.flee], dc })
      checks.push(roll)
      collectCheckEffects(COMBAT_CHECKS.flee, roll.result)
      if (isPass(roll.result)) {
        outcome = 'fled'
        break
      }
      enemyHitNextRound = cb.flee.fail_enemy_hit_add
    }
    // 관문·보스 전투의 회복약: 라운드 끝 체력 비율 이하면 다음 라운드 공격 대신 가장 높은 단계(05 §7.7)
    if (kind !== 'normal' && potionUses < cb.gate_potion.uses && b.hp <= maxHpV * cb.gate_potion.hp_ratio_lte
      && potions.some((x) => (potionMax.get(x.id) ?? 0) > 0)) potionReserved = true
  }
  for (const f of b.foes) for (const { h, sp } of hooks(f)) h.end?.(b, f, sp as never)

  // 보상: 쓰러뜨린 적은 경험치·동전, 달아난 적은 경험치 비율, 이탈은 남은 적 경험치 stalemate_xp_ratio(05 §7.6·§7.8)
  const coinMult = spec.coinMult ?? 1
  const rewards = b.foes.map((f) => {
    const xp = encounterXp(content, { baseXp: f.xp, enemyLevel: f.level, activity: spec.activity ?? 'hunt', charLevel: ch.level })
    const ratio = f.status === 'defeated' ? 1 : f.status === 'fled' ? f.xpRatio : outcome === 'stalemate' ? cb.stalemate_xp_ratio : 0
    return {
      enemy_id: f.id, level: f.level, rank: f.rank,
      result: f.status === 'alive' ? 'remained' as const : f.status,
      xp: Math.floor(clean(xp * ratio)),
      coins: f.status === 'defeated' ? Math.floor(clean(f.coins * coinMult)) : 0,
    }
  })

  return {
    kind, outcome, initiative: b.initiative, rounds, round_count: b.round, hp_start: ch.hp, hp_end: b.hp, max_hp: maxHpV,
    rewards, checks, check_effects: checkEffects, potions: drunk, charges, fatigue: b.fatigue,
    enemy_misses: enemyMisses, natural_20s: nat20,
  }
}

const isPass = (r: CheckResult) => r === 'success' || r === 'crit_success'

// 전투 결과 적용: 체력, 회복약, 충전, 추가 피로, 성장 누적(05 §4.1·§5.1·§7.8), 승리 카운터·쓰러뜨린 적. 경험치·동전·드롭은 활동 쪽
export function applyCombat(ctx: RuleContext, r: CombatResult): RankUp[] {
  const b = ctx.content.balance
  const ch = characterOf(ctx)
  const ups: RankUp[] = []
  const push = (u: RankUp | null) => void (u && ups.push(u))
  ch.hp = r.hp_end
  for (const id of r.potions) ctx.state.inventory.consumables[id] = (ctx.state.inventory.consumables[id] ?? 0) - 1
  for (const c of r.charges) useCharge(ctx, c.uid, c.target)
  addFatigue(ctx, r.fatigue)

  const uc = b.skills.use_counts
  const up = b.growth.use_points
  // 05 §7.8: 무기 능력치 사용 점수와 관문 숙련 가산은 승리에만. 이탈·도주·패배는 근접 +1
  const win = r.outcome === 'win'
  if (win) addStatUse(ctx, weaponProfile(ctx).stat, up.combat)
  push(addSkillUses(ctx, 'melee', win
    ? (r.kind === 'boss_gate' ? uc.boss_combat : r.kind === 'elite_gate' ? uc.elite_gate_combat : uc.combat)
    : uc.combat))
  if (r.natural_20s) {
    push(addSkillUses(ctx, 'melee', uc.natural_20 * r.natural_20s))
    addStatUse(ctx, 'luk', up.natural_20_luck * r.natural_20s)
  }
  // 적 공격이 빗나간 횟수 누적 4회마다 민첩 사용 점수·기동 횟수
  ch.miss_streak += r.enemy_misses
  while (ch.miss_streak >= uc.miss_streak.count) {
    ch.miss_streak -= uc.miss_streak.count
    addStatUse(ctx, 'dex', up.miss_streak.points)
    push(addSkillUses(ctx, 'mobility', uc.miss_streak.uses))
  }
  for (const c of r.checks) ups.push(...recordCheckUse(ctx, c))

  // 조우 수(12 §7.1 연대기 summary.encounters): 결과와 무관하게 전투 1회 = 조우 1회
  ch.counters.encounters = (ch.counters.encounters ?? 0) + 1
  if (r.outcome === 'win') ch.counters.wins = (ch.counters.wins ?? 0) + 1
  for (const w of r.rewards) if (w.result === 'defeated' && !ch.defeated.includes(w.enemy_id)) ch.defeated.push(w.enemy_id)
  // 가문 도감(12 §7.2): 만난 적은 처음 만난 대수로 올리고 처치 수를 센다
  const codex = ctx.state.family.codex.enemies
  for (const w of r.rewards) {
    const e = (codex[w.enemy_id] ??= { first_gen: ch.generation, defeats: 0, first_name: ch.name })
    if (w.result === 'defeated') e.defeats++
  }
  return ups
}

// 결정적 순간(07 §8.3): 피해가 가장 컸던 적 공격 n개(같으면 앞 라운드)
export function decisiveRounds(rounds: readonly RoundRecord[], n = 3): RoundRecord[] {
  return rounds.filter((x) => x.actor !== 'char' && x.hit).sort((a, b) => b.damage - a.damage || a.round - b.round).slice(0, n)
}
