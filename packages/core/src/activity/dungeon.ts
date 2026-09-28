// 던전(07 §5): 방 생성, 예상 손실률과 다음 방 진입 판단, 방 종류별 처리, 관문 도전.
import { effectiveLevel, gateCleared, gateRiskOk } from '../ai/index'
import { retreatHpRatio } from '../combat/index'
import { earnCoins } from '../economy/earn'
import { addJournal, addToBundle, bundleRow } from '../journal/index'
import { arm, charges, crisisMoment, isArmed, usesLeft } from '../blessing/index'
import { relicReturn } from '../succession/relics'
import { materializeItem, rollDrop } from '../items/roll'
import { checkBonus, checkDc, evaluateCheck, recordCheckUse, regionDc, rollCheck, successChance, type CheckRoll } from '../rules/check'
import { characterOf, type RuleContext } from '../rules/context'
import { addFatigue } from '../rules/fatigue'
import { maxHp } from '../rules/derived'
import { recoveryCoef } from '../rules/growth'
import { modValue } from '../rules/modifiers'
import { weightedPick } from '../rules/random'
import { potionsOwned, restPoint, usePotions } from '../recovery/index'
import { emptyScope, rewardUnits, runJudgment } from '../events/index'
import { ROOM_KINDS, type Effect } from '../schema/index'
import type { JournalDraft } from '../state/journal'
import type { World, ActionResolver, ResolvedDraft } from '../sim/world'
import { applyEncounterStep, pickupLoot, resolveEncounterStep, rollEnemies, runSavedEffects, type EncounterOutcome, type EncounterSpec } from './encounter'
import { tickSortieBody } from './field'
import { addPendingSec, fieldPoint, takePendingSec } from './judgment'
import { DROP_TABLE } from './hunt'
import { line } from './lines'
import { renderTemplate } from '../text/index'
import { ageAt } from '../time/index'
import { beginReturn, currentSortie } from './sortie'

export type RoomKind = (typeof ROOM_KINDS)[number]

// 판정 종류 이름(balance.check_kinds 키). 던전 규칙이 이름으로 부르는 것만 상수로 둔다(I37과 같은 취급)
const CHECKS = { detect: 'trap_detect', disarm: 'trap_disarm' } as const

// ── 예상 손실률(07 §5.5) ──

export interface LossActor {
  effLevel: number
  detectFail: number
  evadeFail: number
  recovery: number
}

function refBonus(ctx: RuleContext, kindId: string, level: number): number {
  const rows = ctx.content.balance.reference_character.check_bonus[kindId] ?? []
  let v = 0
  for (const r of rows) if (level >= r.from_level) v = r.value
  return v
}

// 방 생성 검증의 기준 인물(01 §2.4, D46): 층 중앙값 레벨, 낮 출정, 특성·전문화 없음
export function referenceActor(ctx: RuleContext, place: string): LossActor {
  const r = ctx.content.get('region', place)
  const level = r.kind === 'town' ? 1 : r.level_mid
  const dc = regionDc(ctx, level)
  const fail = (kindId: string): number => 1 - successChance(ctx, dc - refBonus(ctx, kindId, level))
  return { effLevel: level, detectFail: fail(CHECKS.detect), evadeFail: fail('trap_evade'), recovery: 1 }
}

// 실제 인물의 판정 실패 확률
export function characterActor(ctx: RuleContext, place: string, effLevel: number): LossActor {
  const r = ctx.content.get('region', place)
  const level = r.kind === 'town' ? characterOf(ctx).level : r.level_mid
  const dc = regionDc(ctx, level)
  const fail = (kindId: string): number => 1 - successChance(ctx, dc - checkBonus(ctx, kindId).bonus)
  return { effLevel, detectFail: fail(CHECKS.detect), evadeFail: fail('trap_evade'), recovery: recoveryCoef(ctx) }
}

