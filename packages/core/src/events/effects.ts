// 효과 실행기(16 §4.3, CONTENT_SCHEMA §4.2). 핸들러는 등록부 effects와 같은 이름의 EFFECT_HANDLERS 한 곳에 둔다.
// 전투·장비·부상·경제·생애·출정 구조가 필요한 효과는 포트(ports.ts)로 넘긴다.
// 한 효과 목록은 결과 적용 순서(10 §9.1: 보상·손실 → 특성 → 생애 플래그 → 가문 플래그 → 기록 → 연출)로 적용한다.
import type { Effect, Modifier } from '../schema/index'
import { SKILLS, effectPhase, registerTextSlot } from '../schema/index'
import type { JournalDraft } from '../state/journal'
import type { TempMod } from '../state/common'
import type { ConditionTest, RuleContext } from '../rules/context'
import { characterOf } from '../rules/context'
import { itemName } from '../items/bag'
import { earnCoins } from '../economy/earn'
import { innFee } from '../rules/cost'
import { maxHp, roundHalfUp } from '../rules/derived'
import { addFatigue } from '../rules/fatigue'
import { addSkillUses, addXp, type LevelUp } from '../rules/growth'
import { recordCheckUse } from '../rules/check'
import { ageAt } from '../time/index'
import { chainDoneKey, chainOutcomeKey, chainStageKey, chainUnfinishedKey } from '../schema/index'
import { rollEventCheck, type EventCheck } from './check'
import type { EventPorts, EventCombatSpec } from './ports'
import { bind, render, rewardUnits, textValues, type EventScope, type EventWorld } from './scope'

export interface EffectOutput {
  journal: JournalDraft[] // 효과가 남긴 추가 기록(journal·family_record·특성 획득·roll_check)
  animations: { action: string; props?: string[] }[]
  addSec: number // add_time 합
  endSortie: string | null
  reopen: { exclude: string[]; situational: Modifier[] } | null
  levelUps: LevelUp[]
  // 이 효과 목록에서 마지막으로 준 장비 인스턴스(register_relic this_item). 목록을 벗어나면 남지 않는다
  lastItemUid: string | null
  lastItemName: string | null // 그 장비 이름({item}·{loot}). 가방이 차서 곧바로 팔려도 이름은 남는다
  coins: number // add_coins로 얻은 동전({loot} 대체)
  offerMissed: boolean // offer_purchase가 사지 않았다(11 L02 "마음에 드는 물건이 없었다")
}

export const newEffectOutput = (): EffectOutput =>
  ({ journal: [], animations: [], addSec: 0, endSortie: null, reopen: null, levelUps: [], lastItemUid: null, lastItemName: null, coins: 0, offerMissed: false })

// 사건·효과 문장이 쓰는 문형(14 §5.1). 번들에 없으면 콘텐츠 검사 V2가 잡는다
export const EVENT_TEXT = {
  lootCoins: 'journal.event.loot_coins', // {loot}가 동전일 때: 동전 {coins}개
  noOffer: 'journal.town.no_offer', // 11 L02 구매 불발
  chronicle: 'journal.house.chronicle', // 14 §5.1 [가문] 한 줄
  codex: 'journal.discovery.codex', // 14 §5.1 [발견] 도감 한 줄
  check: { success: 'journal.check.success', partial: 'journal.check.partial', failure: 'journal.check.failure' },
} as const
for (const id of [EVENT_TEXT.lootCoins, EVENT_TEXT.noOffer, EVENT_TEXT.chronicle, EVENT_TEXT.codex, ...Object.values(EVENT_TEXT.check)]) {
  registerTextSlot(id, '사건 효과(events)')
}

const textVariant = (w: EventWorld, id: string, seq = 0): string => {
  const v = w.content.get('text', id).variants
  return v[seq % v.length]!
}

// 효과 결과가 채우는 문장 값: {item}(산 장비·준 장비)과 {loot}(얻은 물건, 장비가 없으면 동전)
export function resultValues(w: EventWorld, out: EffectOutput): Record<string, string> {
  const vals: Record<string, string> = {}
  if (out.lastItemName) vals.item = vals.loot = out.lastItemName
  else if (out.coins > 0) vals.loot = render(textVariant(w, EVENT_TEXT.lootCoins), { coins: out.coins })
  return vals
}

