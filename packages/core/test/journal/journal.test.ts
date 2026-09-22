import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { addJournal, defaultImportance, markLastChapter, purgeDaily } from '../../src/index'
import { makeWorld } from '../fixture'

describe('일지 기록 생성(16 §5.6, 14 §2)', () => {
  it('가문 일련번호 id와 기록 시점(나이·계절)', () => {
    const w = makeWorld()
    w.state.character!.eff_min = 12 * 3 + 4 // 21세, 봄 출발 + 13계절 → 여름
    const e1 = addJournal(w, { tag: 'check', line: '다리를 건넜다', check: { dice: 12, parts: [{ label: '민첩', value: 3 }], total: 15, dc: 14, result: 'success' } })
    const e2 = addJournal(w, { tag: 'check', line: '또 건넜다' }, { offline: true })
    assert.equal(e1.id, 1)
    assert.equal(e2.id, 2)
    assert.equal(w.state.family.next_uid.jr, 3)
    assert.equal(e1.age, 21)
    assert.equal(e1.season, 'summer')
    assert.equal(e1.char_uid, w.state.character!.uid)
    assert.equal(e2.offline, true)
  })

  it('태그별 생애 첫 기록(묶음 제외)은 주요로 올린다', () => {
    const w = makeWorld()
    assert.equal(addJournal(w, { tag: 'hunt', line: '들쥐 무리', bundle_count: 4 }).importance, 'daily')
    assert.equal(addJournal(w, { tag: 'hunt', line: '들쥐를 쫓았다' }).importance, 'major')
    assert.equal(addJournal(w, { tag: 'hunt', line: '또 쫓았다' }).importance, 'daily')
    assert.equal(addJournal(w, { tag: 'death', line: '돌아오지 않았다' }).importance, 'family')
    assert.equal(addJournal(w, { tag: 'gear', line: '희귀', importance: 'major' }).importance, 'major')
  })

  it('태그 기본 보존(13 §9)', () => {
    assert.equal(defaultImportance('succession'), 'family')
    assert.equal(defaultImportance('discovery'), 'major')
    assert.equal(defaultImportance('rest'), 'daily')
  })
})

describe('일지 보존(14 §1, 13 §9)', () => {
  it('일상 기록은 인물당 최근 300개, 주요 기록은 남는다', () => {
    const w = makeWorld()
    for (let i = 0; i < 320; i++) addJournal(w, { tag: 'hunt', line: `사냥 ${i}` })
    const j = w.state.journal
    assert.equal(j.filter((e) => e.importance === 'daily').length, 300)
    assert.equal(j[0]!.line, '사냥 0') // 첫 기록은 주요
    assert.equal(j[0]!.importance, 'major')
    assert.equal(j[1]!.line, '사냥 20')
  })

  it('생애 종료: 마지막 50개를 마지막 장으로, 나머지 일상은 삭제', () => {
    const w = makeWorld()
    for (let i = 0; i < 80; i++) addJournal(w, { tag: 'rest', line: `휴식 ${i}` })
    const uid = w.state.character!.uid
    const ids = markLastChapter(w.state, uid, 50)
    assert.equal(ids.length, 50)
    purgeDaily(w.state, uid)
    const j = w.state.journal
    assert.equal(j.length, 51)
    assert.equal(j.filter((e) => e.importance === 'last_chapter').length, 50)
    assert.equal(j[1]!.line, '휴식 30')
  })
})