// 방 한 개의 예상 손실률(07 §5.5 표)
export function roomLoss(ctx: RuleContext, place: string, kind: RoomKind, roomIndex: number, a: LossActor): number {
  const b = ctx.content.balance
  const m = b.dungeon.loss_model
  const r = ctx.content.get('region', place)
  if (r.kind !== 'dungeon_floor') return 0
  switch (kind) {
    case 'combat': {
      const levels = r.encounters.map((e) => ctx.content.get('enemy', e.enemy_id).level)
      const avg = levels.reduce((s, x) => s + x, 0) / levels.length + Math.floor(roomIndex / b.combat.dungeon_room_level_div)
      const coef = Math.max(m.level_clamp[0], Math.min(m.level_clamp[1], 1 + m.level_coef * (avg - a.effLevel)))
      return m.combat_base * (1 + r.pair_chance * m.pair_mult) * coef
    }
    case 'trap':
      return a.detectFail * a.evadeFail * m.trap_loss
    case 'rest':
      return -b.recovery.rest_point.hp_ratio * a.recovery
    case 'treasure': {
      const t = r.treasure_table
      const chestShare = t.chest / (t.chest + t.vein)
      return chestShare * b.dungeon.chest.trapped * a.detectFail * m.trap_loss
    }
    case 'event':
      return m.event
  }
}

// 다음 방 종류별 가중치. 직전 방이 휴식이면 휴식 0, 함정이 최대 연속 수를 채웠으면 함정 0(07 §5.2)
export function nextRoomWeights(ctx: RuleContext, place: string, before: readonly RoomKind[], index: number): Record<RoomKind, number> {
  const b = ctx.content.balance.dungeon
  const r = ctx.content.get('region', place)
  if (r.kind !== 'dungeon_floor') throw new Error(`던전 층이 아니다: ${place}`)
  const w = Object.fromEntries(ROOM_KINDS.map((k) => [k, r.room_weights[k] ?? 0])) as Record<RoomKind, number>
  if (index === 0) for (const k of ROOM_KINDS) if (!b.first_room_kinds.includes(k)) w[k] = 0
  for (const k of b.no_repeat) if (before[index - 1] === k) w[k] = 0
  for (const [k, run] of Object.entries(b.max_run) as [RoomKind, number][]) {
    if (index >= run && before.slice(index - run, index).every((x) => x === k)) w[k] = 0
  }
  // 함정 조우 수정자는 상대 가산이다(07 §5.2, D53)
  const trapAdd = modValue(ctx, 'trap_encounter_add', 0)
  if (trapAdd !== 0) w.trap = w.trap * (1 + trapAdd)
  return w
}

// 다음 방의 예상 손실률 E = Σ(가중치 × 손실)/Σ가중치
export function expectedLoss(ctx: RuleContext, place: string, index: number, before: readonly RoomKind[], a: LossActor): number {
  const w = nextRoomWeights(ctx, place, before, index)
  let sum = 0
  let total = 0
  for (const k of ROOM_KINDS) {
    total += w[k]
    sum += w[k] * roomLoss(ctx, place, k, index, a)
  }
  return total > 0 ? sum / total : 0
}

