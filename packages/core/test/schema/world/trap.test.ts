import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { trapSchema } from '../../../src/schema/world/index'
import { expectFail, expectOk, registerTestVocabulary } from './helpers'

registerTestVocabulary()

const lines = { detect: '가시 발판을 알아챘다.', disarm: '가시 발판을 풀어 놓았다.', evade: '가시를 피해 뛰었다.', fail: '가시 발판을 밟았다.' }

// CONTENT_SCHEMA §5.4 가시 발판
const spike = {
  id: 'trap_spike', name: '가시 발판',
  detect_dc_offset: 0, evade: { check: 'trap_evade', dc_offset: 0 }, disarm_dc_offset: 4,
  fail: [{ type: 'damage', hp_ratio: 0.10 }, { type: 'chance', p: 0.2, then: [{ type: 'injury', grade: 'light', stat: 'dex' }] }],
  lines,
}

// 경보 종줄: 회피 없음, 실패 = 매복 전투
const alarm = {
  id: 'trap_alarm', name: '경보 종줄',
  detect_dc_offset: 0, evade: null, disarm_dc_offset: 4,
  fail: [{ type: 'start_combat', enemies: [{ from_region_table: true }], count: 1, first_strike: 'default', ambush: true }],
  lines,
}

describe('trap', () => {
  it('가시 발판·경보 종줄·해제 불가 함정이 통과한다', () => {
    expectOk(trapSchema, spike)
    expectOk(trapSchema, alarm)
    expectOk(trapSchema, { ...spike, id: 'trap_rock', disarm_dc_offset: null, fail: [{ type: 'damage', hp_ratio: 0.08 }] })
  })

  it('evade를 생략하면 오류(null로 적는다), 문장 누락', () => {
    const { evade: _evade, ...noEvade } = spike
    assert.deepEqual(expectFail(trapSchema, noEvade), ['evade'])
    expectFail(trapSchema, { ...spike, lines: { detect: '알아챘다.' } })
  })

  it('실패 효과의 파라미터 오류(V4)', () => {
    expectFail(trapSchema, { ...spike, fail: [{ type: 'damage', hp_ratio: 0.1, hp: 3 }] })
  })
})
