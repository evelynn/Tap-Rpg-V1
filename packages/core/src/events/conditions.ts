// 조건 평가기(16 §3, CONTENT_SCHEMA §4.1). 단말 핸들러는 등록부 conditions와 같은 이름의 CONDITION_EVAL 한 곳에 둔다.
// 평가는 난수·부수 효과가 없다. 장소 자리 바인딩은 scope로 치환한다.
import type { Condition } from '../schema/index'
import { GRADES, SLOTS, chainStageKey } from '../schema/index'
import type { Character } from '../state/character'
import type { ConditionTest, RuleContext } from '../rules/context'
import { maxHp } from '../rules/derived'
import { ageAt, lifeStageAt, seasonAt, type StageBoundaries } from '../time/index'
import { regionMatches } from '../content/index'
import { bind, ruleContext, type EventScope, type EventWorld } from './scope'

export interface CondCtx {
  w: EventWorld
  scope: EventScope
  ch: Character
  rule: RuleContext
}

// specific_age 기준 나이: 직전 마을 귀환 판단 지점의 나이(엔진이 character.counters에 적는다)
export const TOWN_RETURN_AGE_KEY = 'town_return_age'

// 파라미터 모양은 등록부 스키마가 보장한다(콘텐츠 검사를 거친 번들)
type Eval = (arg: any, c: CondCtx) => boolean

const age = (c: CondCtx) => ageAt(c.ch.eff_min, c.w.content.balance.time)
const place = (c: CondCtx) => c.scope.place
const region = (c: CondCtx) => (c.scope.place ? c.w.content.get('region', c.scope.place) : null)
const sortie = (c: CondCtx) => c.w.state.current_activity.sortie

export function stageBoundaries(c: { w: EventWorld }): StageBoundaries {
  const st = c.w.content.balance.aging.life_stages
  const from = (id: string) => st.find((s) => s.id === id)!.from_age
  return [from('prime'), from('veteran'), from('elder')]
}

export function activeTraitIds(ch: Character): string[] {
  const ids = ch.traits.filter((t) => !t.inactive).map((t) => t.id)
  return ch.mutation ? [...ids, ch.mutation.trait_id] : ids
}

// 가방·장착·수령 대기함의 장비 인스턴스
function ownedItems(c: CondCtx) {
  const inv = c.w.state.inventory
  const uids = [...inv.bag, ...inv.pending_box, ...SLOTS.map((s) => inv.equipped[s]).filter((u): u is string => !!u)]
  return uids.map((u) => c.w.state.item_instances[u]).filter((i) => i !== undefined)
}

// 플래그 값(범위는 접두로 고른다). 없으면 undefined
export function flagValueOf(w: EventWorld, key: string): boolean | number | undefined {
  const s = w.state
  if (key.startsWith('life.')) return s.character?.flags[key]
  if (key.startsWith('fam.')) return s.family.flags[key]
  return s.current_activity.sortie?.trip_flags[key]?.value
}

const truthy = (v: boolean | number | undefined) => v !== undefined && v !== false && v !== 0

function thirstIndex(c: CondCtx, stageId?: string): number {
  const m = c.ch.mutation
  const def = m ? c.w.content.get('trait', m.trait_id).mutation : undefined
  if (!m || !def) return -1
  const stages = [...def.thirst.stages].sort((a, b) => a.from - b.from)
  return stageId === undefined ? stages.filter((s) => s.from <= m.thirst).length - 1 : stages.findIndex((s) => s.id === stageId)
}

function numValue(key: string, c: CondCtx): number {
  if (key.startsWith('flag.')) {
    const v = flagValueOf(c.w, bind(key.slice(5), c.scope))
    return typeof v === 'number' ? v : v ? 1 : 0
  }
  const [head, a, b] = bind(key, c.scope).split('.') as [string, string, string | undefined]
  const { ch, w } = c
  switch (head) {
    case 'age': return age(c)
    case 'level': return ch.level
    case 'coins': return ch.coins
    case 'generation': return w.state.family.generation
    case 'fatigue': return ch.fatigue
    case 'hp': return ch.hp
    case 'hp_max': return maxHp(c.rule)
    case 'thirst': return ch.mutation?.thirst ?? 0
    case 'stat': return ch.stats[a as keyof Character['stats']]
    case 'skill': return ch.skills[a as keyof Character['skills']].rank
    case 'counter': return b === undefined ? (ch.counters[a] ?? 0) : (ch.counters_at[a]?.[b] ?? 0)
    case 'family_counter': return w.state.family.counters[a] ?? 0
    case 'relation': return ch.npc_relations[a] ?? w.content.get('npc', a).relation_default
    case 'activity_weight': {
      if (!c.scope.activityWeight) throw new Error('num activity_weight는 문맥의 activityWeight가 필요하다')
      return c.scope.activityWeight(a)
    }
  }
  throw new Error(`알 수 없는 num 키: ${key}`)
}