// 방 배열 생성(07 §5.2). 결과는 저장하며 다시 굴리지 않는다
export function generateRooms(world: World, place: string): RoomKind[] {
  const b = world.content.balance.dungeon
  const r = world.content.get('region', place)
  if (r.kind !== 'dungeon_floor') throw new Error(`던전 층이 아니다: ${place}`)
  const ref = referenceActor(world, place)
  const n = world.rng.world.int(r.rooms[0], r.rooms[1]) + addedRooms(world)
  let rooms: RoomKind[] = []
  for (let attempt = 0; attempt <= b.retries; attempt++) {
    rooms = []
    for (let i = 0; i < n; i++) {
      const w = nextRoomWeights(world, place, rooms, i)
      rooms.push(ROOM_KINDS[weightedPick(world.rng.world, ROOM_KINDS.map((k) => w[k]))]!)
    }
    if (n >= b.treasure_guarantee_min_rooms && !rooms.includes('treasure')) {
      const last = rooms.lastIndexOf('combat')
      if (last >= 0) rooms[last] = 'treasure'
    }
    const sum = rooms.reduce((s, k, i) => s + roomLoss(world, place, k, i, ref), 0)
    if (sum <= b.validate_loss_cap) return rooms
  }
  // 재시도를 다 쓰면 예상 손실이 가장 큰 전투 방을 보물 방으로 바꾼다
  let worst = -1
  let worstLoss = -Infinity
  rooms.forEach((k, i) => {
    if (k !== 'combat') return
    const l = roomLoss(world, place, k, i, ref)
    if (l > worstLoss) {
      worstLoss = l
      worst = i
    }
  })
  if (worst >= 0) rooms[worst] = 'treasure'
  return rooms
}

// 사건이 더한 방 수(dungeon_mod add_room)
function addedRooms(world: World): number {
  const mods = world.state.current_activity.sortie?.dungeon_mods ?? []
  return mods.filter((m) => m.op === 'add_room').reduce((s, m) => s + ((m.count as number) ?? 1), 0)
}

// ── 다음 방 진입 판단(07 §5.5) ──

// 가용 체력률 = 현재/최대 + 가장 큰 회복약 N개 회복량/최대
export function availableHpRatio(ctx: RuleContext, potionCount: number): number {
  const ch = characterOf(ctx)
  const max = maxHp(ctx)
  const pots = potionsOwned(ctx).slice().reverse()
  let add = 0
  let left = potionCount
  for (const p of pots) {
    const take = Math.min(left, p.count)
    add += take * p.amount
    left -= take
    if (left <= 0) break
  }
  return ch.hp / max + add / max
}

export function nextRoomOk(world: World): boolean {
  const s = currentSortie(world)
  if (!('rooms' in s.plan) || s.progress >= s.plan.rooms.length) return false
  const att = world.content.get('attitude', world.state.policies.attitude)
  const actor = characterActor(world, s.location_id, effectiveLevel(world))
  const e = expectedLoss(world, s.location_id, s.progress, s.plan.rooms, actor)
  const avail = availableHpRatio(world, att.potion_reserve_n)
  const fatigueCost = world.content.balance.actions.dungeon_room.fatigue
  const ch = characterOf(world)
  return avail - att.dungeon_safety_k * e >= retreatHpRatio(world) && ch.fatigue + fatigueCost < att.return_fatigue
}

// ── 관문(07 §5.6) ──

// 관문 앞 준비: 체력이 낮으면 회복약을 최대 max_potions개까지 마신다
export function gatePrep(world: World): number {
  const cfg = world.content.balance.dungeon.gate_prep
  const ch = characterOf(world)
  const max = maxHp(world)
  let used = 0
  while (used < cfg.max_potions && ch.hp < max * cfg.hp_below) {
    const before = ch.hp
    const n = usePotions(world, cfg.hp_below - world.content.balance.activity_ai.potion_margin).length
    if (!n || ch.hp === before) break
    used += n
  }
  const s = world.state.current_activity.sortie
  if (s) s.potions_used += used
  addPendingSec(world, used * world.content.balance.actions.potion_sec) // 한 병에 3초(04 §7.6)
  return used
}

// 방침 `가호 자동 사용 = 최후의 순간만`(01 §18.2, 04 §10.3 8번): 치명 관문 앞에서 별빛 2개 이상이면 스스로 걸어 둔다
function autoArmFinal(world: World): void {
  if (world.state.policies.blessing_auto !== 'final_only') return
  const r = world.content.get('region', currentSortie(world).location_id)
  if (r.kind !== 'dungeon_floor' || !r.gate.lethal || isArmed(world, 'final_save')) return
  if (charges(world) >= world.content.balance.blessing.costs.final_save && usesLeft(world) > 0) arm(world, 'final_save')
}

