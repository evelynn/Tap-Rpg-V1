// 새 가문과 첫 인물(05 §2, 06 §6, 12 §3·§8.1, 01 §9.7). 이름·외형·출신 배경은 밖에서 받는다.
// 출발 계절은 주지 않으면 life 흐름으로 뽑는다(01 §1.1 무작위, 특성·능력치 다음).
import type { Content } from '../content/index'
import { createRngStreams, RNG_STREAMS, type Pcg32 } from '../rng/index'
import { SEASONS, SKILLS, STATS, type GRADES } from '../schema/index'
import { emptyLifeLoop } from '../state/activity'
import { emptyBlessing, type Appearance, type Character } from '../state/character'
import type { Family } from '../state/family'
import type { ItemInstance } from '../state/inventory'
import { defaultPolicies, type SaveBody } from '../state/save'
import { issueUid } from '../state/uid'
import { drawNewInnateTraits, rollBirthStats } from '../rules/birth'
import { constantConditionTest, type ConditionTest } from '../rules/context'
import { maxHp } from '../rules/derived'
import { skillRank } from '../rules/growth'

export interface NewCharacterInput {
  name: string
  background: string
  birthSeason?: (typeof SEASONS)[number]
  appearance: Appearance
}

export interface NewFamilyInput {
  familyName: string
  familySeed: string // 16자리 소문자 16진
  foundedUtc: number
  character: NewCharacterInput
}

export function newFamily(input: Pick<NewFamilyInput, 'familyName' | 'familySeed' | 'foundedUtc'>): Family {
  return {
    family_id: 'fa_0001',
    name: input.familyName,
    family_seed: input.familySeed,
    generation: 1,
    founded_utc: input.foundedUtc,
    next_uid: { ch: 1, it: 1, jr: 1, sortie: 1 },
    chronicle: [],
    codex: { items: {}, seen: {}, enemies: {}, events: {}, locations: {} },
    discovered_locations: [],
    discovery_points: [],
    bonds: [],
    flags: {},
    flag_meta: {},
    event_counts: {},
    counters: {},
    unlocks: { backgrounds: [], appearances: [], titles: [] },
    achievements: {},
    notices_shown: {},
    blessing: { charges: 0, total_used: 0 },
    technique_note: null,
    keepsakes: [],
    retirees: [],
    candidates: {},
  }
}

// 장비 인스턴스를 만들어 state.item_instances에 넣는다. 등급 고정 장비는 fixed_grade
export function createItemInstance(
  content: Content,
  state: SaveBody,
  defId: string,
  grade: (typeof GRADES)[number] | undefined,
  acquired: ItemInstance['acquired'],
): ItemInstance {
  const def = content.get('item', defId)
  const inst: ItemInstance = {
    uid: issueUid(state.family, 'it'),
    def_id: defId,
    grade: def.fixed_grade ?? grade ?? 'common',
    locked: false,
    acquired,
    history: [],
  }
  state.item_instances[inst.uid] = inst
  // 가문 도감(12 §7.2): 처음 가진 인물과 본 등급
  const seen = (state.family.codex.items[defId] ??= { first_gen: acquired.gen, first_char: acquired.char_uid, grades_seen: [], first_place: acquired.location })
  if (!seen.grades_seen.includes(inst.grade)) seen.grades_seen.push(inst.grade)
  return inst
}

// 도감 `본 적 있음`(12 §7.2, D87): 가문 인물이 상점 진열·사건 제안에서 본 장비
export function seeItem(state: Pick<SaveBody, 'family'>, defId: string): void {
  state.family.codex.seen[defId] ??= { first_gen: state.family.generation }
}

