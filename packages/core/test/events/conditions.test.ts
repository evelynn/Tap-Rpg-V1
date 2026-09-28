// 조건 단말 57종 평가(16 §3.2, CONTENT_SCHEMA §4.1). 참·거짓을 한 번씩 본다.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { conditions, createItemInstance, type Condition } from '../../src/index'
import { evaluateCondition, makeConditionTest, ruleContext, TOWN_RETURN_AGE_KEY } from '../../src/events/index'
import { makeWorld, startSortie, type TestWorld } from './fixture'

type Case = { cond: Condition; setup?: (tw: TestWorld) => void; place?: string }

// [조건 이름]: [참이 되는 경우, 거짓이 되는 경우]
const CASES: Record<string, [Case, Case]> = {
  age_gte: [{ cond: { age_gte: 18 } }, { cond: { age_gte: 19 } }],
  age_lt: [{ cond: { age_lt: 19 } }, { cond: { age_lt: 18 } }],
  level_gte: [{ cond: { level_gte: 1 } }, { cond: { level_gte: 2 } }],
  level_lt: [{ cond: { level_lt: 2 } }, { cond: { level_lt: 1 } }],
  life_stage: [{ cond: { life_stage: ['novice'] } }, { cond: { life_stage: ['elder'] } }],
  specific_age: [
    { cond: { specific_age: [20] }, setup: (tw) => { tw.w.state.character!.eff_min = 12 * 2 } },
    { cond: { specific_age: [20] }, setup: (tw) => {
      tw.w.state.character!.eff_min = 12 * 2
      tw.w.state.character!.counters[TOWN_RETURN_AGE_KEY] = 20
    } },
  ],
  location: [{ cond: { location: ['T00'] } }, { cond: { location: ['H1'] } }],
  location_kind: [{ cond: { location_kind: ['town'] } }, { cond: { location_kind: ['dungeon_floor'] } }],
  location_tag: [{ cond: { location_tag: 'dusty' }, place: 'D1' }, { cond: { location_tag: 'dusty' } }],
  location_match: [{ cond: { location_match: { kinds: ['town'] } } }, { cond: { location_match: { tags: ['dark'] } } }],
  season: [{ cond: { season: ['spring'] } }, { cond: { season: ['winter'] } }],
  time_of_day: [
    { cond: { time_of_day: 'day' }, setup: (tw) => startSortie(tw) },
    { cond: { time_of_day: 'night' }, setup: (tw) => startSortie(tw) },
  ],
  last_trip_time: [
    { cond: { last_trip_time: 'night' }, setup: (tw) => { tw.w.state.character!.last_trip_time = 'night' } },
    { cond: { last_trip_time: 'night' } },
  ],
  weather: [
    { cond: { weather: ['rain'] }, setup: (tw) => startSortie(tw, { weather: 'rain' }) },
    { cond: { weather: ['rain'] }, setup: (tw) => startSortie(tw) },
  ],
  attitude: [{ cond: { attitude: ['adventurous'] } }, { cond: { attitude: ['stable'] } }],
  has_trait: [
    { cond: { has_trait: 'TI07' }, setup: (tw) => { tw.w.state.character!.traits = [{ id: 'TI07', since_age: 18, source: 'new' }] } },
    { cond: { has_trait: 'TI07' }, setup: (tw) => { tw.w.state.character!.traits = [] } },
  ],
  trait_hook: [
    { cond: { trait_hook: 'prefer_shortcut' }, setup: (tw) => { tw.w.state.character!.traits = [{ id: 'TI03', since_age: 18, source: 'new' }] } },
    { cond: { trait_hook: 'prefer_shortcut' }, setup: (tw) => { tw.w.state.character!.traits = [] } },
  ],
  has_item: [{ cond: { has_item: 'W02' }, setup: (tw) => giveItem(tw, 'W02') }, { cond: { has_item: 'W02' } }],
  has_item_where: [
    { cond: { has_item_where: { slot: 'weapon' } }, setup: (tw) => giveItem(tw, 'W02') },
    { cond: { has_item_where: { slot: 'weapon', tier_gte: 5 } }, setup: (tw) => giveItem(tw, 'W02') },
  ],
  equipped: [{ cond: { equipped: 'W01' } }, { cond: { equipped: 'W02' } }],
  received_relic: [
    { cond: { received_relic: true }, setup: (tw) => { giveItem(tw, 'W02').inherited_from_gen = 1 } },
    { cond: { received_relic: true }, setup: (tw) => giveItem(tw, 'W02') },
  ],
  has_consumable: [
    { cond: { has_consumable: { carry_groups: ['potion'], count: 1 } }, setup: (tw) => { tw.w.state.inventory.consumables.CP01 = 2 } },
    { cond: { has_consumable: { carry_groups: ['potion'], count: 5 } }, setup: (tw) => { tw.w.state.inventory.consumables.CP01 = 2 } },
  ],
  flag: [
    { cond: { flag: 'life.c01_map_read' }, setup: (tw) => { tw.w.state.character!.flags['life.c01_map_read'] = true } },
    { cond: { flag: 'life.c01_map_read' } },
  ],
  chain_stage: [
    { cond: { chain_stage: { chain: 'C01', stage: 2 } }, setup: (tw) => { tw.w.state.character!.flags['life.c01_stage'] = 2 } },
    { cond: { chain_stage: { chain: 'C01', stage: 2 } } },
  ],
  lifetime_count_lt: [
    { cond: { lifetime_count_lt: { event: 'L01', count: 1 } } },
    { cond: { lifetime_count_lt: { event: 'L01', count: 1 } }, setup: (tw) => { tw.w.state.character!.event_counts.L01 = 1 } },
  ],
  family_count_lt: [
    { cond: { family_count_lt: { event: 'L01', count: 1 } } },
    { cond: { family_count_lt: { event: 'L01', count: 1 } }, setup: (tw) => { tw.w.state.family.event_counts.L01 = 1 } },
  ],
  skill_rank_gte: [
    { cond: { skill_rank_gte: { skill: 'melee', rank: 1 } }, setup: (tw) => { tw.w.state.character!.skills.melee.rank = 2 } },
    { cond: { skill_rank_gte: { skill: 'melee', rank: 1 } } },
  ],
  stat_gte: [{ cond: { stat_gte: { stat: 'str', value: 1 } } }, { cond: { stat_gte: { stat: 'str', value: 99 } } }],
  guild_rank_gte: [
    { cond: { guild_rank_gte: 'bronze' }, setup: (tw) => { tw.w.state.character!.guild_rank = 'silver' } },
    { cond: { guild_rank_gte: 'bronze' } },
  ],
  coins_gte: [{ cond: { coins_gte: 0 } }, { cond: { coins_gte: 99999 } }],
  injury: [
    { cond: { injury: 'serious' }, setup: (tw) => hurt(tw, 'serious') },
    { cond: { injury: 'serious' } },
  ],
  specialization: [{ cond: { specialization: ['none'] } }, { cond: { specialization: ['guardian'] } }],
  second_job_ready: [
    {
      cond: { second_job_ready: true },
      setup: (tw) => { const c = tw.w.state.character!; c.specialization = 'guardian'; c.level = 20; c.skills.melee.rank = 3 },
    },
    { cond: { second_job_ready: true }, setup: (tw) => { const c = tw.w.state.character!; c.specialization = 'guardian'; c.level = 19; c.skills.melee.rank = 3 } },
  ],
  mutation: [{ cond: { mutation: 'none' } }, { cond: { mutation: 'vampire' } }],
  generation_gte: [{ cond: { generation_gte: 1 } }, { cond: { generation_gte: 2 } }],
  visited: [
    { cond: { visited: 'H1' }, setup: (tw) => { tw.w.state.character!.visited.push('H1') } },
    { cond: { visited: 'H1' } },
  ],
  discovered: [
    { cond: { discovered: 'D1' }, setup: (tw) => { tw.w.state.family.discovered_locations.push('D1') } },
    { cond: { discovered: 'D1' } },
  ],
  discovery_found: [
    { cond: { discovery_found: 'A1-1' }, setup: (tw) => { tw.w.state.character!.discoveries.push('A1-1') } },
    { cond: { discovery_found: 'A1-1' } },
  ],
  defeated: [
    { cond: { defeated: 'EB01' }, setup: (tw) => { tw.w.state.character!.defeated.push('EB01') } },
    { cond: { defeated: 'EB01' } },
  ],
  family_defeated: [
    { cond: { family_defeated: 'EB01' }, setup: (tw) => { tw.w.state.family.codex.enemies.EB01 = { first_gen: 1, defeats: 1 } } },
    { cond: { family_defeated: 'EB01' } },
  ],
  policy: [{ cond: { policy: { key: 'auto_equip', value: true } } }, { cond: { policy: { key: 'auto_equip', value: false } } }],
  hp_ratio_lte: [
    { cond: { hp_ratio_lte: 0.5 }, setup: (tw) => { tw.w.state.character!.hp = 1 } },
    { cond: { hp_ratio_lte: 0.5 } },
  ],
  fatigue_gte: [{ cond: { fatigue_gte: 0 } }, { cond: { fatigue_gte: 1 } }],
  npc_relation_gte: [
    { cond: { npc_relation_gte: { npc: 'N01', value: 5 } }, setup: (tw) => { tw.w.state.character!.npc_relations.N01 = 7 } },
    { cond: { npc_relation_gte: { npc: 'N01', value: 5 } } },
  ],
  in_town: [{ cond: { in_town: true } }, { cond: { in_town: true }, place: 'H1' }],
  guild_aid_active: [
    { cond: { guild_aid_active: true }, setup: (tw) => { tw.w.state.character!.guild_aid.active = true } },
    { cond: { guild_aid_active: true } },
  ],
  quest_active: [
    { cond: { quest_active: true }, setup: (tw) => { tw.w.state.character!.quest = quest() } },
    { cond: { quest_active: true } },
  ],
  first_sortie_of_family: [{ cond: { first_sortie_of_family: true } }, { cond: { first_sortie_of_family: true }, setup: (tw) => { tw.w.state.character!.counters.sorties = 1 } }],
  first_sortie_of_character: [{ cond: { first_sortie_of_character: true } }, { cond: { first_sortie_of_character: true }, setup: (tw) => { tw.w.state.character!.counters.sorties = 3 } }],
  safe_returns_gte: [
    { cond: { safe_returns_gte: { count: 2, where: { kinds: ['dungeon_floor'] } } }, setup: (tw) => { tw.w.state.character!.counters_at.safe_returns = { D1: 2 } } },
    { cond: { safe_returns_gte: { count: 2, where: { kinds: ['dungeon_floor'] } } } },
  ],
  codex_count_gte: [
    { cond: { codex_count_gte: { codex: 'enemies', count: 1 } }, setup: (tw) => { tw.w.state.family.codex.enemies.EN01 = { first_gen: 1, defeats: 1 } } },
    { cond: { codex_count_gte: { codex: 'enemies', count: 1 } } },
  ],
  codex_complete: [
    { cond: { codex_complete: 'locations' }, setup: (tw) => {
      for (const r of tw.w.content.list('region')) tw.w.state.family.codex.locations[r.id] = { first_gen: 1 }
    } },
    { cond: { codex_complete: 'locations' } },
  ],
  reaction_active: [
    { cond: { reaction_active: 'dr_c01_rescue' }, setup: (tw) => {
      tw.w.state.family.generation = 2
      tw.w.state.family.flags['fam.c01_rescue'] = true
      tw.w.state.family.flag_meta['fam.c01_rescue'] = { set_gen: 1 }
    } },
    { cond: { reaction_active: 'dr_c01_rescue' } },
  ],
  life_end_kind: [
    { cond: { life_end_kind: ['died'] }, setup: (tw) => { tw.scope.lifeEnd = { kind: 'died', place: 'D3' } } },
    { cond: { life_end_kind: ['died'] } },
  ],
  died_at: [
    { cond: { died_at: { kinds: ['dungeon_floor'] } }, setup: (tw) => { tw.scope.lifeEnd = { kind: 'died', place: 'D3' } } },
    { cond: { died_at: { kinds: ['dungeon_floor'] } } },
  ],
  thirst_stage_gte: [
    { cond: { thirst_stage_gte: 'starving' }, setup: (tw) => vampire(tw, 80) },
    { cond: { thirst_stage_gte: 'starving' }, setup: (tw) => vampire(tw, 10) },
  ],
  combat_kind: [
    { cond: { combat_kind: ['boss_gate'] }, setup: (tw) => { tw.scope.combatKind = 'boss_gate' } },
    { cond: { combat_kind: ['boss_gate'] } },
  ],
  main_place: [
    { cond: { main_place: { kinds: ['dungeon_floor'] } }, setup: (tw) => { tw.scope.mainPlace = 'D2' } },
    { cond: { main_place: { kinds: ['dungeon_floor'] } } },
  ],
}

