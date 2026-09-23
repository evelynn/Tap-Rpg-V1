// 사건 포트 어댑터(ARCHITECTURE §3 포트 구조). 사건 엔진이 events/ports.ts로 요구하는 구조를
// 전투(combat)·회복(recovery)·장비(items)·경제(economy) 구현에 잇는다. 상태를 바꾸는 쪽이라 적용 단계에서만 불린다.
// 아직 구조가 없는 포트(출정 진행 T8, 동반자·자녀 후보 T10)는 호출을 deferred에 모아 두고 그쪽이 바꿔 끼운다.
import type { Condition, Effect, Modifier } from '../schema/index'
import { SLOTS } from '../schema/index'
import type { TempMod } from '../state/common'
import type { ItemInstance } from '../state/inventory'
import { addJournal } from '../journal/index'
import { checkDc, recordCheckUse, rollCheck } from '../rules/check'
import { characterOf, type RuleContext } from '../rules/context'
import type { Stat } from '../rules/derived'
import { addXp } from '../rules/growth'
import { weightedPick, type Rng } from '../rules/random'
import { ageAt } from '../time/index'
import {
  makeConditionTest, newEffectOutput, placeLevel, rewardUnits, ruleContext, runEffects,
  type CombatResult as EventCombatOutcome, type EffectRun, type EventCombatSpec, type EventPorts, type EventScope, type EventWorld,
} from '../events/index'
import { applyCombat, applyDefeat, resolveCombat, resolveDefeat, type CombatEnemySpec, type CombatResult } from '../combat/index'
import { addInjury, carryGroupCount, injuryStat } from '../recovery/index'
import {
  dropCandidates, equipItem, grantItem, itemName, levelTier, materializeItem, NAMED_PREFIX, pickGradeWeighted, placeTier,
  putPending, improvement, rollDrop, rollEffects, rollGrade, stowLoot, suggest, worthSwapping, type Grade,
} from '../items/index'
import { appraisal, basePrice, earnCoins, reserveRatio, shopPriceFactor } from '../economy/index'

// 아직 구현이 없는 포트 호출. 출정 진행(T8)·계승(T10)이 가져간다
export interface DeferredPortCall {
  port: string
  params: unknown
  scope: EventScope
}

export interface SimServices {
  ports: EventPorts
  deferred: DeferredPortCall[]
}

// 난수 흐름까지 가진 문맥(resolveCombat·resolveDefeat가 요구한다)
type RngWorld = RuleContext & { rng: EventWorld['rng'] }

const ctxOf = (w: EventWorld, scope: EventScope): RuleContext => ruleContext(w, makeConditionTest(w, scope))
const rngCtx = (w: EventWorld, rule: RuleContext): RngWorld => ({ ...rule, rng: w.rng })
const acquiredBy = (rule: RuleContext, source: string): ItemInstance['acquired'] => {
  const ch = characterOf(rule)
  return { gen: ch.generation, char_uid: ch.uid, age: ageAt(ch.eff_min, rule.content.balance.time), location: ch.location, source }
}

// 등급을 주지 않은 변동 장비의 굴림 표(I33 4): 던전이면 던전 전투 표, 그 밖은 사냥 표
const dropTableOf = (w: EventWorld, place: string | null): string =>
  place && w.content.get('region', place).kind === 'dungeon_floor' ? 'dungeon_combat' : 'hunt'

// 일시 수정자를 걸고 fn을 부른 뒤 반드시 되돌린다(사건 전투 pre_check 실패 보정 등)
function withMods<T>(rule: RuleContext, mods: readonly Modifier[], fn: () => T): T {
  if (!mods.length) return fn()
  const ch = characterOf(rule)
  const added: TempMod[] = mods.map((m) => ({ modifier: m, scope: 'scene', remaining: null, expires_eff_min: null, source_event: null }))
  ch.temp_mods.push(...added)
  try {
    return fn()
  } finally {
    ch.temp_mods = ch.temp_mods.filter((t) => !added.includes(t))
  }
}

// ── 전투 포트 ──

// 적 목록: enemy_id / by_location / 장소 조우 표(world 흐름, I07). count만큼 앞에서부터 돌려 채운다
function resolveEnemies(w: EventWorld, rule: RuleContext, spec: EventCombatSpec, scope: EventScope): CombatEnemySpec[] {
  const picks = spec.enemies.map((e) => {
    if ('enemy_id' in e) return e.enemy_id
    if ('by_location' in e) {
      const id = e.by_location[scope.place ?? '']
      if (!id) throw new Error(`사건 전투: 장소 ${scope.place}의 적이 by_location에 없다`)
      return id
    }
    const r = w.content.get('region', scope.place ?? '')
    if (r.kind === 'town') throw new Error(`사건 전투: 마을에는 조우 표가 없다(${r.id})`)
    return r.encounters[weightedPick(w.rng.world, r.encounters.map((x) => x.weight))]!.enemy_id
  })
  const count = typeof spec.count === 'number'
    ? spec.count
    : spec.count.find((c) => rule.test(c.when as Condition))?.count ?? 1
  return Array.from({ length: count }, (_, i) => ({ id: picks[i % picks.length]! }))
}

