import { assertIssue, assertValid, edit } from './setup'
import { describe, it } from 'node:test'
import { consumablePriceSchema, consumableSchema } from '../../../src/schema/entity/index'

// 08 §4.2
const CP01 = {
  id: 'CP01', name: '회복약(작은 병)', effect: 'heal_hp', amount: 15, tier: 1,
  price: { kind: 'fixed', value: 10 }, carry_group: 'potion', shop: ['general_store'], sellable: false,
}
const CP07 = {
  id: 'CP07', name: '붕대', effect: 'cure_minor_injury', amount: 1,
  price: { kind: 'fixed', value: 15 }, carry_group: 'bandage', shop: ['general_store', 'clinic'], sellable: false,
}
// 16 §2.6 CP08. tier null은 생략, 가격 문자열은 구조화 가격으로(DS-08)
const CP08 = {
  id: 'CP08', name: '달빛 포도주', effect: 'thirst_down', amount: 25,
  price: { kind: 'potion_of_level_tier', mult: 2 }, carry_group: 'moon_wine', shop: ['general_store'],
  requires: { all: [{ has_trait: 'TM01' }, { last_trip_time: 'night' }] },
  sellable: false,
}

describe('consumable', () => {
  it('CP01·CP07·CP08 통과', () => {
    assertValid(consumableSchema, CP01)
    assertValid(consumableSchema, CP07)
    assertValid(consumableSchema, CP08)
  })
  it('회복약은 tier 필수', () => {
    assertIssue(consumableSchema, edit(CP01, { tier: undefined }), 'tier')
  })
  it('sellable은 false만', () => {
    assertIssue(consumableSchema, edit(CP07, { sellable: true }), 'sellable')
  })
  it('옛 가격 문자열·모르는 효과는 실패', () => {
    assertIssue(consumableSchema, edit(CP08, { price: 'potion_price_of_level_tier*2' }), 'price')
    assertIssue(consumableSchema, edit(CP07, { effect: 'teleport' }), 'effect')
  })
  it('requires 조건 문법 오류는 V3', () => {
    assertIssue(consumableSchema, edit(CP08, { requires: { has_trait: 'TM01', in_town: true } }), 'requires', 'V3')
  })
})

describe('consumablePriceSchema', () => {
  it('fixed는 value, potion_of_level_tier는 mult', () => {
    assertValid(consumablePriceSchema, { kind: 'fixed', value: 5 })
    assertIssue(consumablePriceSchema, { kind: 'fixed', mult: 2 }, '')
    assertIssue(consumablePriceSchema, { kind: 'potion_of_level_tier', mult: 0 }, 'mult')
  })
})
