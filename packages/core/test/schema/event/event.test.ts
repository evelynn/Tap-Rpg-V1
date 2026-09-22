import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { z } from 'zod'
import { condition, effectList, modifier } from '../../../src/schema/common'
import { checkDcRule, combatSchema, effectPath, eventSchema, flagDefSchema, listChancePaths } from '../../../src/schema/event/index'

type Json = Record<string, any>

const fixture = (name: string): Json => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))

function problems(schema: z.ZodType, value: unknown): string[] {
  const r = schema.safeParse(value)
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('/')}: ${i.message}`)
}

function rulesOf(schema: z.ZodType, value: unknown): string[] {
  const r = schema.safeParse(value)
  return r.success ? [] : r.error.issues.map((i) => (i as { params?: { rule?: string } }).params?.rule ?? 'S01')
}

describe('사건 fixture(11 → JSON)', () => {
  for (const name of ['L01', 'L06', 'C01-3', 'F03']) {
    it(`${name} 통과`, () => assert.deepEqual(problems(eventSchema, fixture(name)), []))
  }

  it('L01 돌탑 바인딩: 사건 가중·판정 보정·표식 효과가 {place}를 쓴다', () => {
    const e = eventSchema.parse(fixture('L01'))
    assert.deepEqual(e.weight_mods?.[0]?.when, { flag: 'life.l01_marked_{place}' })
  })
})

describe('16 §4.6 결과 조각', () => {
  it('효과 조각 전부 통과(L03 trip 수정자는 등록표 trip_modifiers로 옮김)', () => {
    const fragments: unknown[][] = [
      [ { type: 'add_fatigue', value: 3 }, { type: 'set_trip_flag', key: 'trip.rain_hunt', remaining: { encounters: 2 } } ],
      [ { type: 'add_coins', units: 2 }, { type: 'chance', p: 0.2, then: [ { type: 'add_item', item_id: 'J02', grade: 'common', to: 'bag' } ] } ],
      [ { type: 'accept_quest', quest: 'L06', location_var: 'target_place', enemy_var: 'enemy', goal_wins: 5, deadline: 'next_sortie',
          reward: { coin_units: 6, xp_units: 2 }, settle: 'ratio_floor', cancel_on: 'serious_injury',
          lines: { complete: '의뢰를 마쳤다', partial: '의뢰 절반을 해냈다', cancel: '의뢰를 내려놓았다' } } ],
      [ { type: 'set_destination', place_var: 'rumor_place', scope: 'next_sortie', respect_risk_cap: true },
        { type: 'temp_mod', scope: 'next_sortie', modifier: { target: 'discovery_chance_mult', op: 'mul', value: 1.5 } } ],
      [ { type: 'set_trip_flag', key: 'trip.extra_treasure_room' },
        { type: 'dungeon_mod', op: 'add_room', room_kind: 'treasure', count: 1, scope: 'this_sortie' } ],
      [ { type: 'offer_purchase', pool: { facilities: ['smithy'], slots: ['weapon', 'armor'] }, tier: 'character',
          grade_weights: { common: 1 }, price_mult: 0.4, defect: [ { target: 'hit', op: 'add', value: -1 } ],
          exempt_discount_cap: true, respect_auto_buy: true } ],
      [ { type: 'extend_lifespan', years: 10, cap: 98 },
        { type: 'if', cond: { has_item_where: { slot: 'relic', grade_gte: 'rare' } },
          then: [ { type: 'remove_item', selector: 'chosen_relic' } ],
          else: [ { type: 'life_stat_add', stat: 'luk', value: -2, floor: 0 } ] },
        { type: 'set_family_flag', key: 'fam.f02_drank' } ],
      // §3.1 L05 바인딩
      [ { type: 'temp_mod', modifier: { target: 'discovery_chance_mult', op: 'mul', value: 2 }, scope: 'next_visit', location: '{rumor_place}' },
        { type: 'temp_mod', modifier: { target: 'location_score.{rumor_place}', op: 'add', value: 15 }, scope: 'next_decision' } ],
    ]
    for (const f of fragments) assert.deepEqual(problems(effectList, f), [])
    assert.deepEqual(problems(flagDefSchema, {
      id: 'trip.rain_hunt', scope: 'trip', value: 'bool', set_by: 'L03', read_by: '경험치',
      trip_modifiers: [ { target: 'xp_mult', op: 'mul', value: 1.2 } ],
    }), [])
  })

  it('L07 선택지 전투 조각 통과', () => {
    assert.deepEqual(problems(combatSchema, {
      enemies: [ { by_location: { H2: 'EN03', A2: 'EN03', H3: 'EN04' } } ], count: 1,
      pre_check: { kind: 'fear', dc_offset: 0, on_fail: [ { target: 'hit', op: 'add', value: -2 } ] },
      reward_mult: 1.5,
    }), [])
  })
})

describe('effect_path', () => {
  it('문자열 형식', () => {
    assert.equal(effectPath('treasure', 'success', [1]), 'treasure/success/1')
    assert.equal(effectPath('decline', 'always', [2, 'then', 0]), 'decline/always/2.then/0')
  })

  it('roll_check 안의 chance까지 나열한다', () => {
    const e = fixture('L01')
    e.choices[1].outcomes.always.effects = [
      { type: 'roll_check', check: { kind: 'fear', dc_offset: 0 },
        success: [ { type: 'chance', p: 0.5, then: [ { type: 'add_coins', units: 1 } ] } ],
        failure: [ { type: 'add_fatigue', value: 2 } ] },
      { type: 'chance', p: 0.2, then: [ { type: 'add_coins', units: 1 } ],
        else: [ { type: 'chance', p: 0.5, then: [ { type: 'add_fatigue', value: 1 } ] } ] },
    ]
    assert.deepEqual(listChancePaths(eventSchema.parse(e)), ['grab/always/0.success/0', 'grab/always/1', 'grab/always/1.else/0'])
  })
})

describe('실패해야 하는 것', () => {
  it('단말 키 2개', () => {
    assert.ok(problems(condition, { age_gte: 30, age_lt: 50 }).length > 0)
  })

  it('policy key는 16 §5.9 방침 필드 이름만(V3)', () => {
    assert.deepEqual(problems(condition, { policy: { key: 'lethal_allowed', value: true } }), [])
    assert.deepEqual(rulesOf(condition, { policy: { key: 'atitude', value: 'stable' } }), ['V3'])
  })

  it('미등록 효과', () => {
    assert.ok(problems(effectList, [ { type: 'no_such_effect' } ]).length > 0)
  })

  it('효과 문법은 V4, 수정자 문법은 V3(안쪽 규칙 번호는 유지)', () => {
    assert.deepEqual(rulesOf(effectList, [ { type: 'no_such_effect' } ]), ['V4'])
    assert.deepEqual(rulesOf(effectList, [ { type: 'add_trait' } ]), ['V4'])
    assert.deepEqual(rulesOf(effectList, [ { type: 'chance', p: 2, then: [] } ]), ['V4'])
    assert.deepEqual(rulesOf(effectList, [ { type: 'if', cond: { nope: true }, then: [] } ]), ['V3'])
    assert.deepEqual(rulesOf(modifier, { target: 'no_such_target', op: 'add', value: 1 }), ['V3'])
    assert.deepEqual(rulesOf(modifier, { target: 'hit', op: 'flag', value: true }), ['V3'])
  })

  it('위험 없음·낮음 선택지는 hold와 분류에 관계없이 필요(V7)', () => {
    const e = fixture('C01-3')
    for (const c of e.choices) c.risk = 'medium'
    assert.deepEqual(rulesOf(eventSchema, e), ['V7'])
  })

  it('set_flag에 fam. 키', () => {
    assert.ok(problems(effectList, [ { type: 'set_flag', key: 'fam.f03_refused' } ]).length > 0)
  })

  it('hold none인데 short 없음(V7)', () => {
    const e = fixture('L01')
    delete e.choices[0].short
    assert.deepEqual(rulesOf(eventSchema, e), ['V7'])
  })

  it('system 사건은 선택지가 여럿이어도 tags·short 면제(V7), risk none·low는 필요', () => {
    const e = fixture('L01')
    Object.assign(e, { category: 'system', triggers: ['system'], system: { order: 1, phase: 'life_end' } })
    for (const c of e.choices) { delete c.tags; delete c.short }
    assert.deepEqual(problems(eventSchema, e), [])
    for (const c of e.choices) c.risk = 'medium'
    assert.deepEqual(rulesOf(eventSchema, e), ['V7'])
  })

  it('신설 파라미터: remove_coins inn_costs(하나만), skill_use lowest_rank, received_relic true', () => {
    assert.deepEqual(problems(effectList, [ { type: 'remove_coins', inn_costs: 1 }, { type: 'skill_use', skill: 'lowest_rank', count: 10 } ]), [])
    assert.ok(problems(effectList, [ { type: 'remove_coins', inn_costs: 1, amount: 5 } ]).length > 0)
    assert.ok(problems(effectList, [ { type: 'skill_use', skill: 'highest_rank', count: 1 } ]).length > 0)
    assert.deepEqual(problems(condition, { received_relic: true }), [])
    assert.ok(problems(condition, { received_relic: false }).length > 0)
    assert.ok(problems(condition, { has_consumable: { carry_groups: [], count: 1 } }).length > 0)
  })

  it('fate인데 decline 없음(V14)', () => {
    const e = fixture('F03')
    delete e.choices[1].decline
    assert.deepEqual(rulesOf(eventSchema, e), ['V14'])
  })

  it('fixed 판정에 dc_offset(V20, balance 표로 W1이 부름)', () => {
    const dcKind: Record<string, string> = { haggle: 'fixed', persuade: 'event', lore: 'event', forage: 'region', flee: 'level_formula' }
    const of = (k: string) => dcKind[k]
    assert.match(checkDcRule({ kind: 'haggle', dc_offset: 2 }, of) ?? '', /dc_offset/)
    assert.equal(checkDcRule({ kind: 'haggle', dc: 16 }, of), undefined)
    assert.equal(checkDcRule({ any_of: ['lore', 'persuade'], dc: 16 }, of), undefined)
    assert.match(checkDcRule({ kind: 'persuade' }, of) ?? '', /필요/)
    assert.match(checkDcRule({ kind: 'flee', dc: 12 }, of) ?? '', /쓸 수 없다/)
  })

  it('risk lethal(V10)', () => {
    const e = fixture('L01')
    e.choices[2].risk = 'lethal'
    assert.ok(rulesOf(eventSchema, e).includes('V10'))
  })

  it('판정에 dc와 dc_offset을 함께', () => {
    const e = fixture('L06')
    e.choices[2].check.dc_offset = 0
    assert.ok(rulesOf(eventSchema, e).includes('V20'))
  })

  it('모르는 필드(strict)', () => {
    const e = fixture('L01')
    e.guaranteed = { first_sortie_of_family: true }
    assert.ok(problems(eventSchema, e).length > 0)
  })

  it('weight 범위(V13)', () => {
    const e = fixture('L01')
    e.weight = 11
    assert.deepEqual(rulesOf(eventSchema, e), ['V13'])
  })

  it('변이 선택지에 빈 cost(V8)', () => {
    const e = fixture('F03')
    e.choices[0].preview.cost = ''
    assert.deepEqual(rulesOf(eventSchema, e), ['V8'])
  })

  it('선택 대기 사건에 hold_line 없음(V8)', () => {
    const e = fixture('C01-3')
    delete e.hold_line
    assert.deepEqual(rulesOf(eventSchema, e), ['V8'])
  })

  it('판정 선택지에 always 결과', () => {
    const e = fixture('L06')
    e.choices[2].outcomes.always = e.choices[2].outcomes.failure
    assert.ok(problems(eventSchema, e).some((p) => /결과 키: always/.test(p)))
  })

  it('사건 피해 hp_ratio 1(V9)', () => {
    const r = effectList.safeParse([ { type: 'damage', hp_ratio: 1 } ])
    assert.ok(!r.success && r.error.issues.some((i) => (i as { params?: { rule?: string } }).params?.rule === 'V9'))
  })

  it('amount와 units를 함께(V4)', () => {
    assert.ok(problems(effectList, [ { type: 'add_coins', amount: 3, units: 1 } ]).length > 0)
  })

  it('temp_mod next_visit에 location 없음', () => {
    assert.ok(problems(effectList, [ { type: 'temp_mod', scope: 'next_visit', modifier: { target: 'hit', op: 'add', value: 1 } } ]).length > 0)
  })

  it('등록되지 않은 카운터', () => {
    assert.ok(problems(effectList, [ { type: 'counter_add', key: 'no_such_counter', value: 1 } ]).length > 0)
    assert.deepEqual(problems(effectList, [ { type: 'counter_add', key: 'safe_returns', value: 1, where: '{place}' } ]), [])
  })

  it('unlock_family background는 ID 형식을 본다', () => {
    assert.deepEqual(problems(effectList, [ { type: 'unlock_family', kind: 'background', id: 'bg_miner' } ]), [])
    assert.ok(problems(effectList, [ { type: 'unlock_family', kind: 'title', id: 'x' } ]).length > 0)
  })

  it('context_vars: 모르는 선택자·params 누락·채우지 않는 변수', () => {
    const base = fixture('L06')
    for (const cv of [
      { var: 'target_place', selector: 'no_such_selector' },
      { var: 'target_place', selector: 'best_hunting_ground' },
      { var: 'rumor_place', selector: 'best_hunting_ground', params: { max_risk: 'normal' } },
    ]) {
      const e = structuredClone(base)
      e.context_vars = [cv, base.context_vars[1]]
      assert.ok(problems(eventSchema, e).length > 0, JSON.stringify(cv))
    }
  })
})
