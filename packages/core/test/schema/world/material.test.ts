import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { materialSchema } from '../../../src/schema/world/index'
import { expectFail, expectOk } from './helpers'

// 07 §3.3
const matEN04 = { id: 'mat_EN04', name: '잿빛 늑대의 은빛 돌', source: 'EN04', sell_price: 35, line: '늑대가 물고 다니던 은빛 돌을 주웠다' }

describe('material', () => {
  it('적 출처와 고정 출처(trap)가 통과한다', () => {
    expectOk(materialSchema, matEN04)
    const m = expectOk(materialSchema, { id: 'mat_trap', name: '함정 부품', source: 'trap', sell_price: 0, line: '함정에서 쓸 만한 부품을 떼어 냈다' })
    assert.equal(m.source, 'trap')
  })

  it('출처 형식 오류, 문장 누락', () => {
    expectFail(materialSchema, { ...matEN04, source: 'trap parts' })
    const { line: _line, ...noLine } = matEN04
    assert.deepEqual(expectFail(materialSchema, noLine), ['line'])
  })

  it('문장 템플릿 문법 오류(V5)', () => {
    assert.deepEqual(expectFail(materialSchema, { ...matEN04, line: '{name 이 주웠다' }), ['line'])
  })
})