const runValues = (run: EffectRun) => textValues(run.w, run.scope, resultValues(run.w, run.out))

// 장비 지급 효과의 결과를 남긴다. 인스턴스가 곧바로 팔려 없어도 정의 이름으로 남긴다
function gotItem(run: EffectRun, uid: string | null, defId?: string): void {
  run.out.lastItemUid = uid
  const inst = uid ? run.w.state.item_instances[uid] : undefined
  const name = inst ? itemName(run.rule, inst) : uid && defId ? run.w.content.get('item', defId).name : null
  if (name) run.out.lastItemName = name
}

export interface EffectRun {
  w: EventWorld
  ports: EventPorts
  scope: EventScope
  test: ConditionTest
  rule: RuleContext
  // 미리 굴린 값(13 §8.3): effect_path → d20(roll_check) / 0~1(chance). 없으면 event 흐름에서 굴린다
  pre: { dice: Readonly<Record<string, number>>; chance: Readonly<Record<string, number>> }
  rewardMult: number // 대성공 동전·경험치 배수(05 §6.4)
  out: EffectOutput
}

// 파라미터 모양은 등록부 스키마가 보장한다(콘텐츠 검사를 거친 번들)
type Handler = (run: EffectRun, e: any, path: string) => void

const U32 = 0x100000000
// F01 재제시 조건용: 미룰 때의 숙련 단계(character.counters)
export const deferRankKey = (skill: string) => `defer_rank.${skill}`
const ch = (run: EffectRun) => characterOf(run.rule)
const now = (run: EffectRun) => ch(run).eff_min
const addTo = (rec: Record<string, number>, key: string, v: number) => { rec[key] = (rec[key] ?? 0) + v }

function setFamilyFlag(run: EffectRun, key: string, value: boolean | number): void {
  const fam = run.w.state.family
  fam.flags[key] = value
  fam.flag_meta[key] = { set_gen: fam.generation }
}

// 한 줄 기록 초안(추가 기록)
function note(run: EffectRun, tag: JournalDraft['tag'], line: string, extra: Partial<JournalDraft> = {}): void {
  run.out.journal.push({ tag, line, ...extra, refs: { ...(run.scope.eventId ? { event_id: run.scope.eventId } : {}), ...extra.refs } })
}

function rollDice(run: EffectRun, dice: string): number {
  const [, n, m, k] = /^(\d+)d(\d+)([+-]\d+)?$/.exec(dice)!
  let sum = Number(k ?? 0)
  for (let i = 0; i < Number(n); i++) sum += run.w.rng.event.int(1, Number(m))
  return sum
}

// 효과 목록 실행. base = 이 목록의 effect_path 접두(choice/outcome 또는 앞 효과의 branch).
// 적용 순서(10 §9.1)는 효과 등록(registerEffect의 phase)이 단일 출처다
export function runEffects(run: EffectRun, list: readonly Effect[], base: string): void {
  const order = list.map((e, i) => ({ e, i })).sort((a, b) => effectPhase(a.e.type) - effectPhase(b.e.type) || a.i - b.i)
  for (const { e, i } of order) {
    if (e.when !== undefined && !run.test(e.when)) continue
    const h = EFFECT_HANDLERS[e.type]
    if (!h) throw new Error(`효과 실행 핸들러가 없다: ${e.type}`)
    h(run, e, `${base}/${i}`)
  }
}

const branch = (run: EffectRun, e: Record<string, unknown>, key: string, path: string) => {
  const list = e[key] as Effect[] | undefined
  if (list) runEffects(run, list, `${path}.${key}`)
}

