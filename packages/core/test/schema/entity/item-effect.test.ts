import { assertIssue, assertValid, edit } from './setup'
import { describe, it } from 'node:test'
import { itemEffectSchema } from '../../../src/schema/entity/index'

// 08 §3.6·§3.7
const E03 = {
  id: 'E03', name: '덧댄 안감', grade: 'good', slots: ['armor'],
  modifiers: [{ target: 'hp_max_add', op: 'add', value: 5 }],
  value_pct: null, description: '최대 HP +5',
}
const E12 = {
  id: 'E12', name: '흥정꾼의 표식', grade: 'good', slots: ['accessory', 'relic'],
  modifiers: [{ target: 'price_mult', op: 'add', value: -0.03 }],
  value_pct: 0.01, description: '상점 구매가 −3%',
}
const X05 = {
  id: 'X05', name: '깊은 잠', grade: 'rare', slots: ['armor', 'relic'],
  modifiers: [
    { target: 'camp_fatigue_add', op: 'add', value: -15 },
    { target: 'camp_raid_immunity', op: 'flag', value: true },
  ],
  value_pct: 0.03, description: '야영 피로 회복 −40 → −55, 야영 중 습격 계열 사건 무효',
}

describe('item_effect', () => {
  it('E03·E12·X05 통과', () => {
    assertValid(itemEffectSchema, E03)
    assertValid(itemEffectSchema, E12)
    assertValid(itemEffectSchema, X05)
  })
  it('grade는 good·rare만', () => {
    assertIssue(itemEffectSchema, edit(E03, { grade: 'common' }), 'grade')
  })
  it('slots는 1개 이상', () => {
    assertIssue(itemEffectSchema, edit(E03, { slots: [] }), 'slots')
  })
  it('value_pct는 ratio(퍼센트 정수 3은 실패), 생략 불가', () => {
    assertIssue(itemEffectSchema, edit(X05, { value_pct: 3 }), 'value_pct')
    assertIssue(itemEffectSchema, edit(E03, { value_pct: undefined }), 'value_pct')
  })
  it('합산 target에 mul은 실패', () => {
    assertIssue(itemEffectSchema, edit(E12, { modifiers: [{ target: 'price_mult', op: 'mul', value: 0.97 }] }), 'modifiers.0.op')
  })
})