// 전투 전 판정(공포 등). 실패하면 on_fail 수정자를 전투 동안만 건다
function preCheckMods(w: EventWorld, rule: RuleContext, spec: EventCombatSpec, regionLevel: number): Modifier[] {
  const pc = spec.pre_check
  if (!pc) return []
  const dc = checkDc(rule, pc.kind, { regionLevel, dcOffset: pc.dc_offset })
  const roll = rollCheck(rule, w.rng.combat, { kinds: [pc.kind], dc })
  recordCheckUse(rule, roll)
  return roll.result === 'success' || roll.result === 'crit_success' ? [] : (pc.on_fail as Modifier[])
}

// 적 보상(경험치·동전)은 사건 전투가 준다. 활동 보상과 달리 드롭은 없다
function grantCombatRewards(w: EventWorld, rule: RuleContext, r: CombatResult, mult: number): void {
  const coins = Math.floor(r.rewards.reduce((s, x) => s + x.coins, 0) * mult + 1e-9)
  const xp = Math.floor(r.rewards.reduce((s, x) => s + x.xp, 0) * mult + 1e-9)
  earnCoins(rule, coins)
  const loot = w.state.current_activity.sortie?.loot
  if (loot) loot.coins += coins
  if (xp > 0) addXp(rule, w.rng.life, xp)
}

// 판정 종류의 실패·부분 성공 기본 결과(05 §6.1). 전투는 결과만 확정하므로 여기서 효과 실행기에 넘긴다
function runCheckEffects(w: EventWorld, ports: EventPorts, rule: RuleContext, scope: EventScope, effects: readonly unknown[]): void {
  if (!effects.length) return
  const run: EffectRun = { w, ports, scope, test: rule.test, rule, pre: { dice: {}, chance: {} }, rewardMult: 1, out: newEffectOutput() }
  runEffects(run, effects as Effect[], 'combat/check')
  for (const draft of run.out.journal) addJournal(w, draft)
}

function fight(w: EventWorld, spec: EventCombatSpec, scope: EventScope, ports: EventPorts): EventCombatOutcome {
  const rule = ctxOf(w, scope)
  const regionLevel = placeLevel(w, scope.place)
  const mods = preCheckMods(w, rule, spec, regionLevel)
  const enemies = resolveEnemies(w, rule, spec, scope)
  const first = spec.first_strike ?? 'default'
  const ambush = first === 'enemy' ? true : first === 'char' ? false : spec.ambush
  const groups = spec.sequential ? enemies.map((e) => [e]) : [enemies]
  let outcome: EventCombatOutcome = 'win'
  for (const group of groups) {
    const r = withMods(rule, mods, () => resolveCombat(rngCtx(w, rule), {
      enemies: group,
      regionLevel,
      ...(ambush === undefined ? {} : { ambush }),
      ...(first === 'char' ? { stealth: false } : {}),
    }))
    applyCombat(rule, r)
    runCheckEffects(w, ports, rule, scope, r.check_effects)
    grantCombatRewards(w, rule, r, spec.reward_mult ?? 1)
    if (r.outcome === 'win') continue
    // 도주는 물러난 것으로 보고 패배 결과를 쓰되 패배 처리(구조자·손실)는 하지 않는다
    if (r.outcome === 'defeat') {
      const d = resolveDefeat(rngCtx(w, rule), { regionId: scope.place ?? characterOf(rule).location, cause: 'combat' })
      applyDefeat(rule, d)
    }
    outcome = r.outcome === 'stalemate' ? 'stalemate' : 'defeat'
    break
  }
  return outcome
}

// ── 장비 포트 ──

// 저장 record 순회 순서에 기대지 않는다: 장착은 SLOTS 순서(ARCHITECTURE §3)
const ownedUids = (rule: RuleContext): string[] => {
  const inv = rule.state.inventory
  return [...SLOTS.map((s) => inv.equipped[s]).filter((u): u is string => !!u), ...inv.bag, ...inv.pending_box]
}

