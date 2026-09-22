import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { condition, conditions, effectList, effects, registerCondition, registerEffect } from '../../../src/schema/common'
import {
  chainSchema, contextSelectors, derivedChainFlags, flagDefSchema, registerTextSlot, selectorYields,
  templateVars, textSchema, textSlots,
} from '../../../src/schema/event/index'

const ok = (schema: z.ZodType, value: unknown) => {
  const r = schema.safeParse(value)
  assert.deepEqual(r.success ? [] : r.error.issues.map((i) => `${i.path.join('/')}: ${i.message}`), [])
}
const fails = (schema: z.ZodType, value: unknown) => assert.equal(schema.safeParse(value).success, false)

const C01 = {
  id: 'C01', name: '광부의 지도', stages: 3, outcomes: ['rescue', 'treasure', 'guild'],
  family_once: true, inheritable: true,
  resume_at: [
    { stage: 1, when: { location: ['D1'] }, line: '수첩에 끼워진 찢어진 지도' },
    { stage: 2, when: { in_town: true }, line: '수첩에 끼워진 찢어진 지도' },
  ],
  unfinished_line: '끝나지 않은 이야기 — {chain_name}: {last_step_summary}',
  stage_summaries: ['찢어진 지도를 주웠다', '세나에게 약속했다', '무너진 다리에 이르렀다'],
  major_branch_stage: 3,
}

// 16 §3.2 43종에서 thirst_gte를 뺀 42종 + CONTENT_SCHEMA §4.1 신설 15종
const CONDITIONS_16 = [
  'age_gte', 'age_lt', 'level_gte', 'level_lt', 'life_stage', 'specific_age', 'location', 'location_kind', 'location_tag',
  'season', 'time_of_day', 'last_trip_time', 'weather', 'attitude', 'has_trait', 'has_item', 'has_item_where', 'equipped',
  'flag', 'chain_stage', 'lifetime_count_lt', 'family_count_lt', 'skill_rank_gte', 'stat_gte', 'guild_rank_gte', 'coins_gte',
  'injury', 'specialization', 'mutation', 'generation_gte', 'visited', 'discovered', 'defeated', 'family_defeated', 'policy',
  'hp_ratio_lte', 'fatigue_gte', 'npc_relation_gte', 'in_town', 'guild_aid_active', 'quest_active', 'first_sortie_of_family',
]
const CONDITIONS_NEW = [
  'location_match', 'trait_hook', 'received_relic', 'discovery_found', 'first_sortie_of_character', 'safe_returns_gte',
  'codex_count_gte', 'codex_complete', 'reaction_active', 'life_end_kind', 'died_at', 'thirst_stage_gte', 'combat_kind', 'main_place',
  'has_consumable',
]
// 16 §4.3 50종 + CONTENT_SCHEMA §4.2 신설 6종
const EFFECTS_16 = [
  'add_coins', 'remove_coins', 'add_xp', 'heal', 'damage', 'add_fatigue', 'injury', 'cure_injury', 'life_stat_add', 'add_item',
  'add_random_item', 'remove_item', 'add_consumable', 'offer_purchase', 'add_trait', 'remove_trait', 'specialize',
  'extend_lifespan', 'mutate', 'register_relic', 'create_child_candidate', 'set_flag', 'clear_flag', 'set_family_flag',
  'set_trip_flag', 'clear_trip_flag', 'counter_add', 'advance_chain', 'end_chain', 'unlock_location', 'set_destination',
  'accept_quest', 'sortie_mod', 'dungeon_mod', 'add_time', 'end_sortie', 'temp_mod', 'shop_discount', 'start_combat', 'chance',
  'if', 'on_town_return', 'schedule_event', 'reopen_choices', 'npc_relation', 'skill_use', 'family_record', 'unlock_family',
  'journal', 'animation',
]
const EFFECTS_NEW = ['add_material', 'remove_consumable', 'roll_check', 'reveal_discovery', 'open_chest', 'create_partner']
// 16 §1.4.3 변수 등록표 전부(78개)
const TEMPLATE_VARS_16 = [
  'name', 'heir', 'parent_name', 'parent_call', 'partner', 'job', 'child', 'guardian', 'friend', 'family', 'generation', 'age',
  'level', 'attitude', 'spec', 'kind', 'rank', 'role', 'retire_age', 'retire_age_plus10', 'sleep_age', 'luck', 'luck_after',
  'start', 'end', 'age_word', 'season',
  'place', 'feature', 'depth', 'rumor_place', 'target_place', 'item', 'old_item', 'weapon', 'relic', 'relic_name', 'relic_note',
  'loot', 'npc', 'enemy', 'enemy_kind', 'coins', 'count', 'n', 'm', 'first_page', 'memory', 'achievement', 'chain_name',
  'last_step_summary', 'binder', 'trait', 'old_trait', 'trait_name', 'trait_reason', 'trait_adj', 'skill', 'injury', 'change',
  'dice', 'stat', 'stat_value', 'bonus_name', 'bonus', 'luck_half', 'total', 'dc', 'result', 'cost', 'reason', 'rule',
  'choice_short', 'offer', 'quote', 'risk_line', 'injury_line', 'final_check_line',
]
const sorted = (xs: readonly string[]) => [...xs].sort()

