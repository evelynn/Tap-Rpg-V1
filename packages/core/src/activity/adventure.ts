// 모험 장면(07 §6): 장면 뽑기, 발견·길 선택·채집·조우·사건 처리.
import { earnCoins } from '../economy/earn'
import { addJournal } from '../journal/index'
import { characterOf, type RuleContext } from '../rules/context'
import { addFatigue } from '../rules/fatigue'
import { addXp } from '../rules/growth'
import { modValue } from '../rules/modifiers'
import { weightedPick } from '../rules/random'
import { regionDc, recordCheckUse, rollCheck, type CheckRoll } from '../rules/check'
import { tickSortieBody } from './field'
import { emptyScope, rewardUnits, runJudgment } from '../events/index'
import { SCENE_KINDS, type Effect } from '../schema/index'
import type { JournalDraft } from '../state/journal'
import type { ActionResolver, ResolvedDraft, World } from '../sim/world'
import { materialBySource } from './dungeon'
import { applyEncounterStep, resolveEncounterStep, rollEnemies, runSavedEffects, type EncounterOutcome, type EncounterSpec } from './encounter'
import { DROP_TABLE } from './hunt'
import { fieldPoint, takePendingSec } from './judgment'
import { line } from './lines'
import { currentSortie } from './sortie'

export type SceneKind = (typeof SCENE_KINDS)[number]

// 길 선택 성공이 다음 장면을 발견으로 확정한다(07 §6.2)
const FORCED_SCENE_FLAG = 'trip.forced_next_scene'

export function routeOf(ctx: RuleContext, place: string) {
  const r = ctx.content.get('region', place)
  if (r.kind !== 'adventure_route') throw new Error(`모험 경로가 아니다: ${place}`)
  return r
}

// 아직 발견하지 않았고 조건이 맞는 지점
export function openDiscoveries(world: World, place: string) {
  const ch = characterOf(world)
  const s = world.state.current_activity.sortie
  return routeOf(world, place).discoveries.filter(
    (d) => !ch.discoveries.includes(d.id) && world.test(d.condition) && !(s?.discovery_attempts.includes(d.id) ?? false),
  )
}

// 장면 종류 뽑기. 발견 가중치에 discovery_chance_mult(안개·나침반)를 곱한다(07 §6.1·§6.2)
export function pickScene(world: World, place: string): SceneKind {
  const s = currentSortie(world)
  const forced = s.trip_flags[FORCED_SCENE_FLAG]
  let kind: SceneKind
  if (forced?.value) {
    delete s.trip_flags[FORCED_SCENE_FLAG]
    kind = world.content.balance.adventure.path.success_next_scene
  } else {
    const r = routeOf(world, place)
    const w = SCENE_KINDS.map((k) => (r.scene_weights[k] ?? 0) * (k === 'discovery' ? modValue(world, 'discovery_chance_mult', 1) : 1))
    kind = SCENE_KINDS[weightedPick(world.rng.world, w)]!
  }
  // 남은 발견이 없으면 채집 장면으로 바꾼다(07 §6.2)
  if (kind === 'discovery' && !openDiscoveries(world, place).length) return 'forage'
  return kind
}

export type ScenePayload =
  | { kind: 'discovery'; discovery: string; ok: boolean; check: CheckRoll }
  | { kind: 'path'; shortcut: boolean; ok: boolean; check: CheckRoll | null; effects: Effect[] }
  | { kind: 'forage'; ok: boolean; check: CheckRoll; coins: number; potion: boolean }
  | { kind: 'encounter'; enc: EncounterOutcome; spec: EncounterSpec }
  | { kind: 'event' }

const pass = (c: CheckRoll): boolean => c.result === 'success' || c.result === 'crit_success'

function scenePayload(world: World, place: string, kind: SceneKind): ScenePayload {
  const b = world.content.balance
  const ch = characterOf(world)
  const r = routeOf(world, place)
  const base = regionDc(world, r.level_mid)
  switch (kind) {
    case 'discovery': {
      const open = openDiscoveries(world, place)
      const d = open[world.rng.world.bounded(open.length)]!
      const bonus = ch.discovery_fail_bonus[d.id] ?? 0
      const dc = base + b.check.dc_step[d.dc.grade] - bonus
      const check = rollCheck(world, world.rng.world, { kinds: [d.check], dc })
      return { kind: 'discovery', discovery: d.id, ok: pass(check), check }
    }
    case 'path': {
      const att = world.content.get('attitude', world.state.policies.attitude)
      const forced = att.shortcut.force_when !== undefined && world.test(att.shortcut.force_when)
      const shortcut = forced || world.rng.world.chance(att.shortcut.chance)
      if (!shortcut) return { kind: 'path', shortcut: false, ok: true, check: null, effects: [] }
      const check = rollCheck(world, world.rng.world, { kinds: [b.adventure.path.check], dc: base })
      const ok = pass(check)
      const partial = check.result === 'partial'
      const effects = ok ? [] : partial ? ((b.check_kinds[b.adventure.path.check]?.partial_effects ?? []) as Effect[]) : (b.adventure.path.fail as Effect[])
      return { kind: 'path', shortcut: true, ok, check, effects: [...effects] }
    }
    case 'forage': {
      const check = rollCheck(world, world.rng.world, { kinds: [b.adventure.forage.check], dc: base })
      const mult = pass(check) ? 1 : check.result === 'partial' ? (b.check_kinds[b.adventure.forage.check]?.partial_mult ?? 0.5) : 0
      const coins = Math.round(b.adventure.forage.coin_units * mult * rewardUnits(world, place).coins * modValue(world, 'forage_reward_mult', 1))
      return { kind: 'forage', ok: mult > 0, check, coins, potion: check.result === 'crit_success' }
    }
    case 'encounter': {
      const spec: EncounterSpec = { place, enemies: rollEnemies(world, place), activity: 'adventure', dropTable: DROP_TABLE.hunt }
      return { kind: 'encounter', enc: resolveEncounterStep(world, spec), spec }
    }
    default:
      return { kind: 'event' }
  }
}