function dropInstance(rule: RuleContext, uid: string): void {
  const inv = rule.state.inventory
  for (const [slot, u] of Object.entries(inv.equipped)) if (u === uid) inv.equipped[slot as 'weapon'] = null
  inv.bag = inv.bag.filter((u) => u !== uid)
  inv.pending_box = inv.pending_box.filter((u) => u !== uid)
  inv.equip_suggestions = inv.equip_suggestions.filter((sg) => !('uid' in sg.source && sg.source.uid === uid))
  inv.relic_designations = inv.relic_designations.filter((r) => r.uid !== uid)
  delete rule.state.item_instances[uid]
}

// 유물 슬롯 장비 중 감정가가 가장 높은 것(헌납 후보·최고급 유물)
function bestRelic(rule: RuleContext): ItemInstance | null {
  const { content, state } = rule
  let best: ItemInstance | null = null
  for (const uid of ownedUids(rule)) {
    const inst = state.item_instances[uid]
    if (!inst || inst.used || content.get('item', inst.def_id).slot !== 'relic') continue
    if (!best || appraisal(content, inst.def_id, inst.grade) > appraisal(content, best.def_id, best.grade)) best = inst
  }
  return best
}

// 현재 레벨 기준 단계의 회복약
function currentTierPotion(rule: RuleContext): string | null {
  const tier = levelTier(rule.content, characterOf(rule).level)
  return rule.content.list('consumable').find((c) => c.effect === 'heal_hp' && c.tier === tier)?.id ?? null
}

function stow(rule: RuleContext, uid: string, to: 'bag' | 'pending_box' | 'bag_or_pending'): void {
  if (to === 'pending_box') putPending(rule, uid)
  else if (to === 'bag' || rule.state.inventory.bag.length < rule.content.balance.stats.bag_slots) stowLoot(rule, uid)
  else putPending(rule, uid)
}

// ── 발견 지점 ──

function findDiscovery(w: EventWorld, id: string) {
  for (const r of w.content.list('region')) {
    if (r.kind !== 'adventure_route') continue
    const d = r.discoveries.find((x) => x.id === id)
    if (d) return d
  }
  return undefined
}

function reveal(w: EventWorld, ports: EventPorts, id: string, scope: EventScope): void {
  const rule = ctxOf(w, scope)
  const ch = characterOf(rule)
  if (ch.discoveries.includes(id)) return
  ch.discoveries.push(id)
  const noted = w.state.family.discovery_points
  if (!noted.includes(id)) noted.push(id)
  const d = findDiscovery(w, id)
  if (!d) return
  if (d.map_fragment && !ch.map_fragments.includes(d.map_fragment)) ch.map_fragments.push(d.map_fragment)
  if (d.effects) {
    const run: EffectRun = { w, ports, scope, test: rule.test, rule, pre: { dice: {}, chance: {} }, rewardMult: 1, out: newEffectOutput() }
    runEffects(run, d.effects, `discovery/${id}`)
    for (const draft of run.out.journal) addJournal(w, draft)
  }
}

// ── 조립 ──

// 포트 교체분. 함수를 주면 기본 어댑터를 받아 그 위에 덮는다(09 §6.2 헌납 유물처럼 기본 구현을 감싸야 할 때)
export type PortOverride = Partial<EventPorts> | ((base: EventPorts) => Partial<EventPorts>)

export interface ServiceOptions {
  ports?: PortOverride // 구현이 생긴 포트를 바꿔 끼운다(T8 출정, T10 계승)
}

