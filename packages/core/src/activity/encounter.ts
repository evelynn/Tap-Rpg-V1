// 조우·전투 1회의 확정과 적용(07 §2·§3.2). 전투 결과·드롭·재료·패배를 모두 행동 시작 때 굴린다(13 §8.3).
import { effectiveLevel, riskDiff, riskGrade } from '../ai/index'
import {
  applyCombat, applyDefeat, decisiveRounds, resolveCombat, resolveDefeat,
  type CombatEnemySpec, type CombatKind, type CombatResult, type DefeatResult, type LethalContext,
} from '../combat/index'
import { earnCoins } from '../economy/earn'
import { addJournal } from '../journal/index'
import { relicReturn } from '../succession/relics'
import { considerPickup, markRareGain, stowLoot } from '../items/bag'
import { guaranteedDrop, materializeItem, rollEncounterDrop, type DropSpec } from '../items/roll'
import { thirstOnWin } from '../life/index'
import { characterOf, type RuleContext } from '../rules/context'
import { addXp } from '../rules/growth'
import { modValue } from '../rules/modifiers'
import { weightedPick, type Rng } from '../rules/random'
import { breathe, potionsOwned } from '../recovery/index'
import { emptyScope, makeConditionTest, newEffectOutput, runEffects, type EffectRun, type EventScope } from '../events/index'
import type { Effect } from '../schema/index'
import { ageAt } from '../time/index'
import type { World } from '../sim/world'
import { COUNTERS, currentSortie } from './sortie'

export interface EncounterSpec {
  place: string
  enemies: CombatEnemySpec[]
  kind?: CombatKind
  roomIndex?: number
  activity: 'hunt' | 'adventure' | 'dungeon_room'
  coinMult?: number
  dropTable: string
  encounterNo?: number // 첫 출정 보장 드롭(01 §9.5)
  gateEnemy?: string
  lethal?: boolean
  step?: string // 사망 기록의 방·장면 순번
}

export interface EncounterOutcome {
  type: 'encounter'
  combat: CombatResult
  drop: DropSpec | null
  materials: Record<string, number>
  defeat: DefeatResult | null
}

// 장소 조우 표에서 적을 뽑는다. 눈이 오면 계열 가중치 배수(01 §1.3 encounter_weight_mult)
export function pickEnemy(ctx: RuleContext & { rng: { world: Rng } }, place: string): string {
  const r = ctx.content.get('region', place)
  if (r.kind === 'town') throw new Error(`마을에는 조우 표가 없다: ${place}`)
  const weights = r.encounters.map((e) => {
    const family = ctx.content.get('enemy', e.enemy_id).family
    return e.weight * modValue(ctx, `encounter_weight_mult.${family}`, 1)
  })
  return r.encounters[weightedPick(ctx.rng.world, weights)]!.enemy_id
}

// 조우 적 수(1~2체). 2체의 두 번째 적은 첫 번째와 같은 ID(07 §3.1)
export function rollEnemies(world: World, place: string): CombatEnemySpec[] {
  const r = world.content.get('region', place)
  const id = pickEnemy(world, place)
  const pair = r.kind !== 'town' && world.rng.world.chance(r.pair_chance)
  return pair ? [{ id }, { id }] : [{ id }]
}

function lethalContext(world: World, spec: EncounterSpec, combat: CombatResult): LethalContext {
  const ch = characterOf(world)
  const night = world.state.current_activity.sortie?.time_of_day === 'night'
  const diff = riskDiff(world, spec.place, night)
  const gateLevel = spec.gateEnemy ? world.content.get('enemy', spec.gateEnemy).level : 0
  return {
    source: spec.gateEnemy ?? spec.place,
    activity: spec.activity,
    step: spec.step ?? null,
    risk_diff: diff,
    risk_grade: riskGrade(world.content, diff),
    gate_level: gateLevel,
    effective_level: effectiveLevel(world),
    potions_at_start: potionsOwned(world).reduce((s, p) => s + p.count, 0),
    hp_start_ratio: combat.hp_start / combat.max_hp,
    injuries_at_start: ch.injuries.map((i) => ({ grade: i.grade, stat: i.stat })),
    decisive: decisiveRounds(combat.rounds),
  }
}

// 확정: 전투 → (승리면) 드롭·재료 / (패배면) 구조·손실
export function resolveEncounterStep(world: World, spec: EncounterSpec): EncounterOutcome {
  const regionLevel = world.content.get('region', spec.place).kind === 'town'
    ? characterOf(world).level
    : (world.content.get('region', spec.place) as { level_mid: number }).level_mid
  const combat = resolveCombat(world, {
    enemies: spec.enemies,
    regionLevel,
    ...(spec.kind ? { kind: spec.kind } : {}),
    ...(spec.roomIndex !== undefined ? { roomIndex: spec.roomIndex } : {}),
    activity: spec.activity,
    ...(spec.coinMult !== undefined ? { coinMult: spec.coinMult } : {}),
  })
  const out: EncounterOutcome = { type: 'encounter', combat, drop: null, materials: {}, defeat: null }
  if (combat.outcome === 'defeat') {
    out.defeat = resolveDefeat(world, {
      regionId: spec.place,
      regionLevel,
      cause: 'combat',
      lethal: spec.lethal ? lethalContext(world, spec, combat) : null,
    })
    return out
  }
  // 재료(07 §3.3): 등급별 드롭 확률
  const rates = world.content.balance.economy.material_drop
  for (const r of combat.rewards) {
    if (r.result !== 'defeated') continue
    const def = world.content.get('enemy', r.enemy_id)
    if (!def.material_id) continue
    if (world.rng.loot.chance(rates[r.rank])) out.materials[def.material_id] = (out.materials[def.material_id] ?? 0) + 1
  }
  if (combat.outcome === 'win') {
    out.drop = rollEncounterDrop(world, world.rng.loot, {
      table: spec.dropTable,
      location: spec.place,
      ...(spec.gateEnemy ? { gateEnemy: spec.gateEnemy } : {}),
      ...(spec.encounterNo !== undefined ? { encounterNo: spec.encounterNo } : {}),
    })
  } else if (spec.encounterNo !== undefined) {
    // 첫 출정 보장 드롭(01 §9.5)은 그 조우 번호에 반드시 준다. 난수를 쓰지 않으므로 소비량이 달라지지 않는다
    out.drop = guaranteedDrop(world, spec.encounterNo)
  }
  return out
}