const NUM_OP: Record<string, (x: number, y: number) => boolean> = {
  '==': (x, y) => x === y, '!=': (x, y) => x !== y, '>=': (x, y) => x >= y, '>': (x, y) => x > y, '<=': (x, y) => x <= y, '<': (x, y) => x < y,
}

export const CONDITION_EVAL: Record<string, Eval> = {
  age_gte: (n, c) => age(c) >= n,
  age_lt: (n, c) => age(c) < n,
  level_gte: (n, c) => c.ch.level >= n,
  level_lt: (n, c) => c.ch.level < n,
  life_stage: (list, c) => list.includes(lifeStageAt(age(c), stageBoundaries(c))),
  // 직전 마을 귀환 이후 그 나이에 도달했다(출정 중 생일도 다음 귀환에서 잡는다)
  specific_age: (list: number[], c) => {
    const from = c.ch.counters[TOWN_RETURN_AGE_KEY] ?? c.w.content.balance.time.start_age
    return list.some((n) => from < n && n <= age(c))
  },
  location: (list, c) => list.includes(place(c)),
  location_kind: (list, c) => !!region(c) && list.includes(region(c)!.kind),
  location_tag: (tag, c) => !!region(c)?.tags?.includes(tag),
  location_match: (f, c) => !!place(c) && regionMatches(c.w.content, place(c)!, f),
  season: (list, c) => list.includes(seasonAt(c.ch.eff_min, c.ch.birth_season, c.w.content.balance.time)),
  time_of_day: (v, c) => sortie(c)?.time_of_day === v,
  last_trip_time: (v, c) => c.ch.last_trip_time === v,
  weather: (list, c) => !!sortie(c) && list.includes(sortie(c)!.weather),
  attitude: (list, c) => list.includes(c.w.state.policies.attitude),
  has_trait: (id, c) => activeTraitIds(c.ch).includes(id),
  trait_hook: (name, c) => activeTraitIds(c.ch).some((id) => {
    const v = (c.w.content.get('trait', id).ai_hooks as Record<string, unknown> | undefined)?.[name]
    return v !== undefined && v !== false && v !== 0 && !(Array.isArray(v) && v.length === 0)
  }),
  has_item: (id, c) => ownedItems(c).some((i) => i.def_id === id),
  has_item_where: (f, c) => ownedItems(c).some((i) => {
    const d = c.w.content.get('item', i.def_id)
    return (f.slot === undefined || d.slot === f.slot)
      && (f.grade_gte === undefined || GRADES.indexOf(i.grade) >= GRADES.indexOf(f.grade_gte))
      && (f.tier_gte === undefined || d.tier >= f.tier_gte)
      && (f.unique === undefined || d.unique === f.unique)
  }),
  equipped: (id, c) => SLOTS.some((s) => {
    const u = c.w.state.inventory.equipped[s]
    return !!u && c.w.state.item_instances[u]?.def_id === id
  }),
  received_relic: (v, c) => ownedItems(c).some((i) => i.inherited_from_gen !== undefined && (v === true || i.def_id === v)),
  has_consumable: (p, c) => p.carry_groups.some((g: string) => {
    let n = 0
    for (const [id, cnt] of Object.entries(c.w.state.inventory.consumables)) if (c.w.content.get('consumable', id).carry_group === g) n += cnt
    return n >= p.count
  }),
  flag: (v, c) => typeof v === 'string'
    ? truthy(flagValueOf(c.w, bind(v, c.scope)))
    : flagValueOf(c.w, bind(v.key, c.scope)) === v.value,
  chain_stage: (p, c) => (c.ch.flags[chainStageKey(p.chain)] ?? 0) === p.stage,
  lifetime_count_lt: (p, c) => (c.ch.event_counts[p.event] ?? 0) < p.count,
  family_count_lt: (p, c) => (c.w.state.family.event_counts[p.event] ?? 0) < p.count,
  skill_rank_gte: (p, c) => c.ch.skills[p.skill as keyof Character['skills']].rank >= p.rank,
  stat_gte: (p, c) => c.ch.stats[p.stat as keyof Character['stats']] >= p.value,
  guild_rank_gte: (id, c) => c.w.content.get('guild_rank', c.ch.guild_rank).order >= c.w.content.get('guild_rank', id).order,
  coins_gte: (n, c) => c.ch.coins >= n,
  injury: (v, c) => {
    const inj = c.ch.injuries
    return v === 'none' ? inj.length === 0 : v === 'any' ? inj.length > 0 : inj.some((i) => i.grade === v)
  },
  specialization: (list, c) => list.includes(c.ch.specialization),
  // 첫 검증판의 변이는 하나(vampire)뿐이라 변이 여부로 본다
  mutation: (v, c) => (v === 'none') === (c.ch.mutation === null),
  generation_gte: (n, c) => c.w.state.family.generation >= n,
  visited: (id, c) => c.ch.visited.includes(id),
  discovered: (id, c) => c.w.state.family.discovered_locations.includes(id),
  discovery_found: (id, c) => c.ch.discoveries.includes(id),
  defeated: (id, c) => c.ch.defeated.includes(id),
  family_defeated: (id, c) => (c.w.state.family.codex.enemies[id]?.defeats ?? 0) > 0,
  policy: (p, c) => (c.w.state.policies as Record<string, unknown>)[p.key] === p.value,
  hp_ratio_lte: (r, c) => c.ch.hp / maxHp(c.rule) <= r,
  fatigue_gte: (n, c) => c.ch.fatigue >= n,
  npc_relation_gte: (p, c) => (c.ch.npc_relations[p.npc] ?? c.w.content.get('npc', p.npc).relation_default) >= p.value,
  in_town: (v, c) => (region(c) ? region(c)!.kind === 'town' : sortie(c) === null) === v,
  guild_aid_active: (v, c) => c.ch.guild_aid.active === v,
  quest_active: (v, c) => (c.ch.quest !== null) === v,
  // 출정 카운터(sorties)는 출정을 마칠 때 오른다: 첫 출정 중에는 0
  first_sortie_of_family: (v, c) =>
    (c.w.state.family.generation === 1 && c.ch.family_role === 'founder' && (c.ch.counters.sorties ?? 0) === 0) === v,
  first_sortie_of_character: (v, c) => ((c.ch.counters.sorties ?? 0) === 0) === v,
  safe_returns_gte: (p, c) => {
    const n = p.where
      ? Object.entries(c.ch.counters_at.safe_returns ?? {}).filter(([id]) => regionMatches(c.w.content, id, p.where)).reduce((s, [, v]) => s + v, 0)
      : (c.ch.counters.safe_returns ?? 0)
    return n >= p.count
  },
  codex_count_gte: (p, c) => Object.keys(c.w.state.family.codex[p.codex as 'items']).length >= p.count,
  codex_complete: (k: 'items' | 'enemies' | 'events' | 'locations', c) => {
    const kind = ({ items: 'item', enemies: 'enemy', events: 'event', locations: 'region' } as const)[k]
    const seen = c.w.state.family.codex[k]
    return c.w.content.list(kind).every((d) => Object.hasOwn(seen, d.id))
  },
  // 기간: 플래그를 남긴 인물의 다음 세대 = 1(12 §7.6)
  reaction_active: (id, c) => {
    const r = c.w.content.get('descendant_reaction', id)
    const fam = c.w.state.family
    const meta = fam.flag_meta[r.flag]
    if (!truthy(fam.flags[r.flag]) || !meta) return false
    const d = fam.generation - meta.set_gen
    return d >= 1 && (r.window_generations === 'permanent' || d <= r.window_generations)
  },
  life_end_kind: (list, c) => !!c.scope.lifeEnd && list.includes(c.scope.lifeEnd.kind),
  died_at: (f, c) => !!c.scope.lifeEnd?.place && regionMatches(c.w.content, c.scope.lifeEnd.place, f),
  thirst_stage_gte: (id, c) => {
    const cur = thirstIndex(c)
    return cur >= 0 && cur >= thirstIndex(c, id)
  },
  combat_kind: (list, c) => !!c.scope.combatKind && list.includes(c.scope.combatKind),
  main_place: (f, c) => !!c.scope.mainPlace && regionMatches(c.w.content, c.scope.mainPlace, f),
}

