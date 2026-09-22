import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { balanceSchema, checkKindSchema } from '../../../src/schema/world/index'
import { clone, expectFail, expectOk, registerTestVocabulary } from './helpers'

registerTestVocabulary()

// CONTENT_SCHEMA §5.1 예시 전체. 바꾼 곳: equip_eval의 _note 전용 안내 행 제거.
const example = JSON.parse(readFileSync(new URL('./fixtures/balance.json', import.meta.url), 'utf8')) as Record<string, any>

describe('balance: 5.1 예시', () => {
  it('예시 전체가 통과한다', () => {
    const b = expectOk(balanceSchema, example)
    assert.equal(b.check_kinds.flee!.dc.kind, 'level_formula')
    assert.equal(b.economy.tier_levels.length, 5)
  })

  it('판정 종류 하나도 따로 검사할 수 있다', () => {
    expectOk(checkKindSchema, example.check_kinds.fear)
  })
})

describe('balance: 오류', () => {
  it('모르는 섹션', () => {
    const b = clone(example)
    b.foo = {}
    expectFail(balanceSchema, b)
  })

  it('섹션 누락', () => {
    const b = clone(example)
    delete b.ui
    assert.deepEqual(expectFail(balanceSchema, b), ['ui'])
  })

  it('섹션 안 키 누락(기본값 없음)', () => {
    const b = clone(example)
    delete b.economy.sell_ratio
    assert.deepEqual(expectFail(balanceSchema, b), ['economy.sell_ratio'])
  })

  it('id는 balance 고정', () => {
    const b = clone(example)
    b.id = 'balance2'
    assert.deepEqual(expectFail(balanceSchema, b), ['id'])
  })

  it('tier_price 길이가 tier_levels와 다르다', () => {
    const b = clone(example)
    b.economy.tier_price.pop()
    assert.deepEqual(expectFail(balanceSchema, b), ['economy.tier_price'])
  })

  it('판정 종류 dc.kind 오류와 사건 전용 필드 오타', () => {
    const b = clone(example)
    b.check_kinds.terrain.dc = { kind: 'regional' }
    b.check_kinds.forage.partial_effect = []
    const paths = expectFail(balanceSchema, b)
    assert.ok(paths.includes('check_kinds.terrain.dc.kind'), paths.join())
    assert.ok(paths.some((p) => p.startsWith('check_kinds.forage')), paths.join())
  })

  it('사망 제안 규칙: value가 필요한 ctx에 value 없음, 모르는 ctx', () => {
    const b = clone(example)
    delete b.defeat.death_suggestions.rules[1].value
    b.defeat.death_suggestions.rules[2].ctx = 'bad_luck'
    const paths = expectFail(balanceSchema, b)
    assert.ok(paths.includes('defeat.death_suggestions.rules.1.value'), paths.join())
    assert.ok(paths.includes('defeat.death_suggestions.rules.2.ctx'), paths.join())
  })

  it('위험 구간: 마지막이 아닌 구간의 max 생략', () => {
    const b = clone(example)
    delete b.risk.bands[1].max
    assert.deepEqual(expectFail(balanceSchema, b), ['risk.bands'])
  })

  it('장비 평가표의 모르는 수정자 target', () => {
    const b = clone(example)
    b.equip_eval.value_table[0].target = 'check.skill.cooking'
    assert.deepEqual(expectFail(balanceSchema, b), ['equip_eval.value_table.0.target'])
  })

  it('날씨 효과 수정자의 op 오류와 계절 가중치 누락', () => {
    const b = clone(example)
    b.weather.effects.rain[0].op = 'flag'
    delete b.weather.season_weights.winter
    const paths = expectFail(balanceSchema, b)
    assert.ok(paths.includes('weather.effects.rain.0.op'), paths.join())
    assert.ok(paths.includes('weather.season_weights.winter'), paths.join())
  })

  it('전문화 키는 코드 열거(none 불가)', () => {
    const b = clone(example)
    b.specializations.none = b.specializations.guardian
    expectFail(balanceSchema, b)
  })

  it('문형 id 형식', () => {
    const b = clone(example)
    b.inheritance.childhood.text_id = 'Journal Childhood'
    assert.deepEqual(expectFail(balanceSchema, b), ['inheritance.childhood.text_id'])
  })

  it('곤란 표 효과의 파라미터 오류(V4)', () => {
    const b = clone(example)
    b.check.fumble_table[1].effects[0] = { type: 'remove_coins', amount: 1, ratio: 0.1 }
    expectFail(balanceSchema, b)
  })
})
