import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { World } from '../../src/index'
import {
  earlyRetireCheck, letterState, lifeEndDue, livingRetirees, pickRetireRole, registerRetiree, retireAgeOf,
  retireRoleScores, retireeHeirEvents, retireeModSources, retirePending,
} from '../../src/life/index'
import { lifeWorld, setAge } from './fixture'

// 12 §9.1 모라: 수호자, 근접 4단계, TA04·TA05·TI08 보유, EB02 격파, 여관 휴식 60회, 가정 있음, 68세 은퇴
function mora(): World {
  const w = lifeWorld()
  const ch = w.state.character!
  ch.traits = [
    { id: 'TI01', since_age: 18, source: 'new' },
    { id: 'TI08', since_age: 18, source: 'new' },
    { id: 'TA01', since_age: 36, source: 'acquired' },
    { id: 'TA04', since_age: 40, source: 'acquired' },
    { id: 'TA05', since_age: 47, source: 'acquired' },
  ]
  ch.specialization = 'guardian'
  ch.skills.melee.rank = 4
  ch.skills.negotiation.rank = 2 // 교섭 3단계 미만(12 §9.3에서 여관 점수 4)
  ch.defeated = ['EB01', 'EB02']
  ch.counters.inn_rests = 60
  ch.flags['life.household'] = true
  setAge(w, 68)
  return w
}

describe('은퇴(09 §3)', () => {
  it('은퇴 예정 나이에 닿으면 새 출정을 멈춘다', () => {
    const w = lifeWorld()
    setAge(w, 67)
    assert.equal(retireAgeOf(w), 68)
    assert.equal(retirePending(w), false)
    setAge(w, 68)
    assert.deepEqual(lifeEndDue(w), { kind: 'retired', cause: 'age' })
  })

  it('생명 연장을 받으면 은퇴 예정 나이가 78세가 된다(09 §6.3)', () => {
    const w = lifeWorld()
    w.state.character!.retire_age = 78
    setAge(w, 70)
    assert.equal(retirePending(w), false)
    setAge(w, 78)
    assert.equal(retirePending(w), true)
  })

  it('흡혈귀는 은퇴 대신 긴 잠 나이를 쓴다(09 §7.6)', () => {
    const w = lifeWorld()
    w.state.character!.mutation = { trait_id: 'TM01', since_age: 58, long_sleep_age: 98, thirst: 0 }
    setAge(w, 70)
    assert.equal(retireAgeOf(w), 98)
    assert.equal(retirePending(w), false)
    setAge(w, 98)
    assert.deepEqual(lifeEndDue(w), { kind: 'long_sleep', cause: 'age' })
  })

  it('조기 은퇴는 마을에서 25세부터, 30세 미만은 확인을 한 번 더 받는다(09 §3.3)', () => {
    const w = lifeWorld()
    setAge(w, 24)
    assert.equal(earlyRetireCheck(w).allowed, false)
    setAge(w, 26)
    assert.deepEqual(earlyRetireCheck(w), { allowed: true, reason: null, confirms: 2 })
    setAge(w, 35)
    assert.equal(earlyRetireCheck(w).confirms, 1)
    w.state.current_activity.state = 'hunt'
    assert.equal(earlyRetireCheck(w).allowed, false)
  })
})

describe('은퇴 후 역할(09 §4, 12 §9.3)', () => {
  it('모라의 역할 점수는 여관 4 · 교관 5 · 편지 3이고 길드 교관이 된다', () => {
    const w = mora()
    const scores = Object.fromEntries(retireRoleScores(w).map((s) => [s.id, s.points]))
    assert.deepEqual(scores, { inn: 4, instructor: 5, letters: 3 })
    const pick = pickRetireRole(w)
    assert.equal(pick.id, 'instructor')
    assert.equal(pick.fallback, false)
  })

  it('동점이면 편지를 보내는 가족이고, 점수가 모두 1 이하이고 가정이 없으면 서술만 바뀐다', () => {
    const w = lifeWorld()
    setAge(w, 50) // 60세 이전 + 가정 없음 → 편지 1점, 나머지 0점
    const pick = pickRetireRole(w)
    assert.equal(pick.id, 'letters')
    assert.equal(pick.fallback, true)
    assert.equal(pick.name, '길드에 이름을 남긴 선배')
  })

  it('은퇴 인물은 가문에 남고 후계자 30세까지 수정자·사건을 준다(09 §4.1)', () => {
    const w = mora()
    registerRetiree(w, 'inn')
    assert.equal(w.state.family.flags['fam.retired_inn'], true)
    // 후계자 시점으로 옮겨 본다
    setAge(w, 25)
    assert.equal(livingRetirees(w).length, 1)
    const mods = retireeModSources(w)
    assert.deepEqual(mods.map((m) => m.modifiers).flat(), [{ target: 'inn_cost_mult', op: 'mul', value: 0.5 }])
    setAge(w, 30)
    assert.equal(livingRetirees(w).length, 0)
    assert.deepEqual(retireeModSources(w), [])
  })

  it('교관 역할은 후계자에게 교육 사건을 연다', () => {
    const w = mora()
    registerRetiree(w, 'instructor')
    setAge(w, 20)
    assert.deepEqual(retireeHeirEvents(w), ['S07'])
  })
})

describe('S07 은퇴한 부모의 편지(09 §4.2)', () => {
  it('30세 전에는 12% 편지 최대 6회, 30세 뒤 첫 귀환에 마무리 편지 1회', () => {
    const w = mora()
    registerRetiree(w, 'letters')
    setAge(w, 20)
    const ch = w.state.character!
    const first = letterState(w, 'S07')
    assert.equal(first.kind, 'regular')
    assert.equal(first.chance, 0.12)
    assert.equal(first.gapOk, true)
    // 간격 15분을 못 채우면 보내지 않는다
    ch.event_last_min['S07'] = ch.eff_min - 10
    assert.equal(letterState(w, 'S07').gapOk, false)
    delete ch.event_last_min['S07']
    // 6회를 채우면 일반 편지는 끝난다
    ch.event_counts['S07'] = 6
    assert.equal(letterState(w, 'S07').kind, null)
    // 30세 뒤에는 마무리 편지 한 통
    setAge(w, 30)
    assert.equal(letterState(w, 'S07').kind, 'final')
    ch.event_counts['S07'] = 7
    assert.equal(letterState(w, 'S07').kind, null)
  })
})