export function gateAllowed(world: World): boolean {
  const s = currentSortie(world)
  const r = world.content.get('region', s.location_id)
  if (r.kind !== 'dungeon_floor') return false
  // 이미 격파한 층의 관문 자리는 관문 잔당이라 위험 조건을 다시 본다(07 §4.5)
  const att = world.content.get('attitude', world.state.policies.attitude)
  if (!gateRiskOk(world, s.location_id, s.time_of_day === 'night') && !gateCleared(world, s.location_id)) return false
  if (gateCleared(world, s.location_id)) {
    // 잔당은 치명이 아니고 일반 관문 한도를 쓴다
    const lv = world.content.get('enemy', r.gate.remnant.enemy_id).level
    if (lv + Math.floor(('rooms' in s.plan ? s.plan.rooms.length : 0) / world.content.balance.dungeon.remnant.level_div) - effectiveLevel(world) > att.gate_risk_limit) return false
  }
  return availableHpRatio(world, att.potion_reserve_n) >= att.gate_hp_ratio
}

export function gateTurnBackJournal(world: World): JournalDraft {
  const s = currentSortie(world)
  const r = world.content.get('region', s.location_id)
  if (r.kind !== 'dungeon_floor') throw new Error('던전 층이 아니다')
  const lines = r.gate.lines
  if (r.gate.lethal && !world.state.policies.lethal_allowed && lines.lethal_blocked) {
    return { tag: 'dungeon', line: lines.lethal_blocked.line, detail: lines.lethal_blocked.detail, refs: { location_id: s.location_id } }
  }
  return { tag: 'dungeon', line: lines.turn_back, detail: line(world.content, 'gate_turn_back_detail', { name: characterOf(world).name, place: r.name }), refs: { location_id: s.location_id } }
}

// ── 방 처리 ──

export type RoomPayload =
  | { kind: 'combat'; enc: EncounterOutcome; spec: EncounterSpec }
  | { kind: 'trap'; trap: string; result: 'detect' | 'disarm' | 'evade' | 'fail'; checks: CheckRoll[]; effects: Effect[]; parts: number }
  | { kind: 'rest' }
  | { kind: 'treasure'; vein: boolean; opened: boolean; coins: number; material: string | null; drop: ReturnType<typeof rollDrop>; checks: CheckRoll[]; effects: Effect[] }
  | { kind: 'event' }

function trapPayload(world: World, place: string): RoomPayload {
  const r = world.content.get('region', place)
  if (r.kind !== 'dungeon_floor') throw new Error('던전 층이 아니다')
  const level = r.level_mid
  const base = regionDc(world, level)
  const t = world.content.get('trap', r.trap_table[weightedPick(world.rng.world, r.trap_table.map((x) => x.weight))]!.trap_id)
  const att = world.content.get('attitude', world.state.policies.attitude)
  const checks: CheckRoll[] = []
  const roll = (kindId: string, dc: number): CheckRoll => {
    const c = rollCheck(world, world.rng.world, { kinds: [kindId], dc })
    checks.push(c)
    return c
  }
  const pass = (c: CheckRoll): boolean => c.result === 'success' || c.result === 'crit_success'
  const detect = roll(CHECKS.detect, base + t.detect_dc_offset)
  let evadeBonus = 0
  if (pass(detect)) {
    if (t.disarm_dc_offset === null || !world.test(att.disarm_when)) {
      return { kind: 'trap', trap: t.id, result: 'detect', checks, effects: [], parts: 0 }
    }
    const dis = roll(CHECKS.disarm, base + t.disarm_dc_offset)
    if (pass(dis) || dis.result === 'partial') {
      const extra = dis.result === 'partial' ? (world.content.balance.check_kinds[CHECKS.disarm]?.partial_effects ?? []) : []
      return { kind: 'trap', trap: t.id, result: 'disarm', checks, effects: [...extra] as Effect[], parts: world.content.balance.dungeon.trap_flow.disarm_parts_units }
    }
    evadeBonus = world.content.balance.dungeon.trap_flow.disarm_fail_evade_bonus
  }
  // 회피 판정이 없는 함정(경보 종줄)은 바로 실패 효과를 받는다(07 §5.3)
  if (t.evade === null) return { kind: 'trap', trap: t.id, result: 'fail', checks, effects: [...(t.fail as Effect[])], parts: 0 }
  const evade = roll(t.evade.check, base + t.evade.dc_offset - evadeBonus)
  if (pass(evade)) return { kind: 'trap', trap: t.id, result: 'evade', checks, effects: [], parts: 0 }
  const mult = evade.result === 'partial' ? (world.content.balance.check_kinds[t.evade.check]?.partial_mult ?? 0.5) : 1
  const effects = (t.fail as Effect[]).map((e) => scaleEffect(e, mult))
  return { kind: 'trap', trap: t.id, result: 'fail', checks, effects, parts: 0 }
}

