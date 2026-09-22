// 등록부와 핸들러 맵이 이름으로 짝이 맞는지(CONTENT_SCHEMA §4 실행 핸들러 계약)
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { conditions, contextSelectors, effects } from '../../src/index'
import { CONDITION_EVAL, EFFECT_HANDLERS, SELECTOR_HANDLERS } from '../../src/events/index'
import { baseContent } from './fixture'

const sorted = (xs: readonly string[]) => [...xs].sort()

describe('등록부 ↔ 핸들러 맵', () => {
  it('조건 단말 57종에 평가 핸들러가 있다', () => {
    assert.deepEqual(sorted(Object.keys(CONDITION_EVAL)), sorted(conditions.names()))
    assert.equal(conditions.names().length, 57)
  })

  it('효과 56종에 실행 핸들러가 있다', () => {
    assert.deepEqual(sorted(Object.keys(EFFECT_HANDLERS)), sorted(effects.names()))
    assert.equal(effects.names().length, 56)
  })

  it('사건 변수 선택자에 계산 핸들러가 있다', () => {
    assert.deepEqual(sorted(Object.keys(SELECTOR_HANDLERS)), sorted(contextSelectors.names()))
  })

  it('기반 팩 사건 41개(생활 24 · 연속 6 · 운명 3 · 시스템 8)', () => {
    const byCategory = (c: string) => baseContent.list('event').filter((e) => e.category === c).length
    assert.deepEqual([byCategory('life'), byCategory('chain'), byCategory('fate')], [24, 6, 3])
    assert.ok(baseContent.list('event').length >= 41)
  })
})
