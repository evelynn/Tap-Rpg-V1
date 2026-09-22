// 회복과 부상(01 §1.2·§6.1·§6.2, 04 §7.6·§8, 07 §3.5·§5.3). 문서의 계산 예를 그대로 옮겼다.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { maxHp } from '../../src/index'
import { breathe, camp, restPoint, townRest, usePotions } from '../../src/recovery/rest'
import { innFee } from '../../src/rules/cost'
import { addInjury, hasSeriousInjury, injuryStat, rollInjuryCheck, tickInjuries } from '../../src/recovery/injury'
import { retreatHpRatio } from '../../src/combat/index'
import { equipDef, fakeRng, referenceWorld } from '../combat/base-content'

describe('숨 고르기(01 §1.2, 07 §3.5)', () => {
  it('최대 HP 4% × 회복 계수, 반올림', () => {
    const w = referenceWorld(9) // 최대 HP 73 → 2.92 → 3(04 §12.1)
    const ch = w.state.character!
    assert.equal(maxHp(w), 73)
    ch.hp = 60
    assert.equal(breathe(w), 3)
    assert.equal(ch.hp, 63)
  })

  it('가득 찬 체력은 더 늘지 않는다', () => {
    const w = referenceWorld(5)
    assert.equal(breathe(w), 0)
  })

  it('나이가 들면 회복 계수가 줄어든다(01 §2.2)', () => {
    const w = referenceWorld(9)
    const ch = w.state.character!
    ch.hp = 40
    ch.eff_min = (60 - w.content.balance.time.start_age) * w.content.balance.time.min_per_year // 60세 → 0.8
    assert.equal(breathe(w), Math.floor(73 * 0.04 * 0.8 + 0.5))
  })
})

describe('야영과 휴식 지점(01 §6.1, 07 §5.3)', () => {
  it('식량이 있으면 최대 HP 30%, 피로 −40', () => {
    const w = referenceWorld(9)
    const ch = w.state.character!
    ch.hp = 20
    ch.fatigue = 60
    w.state.inventory.consumables = { CP06: 1 }
    const r = camp(w)
    assert.equal(r.ration, 'CP06')
    assert.equal(w.state.inventory.consumables.CP06, 0)
    assert.equal(r.hp, Math.round(73 * 0.3))
    assert.equal(ch.fatigue, 20)
  })

  it('식량이 없으면 효과가 절반이다', () => {
    const w = referenceWorld(9)
    const ch = w.state.character!
    ch.hp = 20
    ch.fatigue = 60
    w.state.inventory.consumables = {}
    const r = camp(w)
    assert.equal(r.ration, null)
    assert.equal(r.hp, Math.round(73 * 0.3 * 0.5))
    assert.equal(ch.fatigue, 40)
  })

  it('던전 휴식 지점은 HP +15%, 피로 −15', () => {
    const w = referenceWorld(9)
    const ch = w.state.character!
    ch.hp = 20
    ch.fatigue = 30
    const r = restPoint(w)
    assert.equal(r.hp, Math.round(73 * 0.15))
    assert.equal(ch.fatigue, 15)
  })
})

describe('마을 휴식(01 §6.1, 04 §8)', () => {
  it('여관비 = 5 + 2 × 레벨, 가득 차지 않으면 최대 2회', () => {
    const w = referenceWorld(6) // 01 §9.4: 레벨 6 여관비 17(07 §3.5 예)
    const ch = w.state.character!
    assert.equal(innFee(w), 17)
    ch.hp = 10
    ch.fatigue = 40
    ch.coins = 100
    ch.eff_min = (70 - w.content.balance.time.start_age) * w.content.balance.time.min_per_year // 70세 → 계수 0.7
    const r = townRest(w, 'inn')
    assert.equal(r.times, 2)
    assert.equal(r.coins, 34)
    assert.equal(ch.fatigue, 0)
    assert.equal(ch.counters.inn_rests, 2)
    assert.equal(ch.hp, maxHp(w)) // 0.7 + 0.7 ≥ 1
  })

  it('돈이 모자라면 여관에서 쉬지 않는다', () => {
    const w = referenceWorld(6)
    const ch = w.state.character!
    ch.hp = 10
    ch.coins = 5
    assert.equal(townRest(w, 'inn').times, 0)
    assert.equal(townRest(w, 'lodging').times, 1) // 길드 숙소는 무료, 한 번에 가득 찬다
  })
})