describe('기본 등록', () => {
  it('조건 57종·효과 56종·선택자 5종·템플릿 변수(16 §1.4.3 전부)의 이름이 문서 목록과 같다', () => {
    assert.equal(CONDITIONS_16.length, 42)
    assert.equal(EFFECTS_16.length, 50)
    assert.equal(TEMPLATE_VARS_16.length, 78)
    assert.deepEqual(sorted(conditions.names()), sorted([...CONDITIONS_16, ...CONDITIONS_NEW]))
    assert.deepEqual(sorted(effects.names()), sorted([...EFFECTS_16, ...EFFECTS_NEW]))
    assert.deepEqual(contextSelectors.names(), ['rumor_place', 'best_hunting_ground', 'main_enemy_of', 'random_friend_name', 'offered_relic'])
    assert.deepEqual(selectorYields('offered_relic'), ['relic_name', 'relic_note'])
    assert.deepEqual(sorted(templateVars.list().map((v) => v.pattern)), sorted(TEMPLATE_VARS_16))
    assert.equal(templateVars.match('rumor_place')?.meta.source, 'event')
    assert.equal(templateVars.match('name')?.meta.source, 'context')
    assert.equal(templateVars.match('die'), undefined) // 옛 표기는 등록하지 않는다
  })

  it('첫 검증 뒤 조건·효과 등록은 예외', () => {
    condition.safeParse(true)
    assert.throws(() => registerCondition('late_cond', z.boolean()), /잠겼다/)
    effectList.safeParse([{ type: 'add_time', sec: 1 }])
    assert.throws(() => registerEffect('late_effect', {}), /잠겼다/)
  })
})

describe('chain', () => {
  it('C01 통과, 파생 플래그가 등록표 형식에 맞는다', () => {
    ok(chainSchema, C01)
    const flags = derivedChainFlags(chainSchema.parse(C01))
    assert.deepEqual(flags.map((f) => f.id), ['life.c01_stage', 'fam.c01_done', 'fam.c01_rescue', 'fam.c01_treasure', 'fam.c01_guild', 'fam.c01_unfinished'])
    for (const f of flags) ok(flagDefSchema, f)
    assert.deepEqual(flags[0]!.value, { int: [0, 3] })
  })

  it('outcome done은 완료 플래그와 같은 키로 친다', () => {
    const ids = derivedChainFlags({ id: 'C02', stages: 3, outcomes: ['done'] }).map((f) => f.id)
    assert.deepEqual(ids, ['life.c02_stage', 'fam.c02_done', 'fam.c02_unfinished'])
  })

  it('하이픈 id, 단계 요약 수 불일치, 겹치는 outcome은 실패', () => {
    fails(chainSchema, { ...C01, id: 'C01-A' })
    fails(chainSchema, { ...C01, id: 'c01' })
    fails(chainSchema, { ...C01, stage_summaries: ['하나'] })
    fails(chainSchema, { ...C01, outcomes: ['rescue', 'rescue'] })
  })
})

describe('flag 등록표', () => {
  it('키 묶음은 자리 종류를 family에 적는다', () => {
    ok(flagDefSchema, { id: 'life.l01_marked_{place}', scope: 'life', value: 'bool', family: { place: 'region' }, set_by: 'L01', read_by: 'L01' })
    ok(flagDefSchema, { id: 'fam.specialist_{kind}', scope: 'fam', value: 'bool', family: { kind: 'specialization' }, set_by: 'F01', read_by: '12' })
    ok(flagDefSchema, { id: 'fam.c01_unfinished', scope: 'fam', value: { int: [1, 2] }, set_by: '10', read_by: '10' })
    fails(flagDefSchema, { id: 'life.l01_marked_{place}', scope: 'life', value: 'bool', set_by: 'x', read_by: 'y' })
    fails(flagDefSchema, { id: 'life.l01_marked_{place}', scope: 'life', value: 'bool', family: { role: 'retire_role' }, set_by: 'x', read_by: 'y' })
    fails(flagDefSchema, { id: 'life.honest_finder', scope: 'fam', value: 'bool', set_by: 'x', read_by: 'y' })
    fails(flagDefSchema, { id: 'life.honest_finder', scope: 'life', value: 'bool', set_by: 'x', read_by: 'y', trip_modifiers: [] })
    fails(flagDefSchema, { id: 'Life.x', scope: 'life', value: 'bool', set_by: 'x', read_by: 'y' })
  })
})

describe('text', () => {
  it('문형 id 패턴과 슬롯 등록', () => {
    ok(textSchema, { id: 'journal.hunt.win_generic', tag: 'hunt', variants: ['{enemy:을/를} 물리쳤다', '{enemy}를 쫓아 보냈다'] })
    fails(textSchema, { id: 'journal', variants: ['a'] })
    fails(textSchema, { id: 'journal.hunt', variants: [] })
    fails(textSchema, { id: 'journal.hunt', variants: ['짝 없는 {괄호'] })
    fails(textSchema, { id: 'journal.hunt', variants: ['{Name:이/가} 왔다'] }) // 변수 이름은 snake_case
    fails(textSchema, { id: 'journal.hunt', variants: ['{name:이/은} 왔다'] }) // 조사 쌍은 렌더러의 9종만
    registerTextSlot('journal.rest.inn', '여관 휴식')
    assert.ok(textSlots.match('journal.rest.inn'))
    assert.throws(() => registerTextSlot('Journal.x'))
  })
})