function applyScene(world: World, payload: ScenePayload, place: string): void {
  const b = world.content.balance
  const ch = characterOf(world)
  const s = currentSortie(world)
  const scope = emptyScope(place)
  const unit = rewardUnits(world, place)
  switch (payload.kind) {
    case 'discovery': {
      recordCheckUse(world, payload.check)
      s.discovery_attempts.push(payload.discovery)
      if (payload.ok) {
        // 가문 수첩에 이미 적힌 지점을 후손이 다시 찾으면 '가문 최초'가 아니다(07 §6.5, 12 §7.4)
        const familyFirst = !world.state.family.discovery_points.includes(payload.discovery)
        world.ports.discovery.reveal(world, payload.discovery, scope)
        addXp(world, world.rng.life, Math.floor(b.adventure.discovery_xp_units * unit.xp))
        const d = routeOf(world, place).discoveries.find((x) => x.id === payload.discovery)!
        addJournal(world, {
          tag: 'discovery',
          line: line(world.content, 'discovery_place', { place: d.name }, s.progress),
          detail: line(world.content, familyFirst ? 'discovery_place_detail' : 'discovery_place_again_detail', { name: ch.name, place: d.name }, s.progress),
          refs: { location_id: place },
        })
        if (d.map_fragment) addJournal(world, { tag: 'discovery', line: line(world.content, 'adventure_map'), detail: line(world.content, 'adventure_map_detail', { name: ch.name }) })
      } else {
        const cfg = b.adventure.discovery
        ch.discovery_fail_bonus[payload.discovery] = Math.min(cfg.fail_bonus_cap, (ch.discovery_fail_bonus[payload.discovery] ?? 0) + cfg.fail_bonus_step)
      }
      break
    }
    case 'path': {
      if (payload.check) recordCheckUse(world, payload.check)
      if (!payload.shortcut) addFatigue(world, b.adventure.path.detour_fatigue)
      else if (payload.ok) s.trip_flags[FORCED_SCENE_FLAG] = { value: true, remaining: null }
      runSavedEffects(world, payload.effects, scope)
      break
    }
    case 'forage': {
      recordCheckUse(world, payload.check)
      if (payload.coins > 0) {
        const id = materialBySource(world, 'forage')
        if (id) s.loot.materials[id] = (s.loot.materials[id] ?? 0) + 1
        earnCoins(world, payload.coins)
        s.loot.coins += payload.coins
      }
      if (!payload.ok) runSavedEffects(world, (b.check_kinds[b.adventure.forage.check]?.fail_effects ?? []) as Effect[], scope)
      if (payload.potion) world.ports.item.addConsumable(world, { tier: 'current', count: b.adventure.forage.crit_potion }, scope)
      break
    }
    case 'encounter':
      applyEncounterStep(world, payload.spec, payload.enc)
      return // 조우 장면의 경험치·동전은 전투가 준다
    case 'event': {
      const r = runJudgment(world, { trigger: 'adventure_event_scene', place }, world.ports)
      if (!r) {
        // 후보가 없으면 채집 장면으로 바꾼다(07 §6.2)
        applyScene(world, scenePayload(world, place, 'forage'), place)
        return
      }
      break
    }
  }
  // 비전투 장면의 기본 보상(07 §6.1)
  const coins = Math.round(b.adventure.scene_coin_units * unit.coins)
  earnCoins(world, coins)
  s.loot.coins += coins
  addXp(world, world.rng.life, Math.floor(unit.xp * b.xp.activity_mult.adventure))
}

export const sceneResolver: ActionResolver = {
  resolve(world: World): ResolvedDraft {
    const b = world.content.balance
    const s = currentSortie(world)
    const place = s.location_id
    const kind = pickScene(world, place)
    const payload = scenePayload(world, place, kind)
    const sec = world.rng.world.int(b.actions.adventure_scene.sec[0], b.actions.adventure_scene.sec[1]) + takePendingSec(world)
    const journal: JournalDraft[] = [{
      tag: 'adventure',
      line: line(world.content, 'adventure_scene', {}, s.progress),
      detail: line(world.content, 'adventure_scene_detail', {
        name: characterOf(world).name, place: world.content.get('region', place).name,
        feature: routeOf(world, place).feature_words?.[s.progress % Math.max(1, routeOf(world, place).feature_words?.length ?? 1)] ?? '',
      }, s.progress),
      refs: { location_id: place, sortie_id: s.id },
    }]
    return { duration_sec: sec, outcome: kind, effects: [payload as unknown as { type: string }], journal }
  },
  apply(world: World, action): void {
    const payload = action.effects[0] as unknown as ScenePayload
    const s = currentSortie(world)
    applyScene(world, payload, s.location_id)
    addFatigue(world, world.content.balance.actions.adventure_scene.fatigue)
    tickSortieBody(world, action.duration_sec / 60)
    s.progress += 1
    if (payload.kind === 'encounter' && payload.enc.defeat) {
      world.state.current_activity.state = 'return'
      return
    }
    // 모험은 사건 장면에서만 사건을 검사한다(07 §6.2, 10 §3.1)
    fieldPoint(world, null)
  },
}