// 부분 성공 비용(05 §6.1 partial_mult): 피해·피로를 절반으로 줄인다
function scaleEffect(e: Effect, mult: number): Effect {
  if (mult === 1) return e
  const x = e as unknown as Record<string, unknown>
  const out: Record<string, unknown> = { ...x }
  for (const k of ['hp', 'hp_ratio', 'value']) if (typeof x[k] === 'number') out[k] = (x[k] as number) * mult
  return out as Effect
}

function treasurePayload(world: World, place: string): RoomPayload {
  const b = world.content.balance
  const r = world.content.get('region', place)
  if (r.kind !== 'dungeon_floor') throw new Error('던전 층이 아니다')
  const base = regionDc(world, r.level_mid)
  const checks: CheckRoll[] = []
  const roll = (kindId: string, dc: number): CheckRoll => {
    const c = rollCheck(world, world.rng.world, { kinds: [kindId], dc })
    checks.push(c)
    return c
  }
  const pass = (c: CheckRoll): boolean => c.result === 'success' || c.result === 'crit_success'
  const t = r.treasure_table
  const vein = !world.rng.world.chance(t.chest / (t.chest + t.vein))
  const unit = rewardUnits(world, place).coins
  if (vein) {
    const c = roll(b.dungeon.vein.check, base)
    const units = pass(c) ? b.dungeon.vein.coin_units
      : c.result === 'partial' ? b.dungeon.vein.coin_units * (b.check_kinds[b.dungeon.vein.check]?.partial_mult ?? 0.5)
      : b.dungeon.vein.fail_units
    const effects = pass(c) || c.result === 'partial' ? [] : ((b.check_kinds[b.dungeon.vein.check]?.fail_effects ?? []) as Effect[])
    return {
      kind: 'treasure', vein: true, opened: true, coins: Math.round(units * unit * modValue(world, 'mining_reward_mult', 1)),
      material: materialBySource(world, 'vein'), drop: null, checks, effects: [...effects],
    }
  }
  const chest = b.dungeon.chest
  let opened = true
  if (world.rng.world.chance(chest.locked)) {
    opened = false
    for (let i = 0; i < chest.lock_tries && !opened; i++) opened = pass(roll(CHECKS.disarm, base))
    if (!opened && world.content.get('attitude', world.state.policies.attitude).chest_break) {
      opened = pass(roll(chest.break.check, base + chest.break.dc_offset))
    }
  }
  const effects: Effect[] = []
  if (opened && world.rng.world.chance(chest.trapped) && !pass(roll(CHECKS.detect, base))) effects.push(...(chest.trap_fail as Effect[]))
  const drop = opened ? rollDrop(world, world.rng.loot, { table: DROP_TABLE.chest, location: place, room: 'treasure' }) : null
  return {
    kind: 'treasure', vein: false, opened,
    coins: opened ? Math.round(chest.coin_units * unit) : 0,
    material: opened ? world.content.get('enemy', r.encounters[0]!.enemy_id).material_id ?? null : null,
    drop, checks, effects,
  }
}