function addTrait(run: EffectRun, id: string): void {
  const c = ch(run)
  const { content } = run.w
  if (c.traits.some((t) => t.id === id && !t.inactive)) return // 이미 가진 특성이면 아무 일도 없다(I29)
  const def = content.get('trait', id)
  const age = ageAt(c.eff_min, content.balance.time)
  if (def.replaces) for (const t of c.traits) if (t.id === def.replaces && !t.inactive) t.inactive = 'replaced'
  c.traits.push({ id, since_age: age, source: 'acquired' })
  // 후천 상한 초과: 가장 오래된 누적형이 활성 목록에서 빠진다(06 §1.1)
  const acquired = c.traits.filter((t) => !t.inactive && content.get('trait', t.id).kind === 'acquired')
  if (acquired.length > content.balance.stats.trait_caps.acquired) {
    const old = acquired.find((t) => content.get('trait', t.id).acquired_class === 'cumulative')
    if (old) old.inactive = 'displaced'
  }
  note(run, 'trait', render(def.lines[0]!, runValues(run)), { sub: 'trait_gain' })
}

function pushTempMod(run: EffectRun, e: Record<string, any>): void {
  const c = ch(run)
  const sortie = run.w.state.current_activity.sortie
  const scope = e.scope as TempMod['scope']
  const mod: TempMod = {
    modifier: { ...(e.modifier as Modifier), target: bind((e.modifier as Modifier).target, run.scope) },
    scope,
    remaining: scope === 'encounters' || scope === 'next_visit' ? (e.count ?? null) : scope === 'next_check' || scope === 'next_decision' ? 1 : null,
    expires_eff_min: scope === 'eff_min' ? c.eff_min + e.duration_min : null,
    source_event: run.scope.eventId ?? null,
  }
  if (scope === 'next_visit') {
    const loc = bind(e.location, run.scope)
    ;(c.next_visit_mods[loc] ??= []).push({ type: 'temp_mod', ...mod })
  } else if (sortie && ['scene', 'next_scene', 'sortie', 'encounters'].includes(scope)) sortie.temp_mods.push(mod)
  else c.temp_mods.push(mod)
}

const activityOf = (kind: string): 'hunt' | 'adventure' | 'dungeon' =>
  kind === 'dungeon_floor' ? 'dungeon' : kind === 'adventure_route' ? 'adventure' : 'hunt'