// 첫 가문의 첫 인물까지 만든 저장 본문. 난수는 life 흐름(선천 특성 → 출생 능력치 순서, 05 §2.1)
export function createNewFamilyState(content: Content, input: NewFamilyInput, test: ConditionTest = constantConditionTest): SaveBody {
  const b = content.balance
  const rng = createRngStreams(input.familySeed)
  const family = newFamily(input)
  family.blessing.charges = content.balance.blessing.start // 첫 가문 별빛(01 §19)
  const bg = content.get('background', input.character.background)
  if (bg.unlock !== null && !family.unlocks.backgrounds.includes(bg.id)) throw new Error(`출신 배경 '${bg.id}'이 해금되지 않았다`)

  const town = content.list('region').find((r) => r.kind === 'town')
  if (!town) throw new Error('시작 마을(kind town)이 없다')
  const ranks = [...content.list('guild_rank')].sort((x, y) => x.order - y.order)
  if (!ranks[0]) throw new Error('길드 등급이 없다')
  const policies = defaultPolicies(content)

  const traits = drawNewInnateTraits(content, rng.life, [])
  const stats = rollBirthStats(content, rng.life, { traits, background: bg.id })
  const birthSeason = input.character.birthSeason ?? rng.life.pick(SEASONS)
  const skills = Object.fromEntries(SKILLS.map((s) => [s, { uses: 0, rank: 0 }])) as Character['skills']
  if (bg.start_skill) {
    // 시작 숙련 1단계 = 누적 사용 횟수 첫 문턱(12 §8.1)
    const uses = b.skills.rank_thresholds[0] ?? 0
    skills[bg.start_skill] = { uses, rank: skillRank(content, uses) }
  }

  const state: SaveBody = {
    family,
    character: null,
    inventory: {
      equipped: { weapon: null, armor: null, accessory: null, relic: null },
      bag: [],
      pending_box: [],
      consumables: {},
      relic_designations: [],
      equip_suggestions: [],
      dismissed_suggestions: [],
    },
    item_instances: {},
    journal: [],
    pending_choice: null,
    current_activity: {
      state: 'town_idle', paused_from: null, next_sortie_override: null, sortie: null, pending_town_effects: [], resolved_action: null,
      life_loop: emptyLifeLoop(),
    },
    rng_state: { algorithm: 'pcg32', streams: rngStates(rng) },
    offline_state: { high_water_utc: input.foundedUtc, last_exit_utc: input.foundedUtc, last_settlement: null, clock_anomalies: [] },
    policies,
  }

  const ch: Character = {
    uid: issueUid(family, 'ch'),
    name: input.character.name,
    generation: family.generation,
    family_role: 'founder',
    parent_uid: null,
    parent_call: null,
    background: bg.id,
    appearance: input.character.appearance,
    birth_season: birthSeason,
    birth_stats: { ...stats },
    stats,
    stat_growth: [],
    life_stat_mods: [],
    stat_use_points: Object.fromEntries(STATS.map((s) => [s, 0])) as Character['stat_use_points'],
    level: 1,
    xp: 0,
    skills,
    traits: traits.map((id) => ({ id, since_age: b.time.start_age, source: 'new' as const })),
    injuries: [],
    hp: 0,
    fatigue: 0,
    eff_min: 0,
    retire_age: b.time.base_retire_age,
    lifespan_extended: false,
    specialization: 'none',
    job2: null,
    techniques: [],
    f01_presentations: 0,
    spec_deferred_until_level: null,
    mutation: null,
    guild_rank: ranks[0].id,
    coins: b.economy.starting_kit.coins,
    location: town.id,
    counters: {},
    counters_at: {},
    flags: {},
    temp_mods: [],
    quest: null,
    event_counts: {},
    event_last_min: {},
    recent_life_events: [],
    event_pity: {},
    npc_relations: {},
    visited: [],
    defeated: [],
    children: [],
    heir_preferred: null,
    attitude_log: [{ eff_min: 0, attitude: policies.attitude }],
    recent_summaries: [],
    blessing: emptyBlessing(),
    last_trip_time: null,
    guild_aid: { active: false, started_eff_min: null, recovered: false },
    scheduled_events: [],
    shop_discounts: [],
    next_visit_mods: {},
    line_variant_last: {},
    discoveries: [],
    map_fragments: [],
    discovery_fail_bonus: {},
    chain_mission: {},
    deficit: {},
    decision_seq: 0,
    miss_streak: 0,
    activity_streak: null,
    low_cap_streak: 0,
  }
  state.character = ch

  // 시작 소지품(01 §9.7): 동전·소모품·장비(빈 슬롯이면 장착, 아니면 가방)
  const kit = b.economy.starting_kit
  state.inventory.consumables = { ...kit.consumables }
  for (const id of kit.items) {
    const inst = createItemInstance(content, state, id, undefined, {
      gen: family.generation, char_uid: ch.uid, age: b.time.start_age, location: town.id, source: 'start',
    })
    const slot = content.get('item', id).slot
    if (state.inventory.equipped[slot] === null) state.inventory.equipped[slot] = inst.uid
    else state.inventory.bag.push(inst.uid)
  }
  ch.hp = maxHp({ content, state, test })
  state.rng_state.streams = rngStates(rng)
  return state
}

export function rngStates(rng: Record<(typeof RNG_STREAMS)[number], Pcg32>): SaveBody['rng_state']['streams'] {
  return Object.fromEntries(RNG_STREAMS.map((s) => [s, rng[s].toState()])) as SaveBody['rng_state']['streams']
}