function giveItem(tw: TestWorld, defId: string) {
  const inst = createItemInstance(tw.w.content, tw.w.state, defId, undefined, {
    gen: 1, char_uid: tw.w.state.character!.uid, age: 18, location: 'T00', source: 'test',
  })
  tw.w.state.inventory.bag.push(inst.uid)
  return inst
}

function hurt(tw: TestWorld, grade: 'light' | 'serious') {
  tw.w.state.character!.injuries.push({ grade, stat: 'str', remaining_min: 10, source: 'test' })
}

function vampire(tw: TestWorld, thirst: number) {
  tw.w.state.character!.mutation = { trait_id: 'TM01', since_age: 40, long_sleep_age: 98, thirst }
}

const quest = () => ({
  event_id: 'L06', location_id: 'H2', enemy_id: 'EN03', goal_wins: 5, wins: 0,
  reward: { coin_units: 3, xp_units: 3 }, accepted_eff_min: 0, deadline: 'next_sortie' as const,
})

function evaluate(c: Case): boolean {
  const tw = makeWorld()
  tw.scope.place = c.place ?? 'T00'
  tw.w.state.character!.location = tw.scope.place
  c.setup?.(tw)
  return makeConditionTest(tw.w, tw.scope)(c.cond)
}

describe('조건 평가기', () => {
  it('등록된 단말을 모두 시험한다', () => {
    assert.deepEqual(Object.keys(CASES).sort(), conditions.names().sort())
  })

  for (const [name, [yes, no]] of Object.entries(CASES)) {
    it(name, () => {
      assert.equal(evaluate(yes), true, `${name}: 참이어야 한다`)
      assert.equal(evaluate(no), false, `${name}: 거짓이어야 한다`)
    })
  }

  it('결합자 all·any·not·num', () => {
    const tw = makeWorld()
    const test = makeConditionTest(tw.w, tw.scope)
    assert.equal(test({ all: [{ level_gte: 1 }, { age_gte: 18 }] }), true)
    assert.equal(test({ any: [{ level_gte: 9 }, { age_gte: 18 }] }), true)
    assert.equal(test({ not: { level_gte: 9 } }), true)
    assert.equal(test({ num: { key: 'level', op: '==', value: 1 } }), true)
    assert.equal(test({ num: { key: 'counter.wins', op: '>', value: 0 } }), false)
    assert.equal(test({ all: [] }), true)
    assert.equal(test({ any: [] }), false)
  })

  it('num 키: 능력치·숙련·플래그·장소별 카운터·활동 가중치', () => {
    const tw = makeWorld()
    const ch = tw.w.state.character!
    ch.stats.str = 5
    ch.skills.search.rank = 2
    ch.flags['life.c01_stage'] = 2
    ch.counters_at.safe_returns = { D1: 3 }
    tw.scope.activityWeight = (a) => (a === 'dungeon' ? 30 : 0)
    const test = makeConditionTest(tw.w, tw.scope)
    assert.equal(test({ num: { key: 'stat.str', op: '>=', value: 5 } }), true)
    assert.equal(test({ num: { key: 'skill.search', op: '==', value: 2 } }), true)
    assert.equal(test({ num: { key: 'flag.life.c01_stage', op: '>=', value: 2 } }), true)
    assert.equal(test({ num: { key: 'counter.safe_returns.D1', op: '==', value: 3 } }), true)
    assert.equal(test({ num: { key: 'activity_weight.dungeon', op: '>=', value: 25 } }), true)
  })

  it('플래그 키의 자리 바인딩 {place}를 장소로 바꾼다', () => {
    const tw = makeWorld()
    tw.scope.place = 'H1'
    tw.w.state.character!.flags['life.l01_marked_H1'] = true
    assert.equal(makeConditionTest(tw.w, tw.scope)({ flag: 'life.l01_marked_{place}' }), true)
    tw.scope.place = 'H2'
    assert.equal(makeConditionTest(tw.w, tw.scope)({ flag: 'life.l01_marked_{place}' }), false)
  })

  it('평가에 부수 효과와 난수가 없다', () => {
    const tw = makeWorld()
    const before = JSON.stringify(tw.w.snapshot())
    const test = makeConditionTest(tw.w, tw.scope)
    for (const [, [yes]] of Object.entries(CASES)) {
      try {
        test(yes.cond)
      } catch {
        // 문맥이 없는 조건(scope 전용)은 거짓이거나 예외 없이 지나간다
      }
    }
    assert.equal(JSON.stringify(tw.w.snapshot()), before)
    assert.ok(evaluateCondition(true, { w: tw.w, scope: tw.scope, ch: tw.w.state.character!, rule: ruleContext(tw.w, test) }))
  })
})