// 고정 출처(trap·forage·vein)를 가진 재료 정의(07 §3.3)
export function materialBySource(ctx: RuleContext, source: 'trap' | 'forage' | 'vein'): string | null {
  return ctx.content.list('material').find((m) => m.source === source)?.id ?? null
}

// 지금 방(s.progress)의 문 여는 기록
function roomDoorJournal(world: World): JournalDraft {
  const s = currentSortie(world)
  const depth = s.progress + 1
  return {
    tag: 'dungeon',
    line: line(world.content, 'dungeon_room', { depth }, s.progress),
    detail: line(world.content, 'dungeon_room_detail', { name: characterOf(world).name, place: world.content.get('region', s.location_id).name, depth }, s.progress),
    refs: { location_id: s.location_id, sortie_id: s.id },
  }
}

// 방 1개를 확정한다
export function resolveRoom(world: World): { payload: RoomPayload; sec: number; journal: JournalDraft[]; outcome: string } {
  const b = world.content.balance
  const s = currentSortie(world)
  const place = s.location_id
  if (!('rooms' in s.plan)) throw new Error('던전 출정이 아니다')
  const kind = s.plan.rooms[s.progress]!
  const sec = world.rng.world.int(b.actions.dungeon_room.sec[0], b.actions.dungeon_room.sec[1]) + b.actions.breather.sec[0]
  const journal = [roomDoorJournal(world)]
  if (kind === 'combat') {
    const spec: EncounterSpec = {
      place, enemies: rollEnemies(world, place), activity: 'dungeon_room', roomIndex: s.progress,
      coinMult: b.dungeon.room_coin_mult, dropTable: DROP_TABLE.dungeon, step: String(s.progress + 1),
    }
    const enc = resolveEncounterStep(world, spec)
    // 전투 방은 문 여는 기록을 바로 남기지 않고 적용 때 묶는다(14 §4 연속 전투 방 3개까지)
    return { payload: { kind: 'combat', enc, spec }, sec, journal: [], outcome: enc.combat.outcome }
  }
  if (kind === 'trap') return { payload: trapPayload(world, place), sec, journal, outcome: 'trap' }
  if (kind === 'treasure') return { payload: treasurePayload(world, place), sec, journal, outcome: 'treasure' }
  if (kind === 'rest') return { payload: { kind: 'rest' }, sec: b.recovery.rest_point.sec, journal, outcome: 'rest' }
  return { payload: { kind: 'event' }, sec, journal, outcome: 'event' }
}