describe('회복약 자동 사용(04 §7.6, 08 §4)', () => {
  it('퇴각 기준 + 10%p 이하에서 기준선을 넘기는 가장 작은 병을 쓴다', () => {
    const w = referenceWorld(9) // 최대 HP 73, 모험적 퇴각 기준 40% → 기준선 50% = 36.5
    const ch = w.state.character!
    assert.equal(retreatHpRatio(w), 0.4)
    ch.hp = 33
    w.state.inventory.consumables = { CP01: 1, CP02: 1 }
    assert.deepEqual(usePotions(w, retreatHpRatio(w)), ['CP01']) // 33 + 15 = 48 > 36.5
    assert.equal(ch.hp, 48)
  })

  it('한 병으로 넘기지 못하면 가장 큰 병을 쓰고, 넘을 때까지 반복한다', () => {
    const w = referenceWorld(20) // 최대 HP 133 → 기준선 66.5
    const ch = w.state.character!
    ch.hp = 10
    w.state.inventory.consumables = { CP01: 2, CP02: 1 }
    assert.deepEqual(usePotions(w, retreatHpRatio(w)), ['CP02', 'CP01', 'CP01'])
    assert.equal(ch.hp, 70)
  })

  it('기준선을 넘고 있으면 마시지 않는다', () => {
    const w = referenceWorld(9)
    w.state.inventory.consumables = { CP01: 2 }
    assert.deepEqual(usePotions(w, retreatHpRatio(w)), [])
  })

  it('TI07 겁이 많음은 퇴각 기준 +10%p(01 §7.1)', () => {
    const w = referenceWorld(9)
    w.state.character!.traits = [{ id: 'TI07', since_age: 18, source: 'new' }]
    assert.equal(Math.round(retreatHpRatio(w) * 100), 50)
  })
})

describe('부상(01 §6.2)', () => {
  it('부상 판정 성공은 경상, 실패는 중상', () => {
    const w = referenceWorld(15)
    const ok = rollInjuryCheck(w, fakeRng({ d20: [20] }), 11)
    const bad = rollInjuryCheck(w, fakeRng({ d20: [1] }), 11)
    assert.equal(ok.record.dc, 15)
    assert.equal(ok.result, 'crit_success')
    assert.equal(bad.result, 'crit_failure')
  })

  it('전투 패배 부상은 힘·민첩 중 무작위, 함정은 민첩', () => {
    assert.equal(injuryStat(fakeRng({ index: [1] }), 'combat'), 'dex')
    assert.equal(injuryStat(fakeRng({ index: [0] }), 'combat'), 'str')
    assert.equal(injuryStat(fakeRng(), 'trap'), 'dex')
    assert.equal(injuryStat(fakeRng(), 'fear'), 'wil')
  })

  it('경상은 최대 2개, 세 번째 경상은 중상 1개로 합쳐진다', () => {
    const w = referenceWorld(15)
    const ch = w.state.character!
    addInjury(w, 'light', 'str', 'defeat')
    addInjury(w, 'light', 'dex', 'defeat')
    assert.equal(ch.injuries.length, 2)
    const third = addInjury(w, 'light', 'dex', 'defeat')
    assert.equal(third.merged, true)
    assert.equal(third.grade, 'serious')
    assert.deepEqual(ch.injuries.map((i) => i.grade), ['serious'])
    assert.equal(hasSeriousInjury(w), true)
  })

  it('중상 누적 3회면 카운터 획득 특성(TA03)을 알려 준다', () => {
    const w = referenceWorld(15)
    assert.deepEqual(addInjury(w, 'serious', 'str', 'defeat').trait_triggers, [])
    assert.deepEqual(addInjury(w, 'serious', 'str', 'defeat').trait_triggers, [])
    const third = addInjury(w, 'serious', 'str', 'defeat')
    assert.equal(third.serious_total, 3)
    assert.deepEqual(third.trait_triggers, ['TA03'])
  })

  it('경상은 유효 진행 3분(회복 계수 적용)에 낫고 중상은 낫지 않는다', () => {
    const w = referenceWorld(15)
    addInjury(w, 'light', 'dex', 'defeat')
    addInjury(w, 'serious', 'str', 'defeat')
    assert.deepEqual(tickInjuries(w, 2), [])
    assert.deepEqual(tickInjuries(w, 1), [{ grade: 'light', stat: 'dex' }])
    assert.deepEqual(w.state.character!.injuries.map((i) => i.grade), ['serious'])
  })

  it('부상은 관련 능력치 판정을 깎는다(05 §6.2)', () => {
    const w = referenceWorld(15)
    const before = rollInjuryCheck(w, fakeRng({ d20: [10] }), 11).bonus.bonus
    addInjury(w, 'serious', 'wil', 'defeat')
    const after = rollInjuryCheck(w, fakeRng({ d20: [10] }), 11).bonus.bonus
    assert.equal(after, before + w.content.balance.injury.serious.stat_add)
  })

  it('A07 종지기의 청동 흉갑은 부상 판정 +2', () => {
    const w = referenceWorld(20) // T4 방어구(A06)에는 부상 보정이 없다
    const before = rollInjuryCheck(w, fakeRng({ d20: [10] }), 25).bonus.bonus
    equipDef(w, 'A07')
    assert.equal(rollInjuryCheck(w, fakeRng({ d20: [10] }), 25).bonus.bonus, before + 2)
  })
})