// 세계 하나가 쓰는 사건 포트 묶음을 만든다
export function createServices(world: EventWorld, opts: ServiceOptions = {}): SimServices {
  const deferred: DeferredPortCall[] = []
  const defer = (port: string) => (_w: EventWorld, params: unknown, scope: EventScope = { place: null, vars: {} }) =>
    void deferred.push({ port, params, scope })

  const base: EventPorts = {
    combat: { fight: (w, spec, scope) => fight(w, spec, scope, ports) },

    item: {
      addItem(w, p, scope) {
        const rule = ctxOf(w, scope)
        const def = w.content.get('item', p.item_id)
        const rolled = p.grade === undefined && def.fixed_grade === undefined
        const got = grantItem(rule, w.rng.loot, {
          item_id: p.item_id,
          ...(p.grade !== undefined ? { grade: p.grade } : {}),
          ...(rolled ? { table: dropTableOf(w, scope.place) } : {}),
          to: p.to,
          source: scope.eventId ?? 'event',
        })
        return got?.uid ?? null
      },
      addRandomItem(w, p, scope) {
        const rule = ctxOf(w, scope)
        const ch = characterOf(rule)
        const place = scope.place ?? ch.location
        const tier = p.tier === 'location' ? placeTier(w.content, place) : p.tier === 'character' ? levelTier(w.content, ch.level) : p.tier
        const { grade, named } = p.grade_table
          ? rollGrade(rule, w.rng.loot, p.grade_table)
          : pickGradeWeighted(w.rng.loot, p.grade_weights!)
        const cands = dropCandidates(w.content, place, tier).filter((c) => p.slot === undefined || c.def.slot === p.slot)
        if (!cands.length) return null
        const def = cands[weightedPick(w.rng.loot, cands.map((c) => c.weight))]!.def
        const inst = materializeItem(rule, {
          def_id: def.id, grade, effects: rollEffects(w.content, w.rng.loot, def, grade, named), ...(named ? { prefix: NAMED_PREFIX } : {}),
        }, acquiredBy(rule, scope.eventId ?? 'event'))
        stow(rule, inst.uid, 'bag_or_pending')
        return inst.uid
      },
      removeItem(w, p, scope) {
        const rule = ctxOf(w, scope)
        const uid = p.selector === 'chosen_relic' ? scope.vars.relic_uid
          : p.selector === 'highest_rare_relic' ? bestRelic(rule)?.uid
          : ownedUids(rule).find((u) => rule.state.item_instances[u]?.def_id === p.item_id)
        if (uid) dropInstance(rule, uid)
      },
      addConsumable(w, p, scope) {
        const rule = ctxOf(w, scope)
        const id = p.consumable_id ?? currentTierPotion(rule)
        if (!id) return
        const group = w.content.get('consumable', id).carry_group
        const limit = w.content.balance.economy.carry_limits[group]
        const add = limit === undefined ? p.count : Math.max(0, Math.min(p.count, limit - carryGroupCount(rule, group)))
        const inv = rule.state.inventory.consumables
        if (add > 0) inv[id] = (inv[id] ?? 0) + add
      },
      removeConsumable(w, p, scope) {
        const rule = ctxOf(w, scope)
        const inv = rule.state.inventory.consumables
        const group = p.carry_groups.find((g) => carryGroupCount(rule, g) >= p.count)
        if (group === undefined) return
        let left = p.count
        for (const c of w.content.list('consumable')) {
          if (c.carry_group !== group || left <= 0) continue
          const take = Math.min(left, inv[c.id] ?? 0)
          inv[c.id] = (inv[c.id] ?? 0) - take
          left -= take
        }
      },
      addMaterial(w, p, scope) {
        const loot = w.state.current_activity.sortie?.loot
        if (loot) loot.materials[p.material_id] = (loot.materials[p.material_id] ?? 0) + p.count
        else deferred.push({ port: 'item.addMaterial', params: p, scope })
      },
      // 보물 상자: 장비 1개 + 그 층 동전식 × coin_units + 재료(07 §5.3). 잠김·함정 판정은 사건이 하지 않는다
      openChest(w, scope) {
        const rule = ctxOf(w, scope)
        const ch = characterOf(rule)
        const chest = w.content.balance.dungeon.chest
        const place = scope.place ?? ch.location
        const coins = Math.round(chest.coin_units * rewardUnits(w, scope.place).coins)
        earnCoins(rule, coins)
        const loot = w.state.current_activity.sortie?.loot
        if (loot) loot.coins += coins
        const region = w.content.get('region', place)
        const material = region.kind === 'town' ? undefined : w.content.get('enemy', region.encounters[0]!.enemy_id).material_id
        if (material && loot) loot.materials[material] = (loot.materials[material] ?? 0) + chest.material
        const spec = rollDrop(rule, w.rng.loot, { table: 'treasure_chest', location: place, room: 'treasure' })
        if (!spec) return null
        const inst = materializeItem(rule, spec, acquiredBy(rule, scope.eventId ?? 'chest'))
        stow(rule, inst.uid, 'bag_or_pending')
        return inst.uid
      },
      registerRelic(w, p, scope) {
        const rule = ctxOf(w, scope)
        const uid = p.selector === 'uid' ? scope.vars.relic_uid : p.this_item_uid
        if (!uid || !rule.state.item_instances[uid]) return
        const list = rule.state.inventory.relic_designations
        const max = w.content.balance.inheritance.relic_designations_max
        const kept = list.filter((r) => r.uid !== uid && r.priority !== p.priority)
        kept.push({ uid, priority: p.priority })
        rule.state.inventory.relic_designations = kept.sort((a, b) => a.priority - b.priority).slice(0, max)
      },
      offeredRelic(w) {
        const rule = ctxOf(w, { place: null, vars: {} })
        const inst = bestRelic(rule)
        return inst ? { uid: inst.uid, name: itemName(rule, inst), note: '' } : null
      },
    },

    // 사건 특가 구매(08 §5.2 예외). 자동 구매 조건(예약금·최소 개선률)을 통과할 때만 산다
    economy: {
      offerPurchase(w, p0, scope) {
        const p = p0 as {
          pool: { facilities: string[]; slots: string[] }
          tier: 'character' | number
          grade_weights: Partial<Record<Grade, number>>
          price_mult: number
          defect?: Modifier[]
          exempt_discount_cap?: boolean
          respect_auto_buy?: boolean
        }
        const rule = ctxOf(w, scope)
        const ch = characterOf(rule)
        const tier = p.tier === 'character' ? levelTier(w.content, ch.level) : p.tier
        const cands = w.content.list('item').filter((d) =>
          !d.cursed && d.tier === tier && p.pool.slots.includes(d.slot) && (d.shop ?? []).some((s) => p.pool.facilities.includes(s.facility)))
        // 도입이 보여 준 물건(offer_item 선택자, 효과가 item_id로 넘김)을 판다. 이 효과의 풀에 없으면 팔지 않는다(11 L10 슬롯별 보정)
        const offered = typeof p0.item_id === 'string' ? p0.item_id : null
        const def = offered !== null ? cands.find((d) => d.id === offered) : cands.length ? cands[w.rng.loot.bounded(cands.length)] : undefined
        if (!def) return null
        const { grade, named } = pickGradeWeighted(w.rng.loot, p.grade_weights)
        const effects = rollEffects(w.content, w.rng.loot, def, grade, named)
        const candidate = { def_id: def.id, grade, effects }
        const raw = basePrice(w.content, def.id, grade) * p.price_mult
        const price = Math.round(p.exempt_discount_cap ? raw : raw * shopPriceFactor(rule))
        const imp = improvement(rule, candidate, { mainPlace: scope.mainPlace ?? null })
        if (p.respect_auto_buy !== false && (!worthSwapping(rule, candidate, imp) || price > ch.coins * (1 - reserveRatio(rule)))) return null
        const name = w.content.get('item', def.id).name
        if (!rule.state.policies.auto_equip) {
          const d = suggest(rule, {
            slot: def.slot, source: { shop_def_id: def.id, grade, price }, improvement: imp.value, reason: imp.reason, created_eff_min: ch.eff_min,
          }, name)
          if (d) addJournal(w, d)
          return null
        }
        ch.coins = Math.max(0, ch.coins - price)
        const inst = materializeItem(rule, { def_id: def.id, grade, effects, ...(named ? { prefix: NAMED_PREFIX } : {}) }, acquiredBy(rule, 'shop'))
        if (p.defect?.length) inst.defect = [...p.defect]
        equipItem(rule, inst.uid)
        return inst.uid
      },
    },

    injury: {
      injure(w, p, scope) {
        const rule = ctxOf(w, scope)
        addInjury(rule, p.grade, (p.stat as Stat | undefined) ?? injuryStat(w.rng.life, 'combat'), scope.eventId ?? 'event')
      },
      cure(w, p, scope) {
        const ch = characterOf(ctxOf(w, scope))
        ch.injuries = p.grade === 'all' ? [] : ch.injuries.filter((i) => i.grade !== p.grade)
      },
    },

    life: {
      // 변이: 긴 잠 나이 = min(지금의 은퇴 예정 나이 + add_years, cap)(09 §7.6)
      mutate(w, p, scope) {
        const rule = ctxOf(w, scope)
        const ch = characterOf(rule)
        const m = w.content.get('trait', p.trait_id).mutation
        if (!m) throw new Error(`변이 특성이 아니다: ${p.trait_id}`)
        ch.mutation = {
          trait_id: p.trait_id,
          since_age: ageAt(ch.eff_min, w.content.balance.time),
          long_sleep_age: Math.min(m.sleep.cap, ch.retire_age + m.sleep.add_years),
          thirst: 0,
        }
      },
      createPartner: (_w, scope) => void deferred.push({ port: 'life.createPartner', params: null, scope }),
      createChildCandidate: (_w, scope) => void deferred.push({ port: 'life.createChildCandidate', params: null, scope }),
    },

    sortie: { sortieMod: defer('sortie.sortieMod') },

    discovery: { reveal: (w, id, scope) => reveal(w, ports, id, scope) },
  }

  const ports: EventPorts = { ...base, ...(typeof opts.ports === 'function' ? opts.ports(base) : opts.ports) }
  return { ports, deferred }
}