function applyRoom(world: World, payload: RoomPayload, place: string): void {
  const b = world.content.balance
  const ch = characterOf(world)
  const s = currentSortie(world)
  const scope = emptyScope(place)
  switch (payload.kind) {
    case 'combat': {
      // 방을 먼저 묶음에 넣어야 이 방의 드롭·성장(B 이상) 기록이 이 방까지 담은 묶음을 닫는다(14 §4)
      const c = payload.enc.combat
      addToBundle(world, {
        tag: 'dungeon',
        single: roomDoorJournal(world),
        coins: c.rewards.reduce((a, r) => a + r.coins, 0),
        depth: s.progress + 1,
        row: bundleRow(world.content, world.content.get('enemy', payload.spec.enemies[0]!.id).name, c.round_count, c.hp_start - c.hp_end),
      })
      applyEncounterStep(world, payload.spec, payload.enc)
      break
    }
    case 'trap': {
      for (const c of payload.checks) recordCheckUse(world, c)
      runSavedEffects(world, payload.effects, scope)
      const t = world.content.get('trap', payload.trap)
      // 마지막 판정(감지·해제·회피)을 기록에 달아 세부 내역에 식이 보이게 한다(14 §5.1, D77)
      const last = payload.checks.at(-1)
      addJournal(world, { tag: 'dungeon', line: t.lines[payload.result === 'fail' ? 'fail' : payload.result], ...(last ? { check: last.record } : {}), refs: { location_id: place } })
      if (payload.parts) {
        const id = materialBySource(world, 'trap')
        if (id) s.loot.materials[id] = (s.loot.materials[id] ?? 0) + 1
        const coins = Math.round(payload.parts * rewardUnits(world, place).coins)
        earnCoins(world, coins)
        s.loot.coins += coins
      }
      break
    }
    case 'rest':
      restPoint(world)
      break
    case 'treasure': {
      for (const c of payload.checks) recordCheckUse(world, c)
      runSavedEffects(world, payload.effects, scope)
      if (payload.coins) {
        earnCoins(world, payload.coins)
        s.loot.coins += payload.coins
      }
      if (payload.material) s.loot.materials[payload.material] = (s.loot.materials[payload.material] ?? 0) + b.dungeon.chest.material
      if (payload.drop) {
        const inst = materializeItem(world, payload.drop, {
          gen: ch.generation, char_uid: ch.uid, age: ageAt(ch.eff_min, b.time), location: place, source: 'chest',
        })
        s.loot.item_uids.push(inst.uid)
        pickupLoot(world, inst.uid, place)
      }
      break
    }
    case 'event': {
      const r = runJudgment(world, { trigger: 'dungeon_event_room', place }, world.ports)
      if (!r) {
        const region = world.content.get('region', place)
        addFatigue(world, b.events.quiet_room.fatigue)
        addJournal(world, {
          tag: 'dungeon',
          line: (region.kind === 'dungeon_floor' ? region.quiet_line : undefined) ?? b.events.quiet_room.line,
          detail: line(world.content, 'dungeon_quiet_detail', { name: ch.name, place: region.name }),
          refs: { location_id: place },
        })
      }
      break
    }
  }
}

// 방 뒤 사건 검사 종류(04 §2.3 J4, D38)
function afterRoomTrigger(kind: RoomKind): 'dungeon_after_room' | 'camp' | null {
  if (kind === 'trap' || kind === 'event') return null
  return kind === 'rest' ? 'camp' : 'dungeon_after_room'
}

export const roomResolver: ActionResolver = {
  resolve(world: World): ResolvedDraft {
    const { payload, sec, journal, outcome } = resolveRoom(world)
    return { duration_sec: sec + takePendingSec(world), outcome, effects: [payload as unknown as { type: string }], journal }
  },
  apply(world: World, action): void {
    const payload = action.effects[0] as unknown as RoomPayload
    const s = currentSortie(world)
    const place = s.location_id
    applyRoom(world, payload, place)
    addFatigue(world, world.content.balance.actions.dungeon_room.fatigue)
    tickSortieBody(world, action.duration_sec / 60)
    s.progress += 1
    if (payload.kind === 'combat' && payload.enc.defeat) {
      world.state.current_activity.state = 'return'
      return
    }
    const hasNext = 'rooms' in s.plan && s.progress < s.plan.rooms.length
    // 다음 방 진입 판단은 사건 검사·회복약 자동 사용 뒤에 잰다(04 §2.3 D39). 값이 아니라 함수로 넘긴다
    const d = fieldPoint(world, afterRoomTrigger(payload.kind), { nextRoomOk: () => (hasNext ? nextRoomOk(world) : true) })
    if (d !== 'continue' || world.state.pending_choice) return
    if (!hasNext) {
      gatePrep(world)
      autoArmFinal(world)
      if (!gateAllowed(world)) {
        addJournal(world, gateTurnBackJournal(world))
        beginReturn(world)
      }
    }
  },
}

