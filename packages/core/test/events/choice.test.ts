// 자동 선택(10 §5.3·§5.5·§5.6): 점수 계산 예 2개와 이유 문장.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { autoChoose, makeConditionTest, ruleContext, scoreChoice } from '../../src/events/index'
import { baseContent, makeWorld, startSortie, type TestWorld } from './fixture'

function setup(attitude: string, traits: string[], place: string, activity: 'hunt' | 'adventure' = 'adventure'): TestWorld {
  const tw = makeWorld()
  const ch = tw.w.state.character!
  tw.w.state.policies.attitude = attitude
  ch.traits = traits.map((id) => ({ id, since_age: 18, source: 'new' as const }))
  ch.level = 12
  ch.stats = { str: 5, dex: 5, kno: 5, wil: 5, soc: 4, luk: 3 }
  startSortie(tw, { location_id: place, activity })
  return tw
}

function scores(tw: TestWorld, eventId: string): Record<string, number> {
  const ev = baseContent.get('event', eventId)
  const scope = { place: tw.scope.place, vars: {}, eventId }
  const rule = ruleContext(tw.w, makeConditionTest(tw.w, scope))
  return Object.fromEntries(ev.choices.map((c) => [c.id, scoreChoice(tw.w, rule, c, scope).score]))
}

describe('자동 선택 계산 예(10 §5.5)', () => {
  it('예 1 — L08 흔들리는 다리, 안정적, 특성 없음, A1: −1 / 5 / 3 → 발판을 고치고 건넌다', () => {
    const tw = setup('stable', [], 'A1')
    assert.deepEqual(scores(tw, 'L08'), { cross: -1, repair: 5, detour: 3 })
    const ev = baseContent.get('event', 'L08')
    const scope = { place: 'A1', vars: {}, eventId: 'L08' }
    const auto = autoChoose(tw.w, ruleContext(tw.w, makeConditionTest(tw.w, scope)), ev.choices, scope)
    assert.equal(auto.choiceId, 'repair')
    assert.equal(auto.reasonKind, 'attitude')
    assert.equal(auto.reason, '안정적 방침에 따라 발판부터 고쳤다.')
  })

  it('예 2 — L07 늑대 울음, 도전적, TI07 보유, H3: 2 / 4 / 4 → 동점이라 먼저 적힌 자리를 옮긴다', () => {
    const tw = setup('challenging', ['TI07'], 'H3', 'hunt')
    assert.deepEqual(scores(tw, 'L07'), { move: 4, keep_watch: 2, drive_off: 4 })
    const ev = baseContent.get('event', 'L07')
    const scope = { place: 'H3', vars: {}, eventId: 'L07' }
    const auto = autoChoose(tw.w, ruleContext(tw.w, makeConditionTest(tw.w, scope)), ev.choices, scope)
    assert.equal(auto.choiceId, 'move')
    assert.equal(auto.reasonKind, 'trait_changed')
    assert.equal(auto.reason, '도전적 방침이었지만, 겁이 많아 자리를 옮겼다.')
  })

  it('위험 한도를 넘는 선택지는 빠지고 이유가 바뀐다', () => {
    const tw = setup('stable', [], 'A1')
    tw.w.state.policies.risk_cap = 'low' // 보통 위험(cross)이 빠진다
    const ev = baseContent.get('event', 'L08')
    const scope = { place: 'A1', vars: {}, eventId: 'L08' }
    const auto = autoChoose(tw.w, ruleContext(tw.w, makeConditionTest(tw.w, scope)), ev.choices, scope)
    assert.equal(auto.choiceId, 'repair')
    const s = scoreChoice(tw.w, ruleContext(tw.w, makeConditionTest(tw.w, scope)), ev.choices[0]!, scope)
    assert.equal(s.allowed, false)
  })
})