// 판정 종류의 실패·부분 성공 기본 결과를 실행한다(I45)
export function runSavedEffects(world: World, effects: readonly unknown[], scope: EventScope): void {
  if (!effects.length) return
  const test = makeConditionTest(world, scope)
  const run: EffectRun = {
    w: world, ports: world.ports, scope, test,
    rule: { content: world.content, state: world.state, test },
    pre: { dice: {}, chance: {} }, rewardMult: 1, out: newEffectOutput(),
  }
  runEffects(run, effects as Effect[], 'activity/check')
  for (const d of run.out.journal) addJournal(world, d)
}

// 적용: 전투 결과 → 판정 기본 결과 → 보상 → 재료·드롭 → 패배 처리. 숨 고르기는 부르는 쪽이 한다
export function applyEncounterStep(world: World, spec: EncounterSpec, out: EncounterOutcome): void {
  const ch = characterOf(world)
  const scope = emptyScope(spec.place)
  applyCombat(world, out.combat)
  runSavedEffects(world, out.combat.check_effects, scope)
  const sortie = world.state.current_activity.sortie
  const coins = out.combat.rewards.reduce((s, r) => s + r.coins, 0)
  const xp = out.combat.rewards.reduce((s, r) => s + r.xp, 0)
  earnCoins(world, coins)
  if (sortie) sortie.loot.coins += coins
  if (xp > 0) addXp(world, world.rng.life, xp)
  for (const [id, n] of Object.entries(out.materials)) {
    if (sortie) sortie.loot.materials[id] = (sortie.loot.materials[id] ?? 0) + n
  }
  if (out.drop) {
    const inst = materializeItem(world, out.drop, {
      gen: ch.generation, char_uid: ch.uid, age: ageAt(ch.eff_min, world.content.balance.time), location: spec.place, source: 'drop',
    })
    if (sortie) sortie.loot.item_uids.push(inst.uid)
    pickupLoot(world, inst.uid, spec.place)
  }
  // 의뢰 진행(L06): 같은 장소·같은 적을 쓰러뜨리면 센다
  if (sortie && sortie.quest_wins !== null && ch.quest) {
    const wins = out.combat.rewards.filter((r) => r.result === 'defeated' && r.enemy_id === ch.quest!.enemy_id).length
    if (wins) {
      sortie.quest_wins += wins
      ch.quest.wins += wins
    }
  }
  // 갈증 감소(09 §7.5): 정예·보스 격파는 시간대와 무관, 그 밖의 승리는 전투 1회 단위로 밤에만
  if (out.combat.outcome === 'win') {
    const timeOfDay = sortie?.time_of_day === 'night' ? 'night' : 'day'
    const ranked = out.combat.rewards.filter((r) => r.result === 'defeated' && r.rank !== 'normal')
    const drafts = ranked.length
      ? ranked.flatMap((r) => thirstOnWin(world, { timeOfDay, rank: r.rank }).journal)
      : thirstOnWin(world, { timeOfDay, rank: 'normal' }).journal
    for (const d of drafts) addJournal(world, d)
  }
  if (out.defeat) {
    applyDefeat(world, out.defeat)
    ch.counters[COUNTERS.sortieDefeats] = (ch.counters[COUNTERS.sortieDefeats] ?? 0) + 1
    if (out.defeat.rescuer) addJournal(world, { tag: 'injury', line: out.defeat.rescuer.line, refs: { location_id: spec.place } })
    // 최후 판정 성공(치명 패배에서 판정을 굴려 살아남음)이면 유품 귀환(12 §5.6)
    if (spec.lethal && out.defeat.check && out.defeat.outcome !== 'died') {
      const back = relicReturn(world, spec.place)
      if (back) addJournal(world, back)
    }
  }
}

// 출정 중 얻은 장비(08 §8·§9.3): 개선이면 바로 차고, 아니면 가방에 넣는다(가득 차면 현장 정리).
// 현장에서 판 수는 출정마다 모아 귀환 때 한 줄로 남긴다. 제안한 장비를 그 자리에서 팔았으면 제안 기록은 남기지 않는다
export function pickupLoot(world: World, uid: string, place: string): void {
  const ch = characterOf(world)
  const r = considerPickup(world, uid, { mainPlace: place })
  let sold = r.fieldSold
  let journal = r.journal
  if (!r.equipped) {
    sold += stowLoot(world, uid).fieldSold
    const inv = world.state.inventory
    if (!inv.bag.includes(uid) && !inv.pending_box.includes(uid)) journal = []
  }
  if (sold) ch.counters[COUNTERS.fieldSold] = (ch.counters[COUNTERS.fieldSold] ?? 0) + sold
  for (const d of markRareGain(world, uid, journal)) addJournal(world, d)
}

// 판단 지점 앞 숨 고르기(07 §2). 관문 앞에서는 하지 않는다
export function breather(world: World): number {
  return breathe(world)
}

export const sortieOf = currentSortie