// ── 관문 행동 ──

export const gateResolver: ActionResolver = {
  resolve(world: World): ResolvedDraft {
    const b = world.content.balance
    const s = currentSortie(world)
    const r = world.content.get('region', s.location_id)
    if (r.kind !== 'dungeon_floor') throw new Error('던전 층이 아니다')
    const cleared = gateCleared(world, s.location_id)
    const rooms = 'rooms' in s.plan ? s.plan.rooms.length : 0
    const spec: EncounterSpec = cleared
      ? {
        place: s.location_id,
        enemies: [{ id: r.gate.remnant.enemy_id, level: world.content.get('enemy', r.gate.remnant.enemy_id).level + Math.floor(rooms / b.dungeon.remnant.level_div), rank: b.dungeon.remnant.rank }],
        kind: 'elite_gate', activity: 'dungeon_room', coinMult: b.dungeon.room_coin_mult, dropTable: DROP_TABLE.elite,
        gateEnemy: r.gate.remnant.enemy_id, step: 'gate',
      }
      : {
        place: s.location_id,
        enemies: [{ id: r.gate.enemy_id }],
        kind: world.content.get('enemy', r.gate.enemy_id).rank === 'boss' ? 'boss_gate' : 'elite_gate',
        activity: 'dungeon_room', coinMult: b.dungeon.room_coin_mult,
        dropTable: world.content.get('enemy', r.gate.enemy_id).rank === 'boss' ? DROP_TABLE.boss : DROP_TABLE.elite,
        gateEnemy: r.gate.enemy_id, lethal: r.gate.lethal, step: 'gate',
      }
    const enc = resolveEncounterStep(world, spec)
    const sec = world.rng.world.int(b.actions.gate.sec[0], b.actions.gate.sec[1]) + takePendingSec(world)
    const enemy = world.content.get('enemy', spec.enemies[0]!.id)
    const journal: JournalDraft[] = enc.combat.outcome === 'win'
      ? [{
        tag: 'dungeon', importance: 'major', ...(cleared ? {} : { sub: 'gate_first' as const }),
        line: renderTemplate(enemy.victory_lines[0]!, { enemy: enemy.name }),
        detail: line(world.content, 'dungeon_gate_detail', { enemy: enemy.name, place: r.name }),
        refs: { location_id: s.location_id, sortie_id: s.id },
      }]
      : [{ tag: 'dungeon', line: line(world.content, 'dungeon_gate', {}, 0), detail: line(world.content, 'gate_lost_detail', { enemy: enemy.name, place: r.name }), refs: { location_id: s.location_id } }]
    return { duration_sec: sec, outcome: enc.combat.outcome, effects: [{ kind: 'gate', enc, spec, cleared } as unknown as { type: string }], journal }
  },
  apply(world: World, action): void {
    const payload = action.effects[0] as unknown as { enc: EncounterOutcome; spec: EncounterSpec; cleared: boolean }
    const s = currentSortie(world)
    const r = world.content.get('region', s.location_id)
    applyEncounterStep(world, payload.spec, payload.enc)
    addFatigue(world, world.content.balance.actions.gate.fatigue)
    tickSortieBody(world, action.duration_sec / 60)
    // 관문 첫 격파 보상(07 §5.6)과 유품 귀환(12 §5.6). 관문 기록은 apply 전에 남아 유품 기록이 그 뒤에 온다
    if (!payload.cleared && payload.enc.combat.outcome === 'win') {
      crisisMoment(world) // 극복 순간 2: 이 인물의 관문 첫 격파(01 §19)
      if (r.kind === 'dungeon_floor' && r.gate.first_clear) runSavedEffects(world, r.gate.first_clear, emptyScope(s.location_id))
      const back = relicReturn(world, s.location_id)
      if (back) addJournal(world, back)
    }
    beginReturn(world)
  },
}
