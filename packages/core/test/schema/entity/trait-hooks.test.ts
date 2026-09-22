import { assertIssue, assertValid } from './setup'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { aiHooksSchema, registerTraitHook, traitHooks } from '../../../src/schema/entity/index'

// 확장 훅: 첫 파싱 전에 등록하면 이후 데이터로만 쓴다
registerTraitHook('prefer_night', z.boolean(), '밤 출정 선호(테스트용 확장)')

describe('traitHooks 등록부', () => {
  it('기본 10종 + 확장 1종', () => {
    assert.deepEqual(traitHooks.names(), [
      'activity_weight_add', 'retreat_hp_add', 'location_score_add', 'choice_tag_bonus', 'event_weight_mult',
      'prefer_shortcut', 'attempt_disarm', 'camp_extra', 'rest_preference', 'winter_retreat_hp_add',
      'prefer_night',
    ])
  })

  it('이름 중복·형식 오류는 예외', () => {
    assert.throws(() => registerTraitHook('camp_extra', z.boolean()), /중복/)
    assert.throws(() => registerTraitHook('Camp', z.boolean()), /snake_case/)
  })

  it('등록한 훅을 데이터로 쓴다', () => {
    assertValid(aiHooksSchema, {
      prefer_night: true,
      prefer_shortcut: true,
      attempt_disarm: false,
      camp_extra: 1,
      rest_preference: 'inn',
      winter_retreat_hp_add: 0.05,
      event_weight_mult: { L05: 1.5 },
      _note: '설명 허용',
    })
  })

  it('파라미터 모양 오류는 그 훅 경로로', () => {
    assertIssue(aiHooksSchema, { prefer_night: 'yes' }, 'prefer_night')
    assertIssue(aiHooksSchema, { rest_preference: 'tent' }, 'rest_preference')
    assertIssue(aiHooksSchema, { activity_weight_add: { travel: 5 } }, 'activity_weight_add.travel')
    assertIssue(aiHooksSchema, { event_weight_mult: { 'bad id': 2 } }, 'event_weight_mult.bad id')
  })

  it('첫 검증 뒤에는 등록부가 잠긴다', () => {
    assert.equal(traitHooks.isLocked, true)
    assert.throws(() => registerTraitHook('late_hook', z.boolean()), /잠겼다/)
  })
})
