import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { DeathRecord } from '../../src/index'
import { causeLines, deathNotice, fireLifeEnd, lifeEndEvent, nextGenPolicies, systemEvents } from '../../src/life/index'
import { lifeWorld, setAge } from './fixture'

const death = (over: Partial<DeathRecord> = {}): DeathRecord => ({
  name: '해솔', generation: 1, age: 63, level: 27, location: 'D3', step: '관문', activity: 'dungeon',
  lethal_source: 'EB03',
  risk: { diff: 2, grade: 'normal' },
  policy: { attitude: 'bold', lethal_allowed: true, retreat_hp: 0.2 },
  start: { hp_ratio: 0.72, potions: 2, injuries: [{ grade: 'light', stat: 'dex' }] },
  serious_total: 0,
  injuries: [],
  decisive: [],
  final_check: { dice: 6, parts: [{ label: '의지', value: 4 }, { label: '행운', value: 1 }], total: 11, dc: 15, result: 'failure' },
  suggestions: [],
  ...over,
})

describe('생애 종료 사건 발화(11 S03·S04·S08)', () => {
  it('은퇴면 S03이 골라지고 은퇴 역할이 변형이 된다', () => {
    const w = lifeWorld()
    setAge(w, 68)
    const ev = lifeEndEvent(w, { kind: 'retired', place: 'T00' })!
    assert.equal(ev.id, 'S03')
    fireLifeEnd(w, { kind: 'retired', place: 'T00', roleId: 'instructor' }, w.ports)
    // 사건 엔진은 결과 한 줄이 있으면 그것을 쓴다(도입 한 줄은 상세에 남는다). 09 §3.2의 두 줄 중 역할 줄이 남는다
    const entry = w.state.journal.find((e) => e.tag === 'retire')!
    assert.equal(entry.line, '길드 교관 자리를 맡았다')
    assert.match(entry.detail!, /모험가 명부에서 이름을 내렸다/)
    assert.equal(w.state.character!.event_counts['S03'], 1)
  })

  it('사망이면 S04가 골라지고 장소별 길드 편지와 사망 장소 가문 플래그가 남는다', () => {
    const w = lifeWorld()
    setAge(w, 63)
    const d = death()
    const lines = causeLines(w, d)
    const res = fireLifeEnd(w, { kind: 'died', place: 'D3', vars: { relic: '종이 달린 짧은 검', ...lines } }, w.ports)!
    assert.equal(res.event_id, 'S04')
    assert.equal(res.choice_id, 'letter_mine') // 종소리 폐광 편지
    assert.equal(w.state.family.flags['fam.death_D3'], true)
    const letter = w.state.journal.find((e) => e.importance === 'family' && e.line.includes('가문께'))
    assert.ok(letter, '길드 편지가 연대기 기록으로 남는다')
    assert.match(letter!.line, /종이 달린 짧은 검/)
  })

  it('긴 잠이면 S08이 골라지고 갈증 한계 변형이 따로 있다(09 §7.6)', () => {
    const w = lifeWorld()
    const ch = w.state.character!
    ch.traits.push({ id: 'TM01', since_age: 58, source: 'acquired' })
    ch.mutation = { trait_id: 'TM01', since_age: 58, long_sleep_age: 98, thirst: 100 }
    setAge(w, 70)
    const res = fireLifeEnd(w, { kind: 'long_sleep', place: 'T00', cause: 'thirst' }, w.ports)!
    assert.equal(res.event_id, 'S08')
    assert.equal(res.choice_id, 'thirst')
    ch.mutation.thirst = 0
    ch.event_counts['S08'] = 0
    const byAge = fireLifeEnd(w, { kind: 'long_sleep', place: 'T00', cause: 'age' }, w.ports)!
    assert.equal(byAge.choice_id, 'age')
  })

  it('생애 종료 단계 후보는 종료 종류마다 하나다(10 §3.3)', () => {
    const w = lifeWorld()
    setAge(w, 68)
    assert.deepEqual(systemEvents(w, 'life_end', 'T00', { kind: 'retired', place: 'T00' }).map((e) => e.id), ['S03'])
    assert.deepEqual(systemEvents(w, 'life_end', 'D3', { kind: 'died', place: 'D3' }).map((e) => e.id), ['S04'])
    assert.deepEqual(systemEvents(w, 'life_end', 'T00').map((e) => e.id), [])
  })
})

describe('사망 원인 기록(09 §5.4)과 다음 세대 방침(09 §5.5)', () => {
  it('세 줄에 진입 위험·누적 부상·결정적 순간을 적는다', () => {
    const w = lifeWorld()
    const lines = causeLines(w, death())
    assert.match(lines.risk_line, /치명\(부서진 종의 파수꾼\)/)
    assert.match(lines.risk_line, /위험 차 \+2\(보통\)/)
    assert.match(lines.risk_line, /치명 위험 허용 켬/)
    assert.match(lines.injury_line, /경상 1\(민첩 −1\)/)
    assert.match(lines.injury_line, /진입 시 체력 72%/)
    assert.equal(lines.final_check_line, '최후 판정 주사위 6 의지 +4 행운 +1 = 11 / 난이도 15')
  })

  it('노화와 누적 부상이 있는 경우도 구별해 읽힌다(09 §5.4 예시 2)', () => {
    const w = lifeWorld()
    const lines = causeLines(w, death({
      age: 72, level: 28, risk: { diff: 1, grade: 'normal' }, serious_total: 3,
      start: { hp_ratio: 0.5, potions: 0, injuries: [] },
      final_check: { dice: 2, parts: [{ label: '의지', value: 3 }, { label: '행운', value: 1 }], total: 6, dc: 15, result: 'failure' },
    }))
    assert.match(lines.injury_line, /중상 누적 3회/)
    assert.equal(lines.final_check_line, '최후 판정 주사위 2 의지 +3 행운 +1 = 6 / 난이도 15')
  })

  it('사망에 관여한 방침을 강조한다', () => {
    const w = lifeWorld()
    w.state.policies.lethal_allowed = true
    w.state.policies.destination = 'D3'
    const rows = nextGenPolicies(w)
    assert.deepEqual(rows.filter((r) => r.highlight).map((r) => r.key), ['risk_cap', 'lethal_allowed', 'destination'])
  })

  it('기본 창 한 줄과 원인 세 줄을 기록 초안으로 만든다', () => {
    const w = lifeWorld()
    const d = death()
    const draft = deathNotice(d, causeLines(w, d))
    assert.equal(draft.tag, 'death')
    assert.equal(draft.line, '해솔의 등불이 꺼졌다')
    assert.equal(draft.detail!.split('\n').length, 3)
  })
})
