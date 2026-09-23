import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyAging, recoveryCoef } from '../../src/index'
import { RELIC_NOTICE_AGE, ageNotices, ageTick, appearanceStage, lifeStageOf, stageBoundaries } from '../../src/life/index'
import { lifeWorld, setAge } from './fixture'

describe('나이 진행과 노화(09 §1~§2)', () => {
  it('생애 단계 경계는 balance.aging.life_stages가 단일 출처다(I10)', () => {
    const w = lifeWorld()
    assert.deepEqual(stageBoundaries(w.content), [30, 50, 65])
    setAge(w, 18)
    assert.equal(lifeStageOf(w), 'novice')
    setAge(w, 50)
    assert.equal(lifeStageOf(w), 'veteran')
    setAge(w, 65)
    assert.equal(lifeStageOf(w), 'elder')
  })

  it('50세에 지식·의지 +1, 60세에 힘·민첩 −1, 회복 계수가 내려간다(09 §2.2)', () => {
    const w = lifeWorld()
    const ch = w.state.character!
    ch.stats = { str: 4, dex: 4, kno: 2, wil: 2, soc: 1, luk: 1 }
    setAge(w, 50)
    assert.deepEqual(applyAging(w, 49, 50).map((c) => [c.stat, c.delta]), [['kno', 1], ['wil', 1]])
    assert.equal(recoveryCoef(w), 0.9)
    setAge(w, 60)
    assert.deepEqual(applyAging(w, 59, 60).map((c) => [c.stat, c.delta]), [['str', -1], ['dex', -1]])
    assert.equal(recoveryCoef(w), 0.8)
    assert.deepEqual([ch.stats.str, ch.stats.dex, ch.stats.kno, ch.stats.wil], [3, 3, 3, 3])
  })

  it('노화 기록은 바뀐 능력치를 상세에 적고, 단계 경계는 주요 기록이 된다', () => {
    const w = lifeWorld()
    const ch = w.state.character!
    ch.stats = { str: 4, dex: 4, kno: 2, wil: 2, soc: 1, luk: 1 }
    setAge(w, 50)
    const changes = applyAging(w, 49, 50)
    const notes = ageNotices(w, ageTick(w.content, 49, 50, changes))
    assert.equal(notes.length, 1)
    assert.equal(notes[0]!.line, '50세가 되었다')
    assert.match(notes[0]!.detail!, /지식 \+1, 의지 \+1/)
    assert.equal(notes[0]!.importance, 'major')
  })

  it('65세 유품 등록 안내는 가문에 한 번만 뜬다(12 §5.1)', () => {
    const w = lifeWorld()
    setAge(w, 65)
    const first = ageNotices(w, ageTick(w.content, 64, 65, []))
    assert.equal(first.filter((d) => d.tag === 'important').length, 1)
    assert.equal(w.state.family.notices_shown[RELIC_NOTICE_AGE], 1)
    const again = ageNotices(w, ageTick(w.content, 64, 65, []))
    assert.equal(again.filter((d) => d.tag === 'important').length, 0)
  })

  it('흡혈귀의 외형 단계는 변이 시점에서 멈춘다(09 §7.8)', () => {
    const w = lifeWorld()
    const ch = w.state.character!
    setAge(w, 40)
    assert.equal(appearanceStage(w), 'prime')
    ch.mutation = { trait_id: 'TM01', since_age: 40, long_sleep_age: 98, thirst: 0 }
    setAge(w, 70)
    assert.equal(lifeStageOf(w), 'elder')
    assert.equal(appearanceStage(w), 'prime')
  })

  it('흡혈귀는 변이 뒤 노화 능력치 감소를 받지 않는다(09 §7.2)', () => {
    const w = lifeWorld()
    const ch = w.state.character!
    ch.stats = { str: 5, dex: 5, kno: 2, wil: 2, soc: 1, luk: 1 }
    ch.mutation = { trait_id: 'TM01', since_age: 55, long_sleep_age: 98, thirst: 0 }
    setAge(w, 60)
    assert.deepEqual(applyAging(w, 59, 60), [])
    assert.deepEqual([ch.stats.str, ch.stats.dex], [5, 5])
  })
})