export function evaluateCondition(cond: Condition, c: CondCtx): boolean {
  if (typeof cond === 'boolean') return cond
  const [key, arg] = Object.entries(cond)[0] as [string, unknown]
  if (key === 'all') return (arg as Condition[]).every((x) => evaluateCondition(x, c))
  if (key === 'any') return (arg as Condition[]).some((x) => evaluateCondition(x, c))
  if (key === 'not') return !evaluateCondition(arg as Condition, c)
  if (key === 'num') {
    const n = arg as { key: string; op: string; value: number }
    return NUM_OP[n.op]!(numValue(n.key, c), n.value)
  }
  const ev = CONDITION_EVAL[key]
  if (!ev) throw new Error(`조건 평가 핸들러가 없다: ${key}`)
  return ev(arg, c)
}

// 범위(장소·사건 변수)를 묶은 평가기. 규칙 층(RuleContext.test)에 그대로 넘긴다
export function makeConditionTest(w: EventWorld, scope: EventScope): ConditionTest {
  const test: ConditionTest = (cond) => {
    const ch = w.state.character
    if (!ch) throw new Error('현재 인물이 없어 조건을 평가할 수 없다')
    return evaluateCondition(cond, { w, scope, ch, rule: ruleContext(w, test) })
  }
  return test
}