export const EFFECT_HANDLERS: Record<string, Handler> = {
  // ── 자원·상태 ──
  add_coins: (run, e) => {
    const n = e.amount ?? roundHalfUp(e.units * rewardUnits(run.w, run.scope.place).coins)
    const got = Math.floor(n * run.rewardMult + 1e-9)
    // 들어온 동전은 번 동전(12 §7.1 coins_earned)에 센다(I65). 음수는 지출이라 세지 않는다
    if (got > 0) {
      earnCoins(run.rule, got)
      run.out.coins += got
    } else ch(run).coins += got
  },
  remove_coins: (run, e) => {
    const c = ch(run)
    const n =
      e.amount !== undefined ? e.amount
      : e.units !== undefined ? e.units * rewardUnits(run.w, run.scope.place).coins
      : e.ratio !== undefined ? e.ratio * c.coins
      : e.sortie_income_ratio !== undefined ? e.sortie_income_ratio * (run.w.state.current_activity.sortie?.loot.coins ?? 0)
      : e.inn_costs * innFee(run.rule)
    c.coins = Math.max(0, c.coins - roundHalfUp(n))
  },
  add_xp: (run, e) => {
    const unit = rewardUnits(run.w, run.scope.place).xp
    const n = e.amount ?? roundHalfUp((e.units ?? e.encounters) * unit)
    run.out.levelUps.push(...addXp(run.rule, run.w.rng.life, Math.floor(n * run.rewardMult + 1e-9)))
  },
  heal: (run, e) => {
    const c = ch(run)
    const max = maxHp(run.rule)
    c.hp = Math.min(max, c.hp + (e.hp ?? roundHalfUp(e.hp_ratio * max)))
  },
  // 사건 피해는 체력을 1 아래로 내리지 않는다(10 §6.2, V9)
  damage: (run, e) => {
    const c = ch(run)
    const d = e.hp ?? (e.hp_ratio !== undefined ? roundHalfUp(e.hp_ratio * maxHp(run.rule)) : rollDice(run, e.dice))
    c.hp = Math.max(Math.min(c.hp, 1), c.hp - Math.max(0, d))
  },
  add_fatigue: (run, e) => void addFatigue(run.rule, e.value),
  injury: (run, e) => run.ports.injury.injure(run.w, e, run.scope),
  cure_injury: (run, e) => run.ports.injury.cure(run.w, e, run.scope),
  life_stat_add: (run, e) => {
    const c = ch(run)
    const before = c.stats[e.stat as 'luk']
    const after = Math.max(e.floor ?? 0, before + e.value)
    c.stats[e.stat as 'luk'] = after
    if (after !== before) c.life_stat_mods.push({ stat: e.stat, value: after - before, source: run.scope.eventId ?? 'event' })
  },

  // ── 물건 ──
  add_item: (run, e) => gotItem(run, run.ports.item.addItem(run.w, e, run.scope), e.item_id),
  add_random_item: (run, e) => gotItem(run, run.ports.item.addRandomItem(run.w, e, run.scope)),
  remove_item: (run, e) => run.ports.item.removeItem(run.w, e, run.scope),
  add_consumable: (run, e) => run.ports.item.addConsumable(run.w, e, run.scope),
  remove_consumable: (run, e) => run.ports.item.removeConsumable(run.w, e, run.scope),
  add_material: (run, e) => run.ports.item.addMaterial(run.w, e, run.scope),
  open_chest: (run) => gotItem(run, run.ports.item.openChest(run.w, run.scope)),
  // 도입의 {item}(offer_item 선택자가 고른 물건)을 넘긴다. 포트가 그 물건을 파는지는 포트 몫이다
  offer_purchase: (run, e) => {
    const uid = run.ports.economy.offerPurchase(run.w, run.scope.vars.item ? { ...e, item_id: run.scope.vars.item } : e, run.scope)
    if (uid) gotItem(run, uid)
    else run.out.offerMissed = true
  },

  // ── 특성·생애 ──
  add_trait: (run, e) => addTrait(run, e.trait_id),
  remove_trait: (run, e) => {
    const c = ch(run)
    c.traits = c.traits.filter((t) => t.id !== e.trait_id)
  },
  // defer: 재제시 조건(05 §8.3)을 사건 policy_hooks.represent_after로 기록한다
  specialize: (run, e) => {
    const c = ch(run)
    if (e.spec !== 'defer') {
      c.specialization = e.spec
      c.spec_deferred_until_level = null
      return
    }
    const ra = run.scope.eventId ? run.w.content.get('event', run.scope.eventId).policy_hooks?.represent_after : undefined
    c.spec_deferred_until_level = ra ? c.level + ra.level_gain : null
    for (const s of ra?.skill_rank_up ?? []) c.counters[deferRankKey(s)] = c.skills[s].rank
  },
  extend_lifespan: (run, e) => {
    const c = ch(run)
    const { content } = run.w
    if (c.mutation && content.get('trait', c.mutation.trait_id).mutation?.blocks_lifespan_extension) return
    c.retire_age = Math.max(c.retire_age, Math.min(c.retire_age + e.years, e.cap ?? content.balance.inheritance.lifespan.extend_cap))
    c.lifespan_extended = true
  },
  mutate: (run, e) => run.ports.life.mutate(run.w, e, run.scope),
  register_relic: (run, e) =>
    run.ports.item.registerRelic(run.w, { selector: e.selector, priority: e.priority, this_item_uid: run.out.lastItemUid }, run.scope),
  create_child_candidate: (run) => run.ports.life.createChildCandidate(run.w, run.scope),
  create_partner: (run) => run.ports.life.createPartner(run.w, run.scope),

  // ── 플래그와 연속 사건 ──
  set_flag: (run, e) => { ch(run).flags[bind(e.key, run.scope)] = e.value ?? true },
  clear_flag: (run, e) => { delete ch(run).flags[bind(e.key, run.scope)] },
  set_family_flag: (run, e) => setFamilyFlag(run, bind(e.key, run.scope), e.value ?? true),
  set_trip_flag: (run, e) => {
    const s = run.w.state.current_activity.sortie
    if (s) s.trip_flags[bind(e.key, run.scope)] = { value: e.value ?? true, remaining: e.remaining ?? null }
  },
  clear_trip_flag: (run, e) => {
    const s = run.w.state.current_activity.sortie
    if (s) delete s.trip_flags[bind(e.key, run.scope)]
  },
  counter_add: (run, e) => {
    const c = ch(run)
    addTo(c.counters, e.key, e.value)
    if (e.where !== undefined) addTo((c.counters_at[e.key] ??= {}), bind(e.where, run.scope), e.value)
  },
  advance_chain: (run, e) => { ch(run).flags[chainStageKey(e.chain_id)] = e.stage },
  end_chain: (run, e) => {
    const chain = run.w.content.get('chain', e.chain_id)
    ch(run).flags[chainStageKey(chain.id)] = chain.stages
    setFamilyFlag(run, chainDoneKey(chain.id), true)
    if (e.outcome !== 'done') setFamilyFlag(run, chainOutcomeKey(chain.id, e.outcome), true)
    delete run.w.state.family.flags[chainUnfinishedKey(chain.id)]
  },

  // ── 진행·장소 ──
  unlock_location: (run, e) => {
    const list = run.w.state.family.discovered_locations
    if (!list.includes(e.location_id)) list.push(e.location_id)
  },
  // prefer 중 미발견이 먼저, 없으면 현재 장소의 조건 맞는 미발견 지점 중 event 흐름 무작위
  reveal_discovery: (run, e) => {
    const { content } = run.w
    const found = ch(run).discoveries
    const all = content.list('region').flatMap((r) => (r.kind === 'adventure_route' ? r.discoveries : []))
    let id = (e.prefer as string[] | undefined)?.find((p) => !found.includes(p) && all.some((d) => d.id === p))
    if (!id && run.scope.place) {
      const r = content.get('region', run.scope.place)
      const left = r.kind === 'adventure_route' ? r.discoveries.filter((d) => !found.includes(d.id) && run.test(d.condition)) : []
      if (left.length) id = left[run.w.rng.event.bounded(left.length)]!.id
    }
    if (id) run.ports.discovery.reveal(run.w, id, run.scope)
  },
  set_destination: (run, e) => {
    const loc: string = e.location ?? run.scope.vars[e.place_var]!
    run.w.state.current_activity.next_sortie_override = {
      location_id: loc,
      activity: e.activity ?? activityOf(run.w.content.get('region', loc).kind),
      source_event: run.scope.eventId ?? 'event',
    }
  },
  accept_quest: (run, e) => {
    const c = ch(run)
    const loc = run.scope.vars[e.location_var]!
    c.quest = {
      event_id: e.quest, location_id: loc, enemy_id: run.scope.vars[e.enemy_var]!, goal_wins: e.goal_wins, wins: 0,
      reward: e.reward, accepted_eff_min: c.eff_min, deadline: e.deadline,
    }
    run.w.state.current_activity.next_sortie_override = {
      location_id: loc, activity: activityOf(run.w.content.get('region', loc).kind), source_event: e.quest,
    }
  },
  sortie_mod: (run, e) => run.ports.sortie.sortieMod(run.w, e, run.scope),
  dungeon_mod: (run, e) => {
    const loc = bind(e.location ?? '{place}', run.scope)
    const saved = { ...e, location: loc }
    if (e.scope === 'next_visit') (ch(run).next_visit_mods[loc] ??= []).push(saved)
    else run.w.state.current_activity.sortie?.dungeon_mods.push(saved)
  },
  add_time: (run, e) => { run.out.addSec += e.sec },
  end_sortie: (run, e) => { run.out.endSortie = e.reason },
  temp_mod: (run, e) => pushTempMod(run, e),
  shop_discount: (run, e) => {
    ch(run).shop_discounts.push({
      ratio: e.ratio, uses_left: e.uses ?? 1, facility: e.facility ?? null,
      expires_eff_min: e.duration_min !== undefined ? now(run) + e.duration_min : null,
    })
  },

  // ── 전투와 흐름 ──
  start_combat: (run, e, path) => {
    const result = run.ports.combat.fight(run.w, e as unknown as EventCombatSpec, run.scope)
    branch(run, e, `on_${result}`, path)
  },
  roll_check: (run, e, path) => {
    const dice = run.pre.dice[path] ?? run.w.rng.event.d20()
    const roll = rollEventCheck(run.w, run.rule, e.check as EventCheck, run.scope, dice)
    recordCheckUse(run.rule, roll, { event: true })
    const key = roll.result === 'crit_success' ? 'success' : roll.result === 'crit_failure' ? 'failure' : roll.result
    // 14 §5.1 [판정] 한 줄은 결과 문장. 판정식은 check 기록이 펼친다(14 §7.1)
    const line = textVariant(run.w, EVENT_TEXT.check[roll.result === 'partial' ? 'partial' : key === 'success' ? 'success' : 'failure'])
    note(run, 'check', render(line, { kind: run.w.content.balance.check_kinds[roll.kind]!.name }), { check: roll.record })
    branch(run, e, key === 'partial' && !e.partial ? 'failure' : key, path)
  },
  chance: (run, e, path) => {
    const u = run.pre.chance[path] ?? run.w.rng.event.nextU32() / U32
    branch(run, e, u < e.p ? 'then' : 'else', path)
  },
  if: (run, e, path) => branch(run, e, run.test(e.cond) ? 'then' : 'else', path),
  // 다음 마을 도착 때 runTownReturnEffects가 같은 장소·변수로 적용한다
  on_town_return: (run, e) => {
    run.w.state.current_activity.pending_town_effects.push({
      ...e, place: run.scope.place, vars: { ...run.scope.vars }, event_id: run.scope.eventId ?? null,
    })
  },
  schedule_event: (run, e) => {
    ch(run).scheduled_events.push({ event_id: e.event_id, at: e.at, due_eff_min: e.at === 'eff_min' ? now(run) + e.after_min : null })
  },
  reopen_choices: (run, e) => { run.out.reopen = { exclude: e.exclude, situational: e.situational ?? [] } },

  // ── 기록·관계·연출 ──
  npc_relation: (run, e) => {
    const c = ch(run)
    const cur = c.npc_relations[e.npc_id] ?? run.w.content.get('npc', e.npc_id).relation_default
    c.npc_relations[e.npc_id] = Math.max(-100, Math.min(100, cur + e.delta))
  },
  skill_use: (run, e) => {
    const c = ch(run)
    const skill = e.skill === 'lowest_rank' ? SKILLS.reduce((a, s) => (c.skills[s].rank < c.skills[a].rank ? s : a)) : e.skill
    addSkillUses(run.rule, skill, e.count)
  },
  // 가문 기록 저장소(연대기 문장·인연·도감 키)가 정해지기 전까지 가문 보존 기록으로 남긴다.
  // 한 줄은 14 §5.1 문형([가문] 연대기 / [발견] 도감)이고, 연대기·인연 문장은 상세(편지는 줄마다 80자, D54)에 둔다
  family_record: (run, e) => {
    const text = render(e.text, runValues(run))
    if (e.kind === 'codex') note(run, 'discovery', render(textVariant(run.w, EVENT_TEXT.codex), { item: text }), { importance: 'family' })
    else note(run, e.kind === 'bond' ? 'bond' : 'house', textVariant(run.w, EVENT_TEXT.chronicle), { detail: text, importance: 'family' })
  },
  unlock_family: (run, e) => {
    const u = run.w.state.family.unlocks
    const list = e.kind === 'background' ? u.backgrounds : u.appearances
    if (!list.includes(e.id)) list.push(e.id)
  },
  journal: (run, e) => {
    const vals = runValues(run)
    note(run, e.tag, render(e.line, vals), {
      ...(e.detail !== undefined ? { detail: render(e.detail, vals) } : {}),
      ...(e.importance !== undefined ? { importance: e.importance } : {}),
    })
  },
  animation: (run, e) => { run.out.animations.push({ action: e.action, ...(e.props ? { props: e.props } : {}) }) },
}
