import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  Pcg32, addSkillUses, addXp, allocateStat, allocationWeights, applyAging, encounterXp, enemyStats, maxHp, recoveryCoef, xpToNext,
} from '../../src/index'
import { makeContent, makeWorld, scriptedRng, setStats, setTraits } from '../fixture'

describe('레벨 필요 경험치 — 01 §2.4 표준 진행표', () => {
  const content = makeContent()
  const NEXT = [
    25, 65, 115, 170, 235, 305, 375, 445, 525, 600, 680, 760, 840, 920, 1005,
    1090, 1170, 1255, 1340, 1430, 1515, 1605, 1690, 1780, 1875, 1965, 2060, 2150, 2245,
  ]
  const CUM = [0, 25, 90, 205, 375, 610, 915, 1290, 1735, 2260, 2860, 3540, 4300, 5140, 6060, 7065, 8155, 9325, 10580, 11920,
    13350, 14865, 16470, 18160, 19940, 21815, 23780, 25840, 27990, 30235]
  it('req(1..29)와 누적 XP', () => {
    assert.deepEqual(NEXT.map((_, i) => xpToNext(content, i + 1)), NEXT)
    let acc = 0
    CUM.forEach((c, i) => {
      assert.equal(acc, c, `Lv${i + 1}`)
      acc += xpToNext(content, i + 1) ?? 0
    })
    assert.equal(xpToNext(content, 30), null)
  })
})

describe('조우 경험치 — 05 §3.3 예시', () => {
  const content = makeContent()
  // 레벨이 바뀐 적·비전투 장면: 적 경험치는 enemy_formula 식
  const xp = (enemyLevel: number, charLevel: number, activity: 'hunt' | 'adventure' | 'dungeon_room' = 'hunt', rank: 'normal' | 'elite' | 'boss' = 'normal') =>
    encounterXp(content, { baseXp: enemyStats(content.balance.enemy_formula, enemyLevel, rank).xp, enemyLevel, charLevel, activity })
  it('1~6·8·9', () => {
    assert.equal(xp(1, 1), 9)
    assert.equal(xp(8, 9), 30)
    assert.equal(xp(8, 14), 12)
    assert.equal(xp(1, 20), 1)
    assert.equal(xp(16, 15, 'dungeon_room'), 70)
    assert.equal(xp(12, 10, 'adventure'), 33)
    assert.equal(xp(9, 9), 33) // 밤 L8 → L9
    assert.equal(xp(8, 9) + xp(8, 9), 60)
  })
  it('등급 배수 뒤 소수 버림(EB01 45 × 2.5 = 112)', () => {
    assert.equal(xp(13, 13, 'hunt', 'elite'), 112)
  })
  it('레벨 오프셋 0이면 적 정의(등록부) 값을 그대로 쓴다', () => {
    assert.equal(encounterXp(content, { baseXp: 31, enemyLevel: 8, charLevel: 9, activity: 'hunt' }), 31) // 식은 30
    assert.equal(encounterXp(content, { baseXp: 31, enemyLevel: 8, charLevel: 14, activity: 'hunt' }), 12) // 31 × 0.4
  })
})

describe('레벨업(05 §3.4)', () => {
  it('여러 레벨이 한 번에 오르고, 최대 HP 증가분만큼 현재 HP도 오른다', () => {
    const w = makeWorld()
    setTraits(w, [])
    const ch = w.state.character!
    ch.hp = maxHp(w)
    const hp0 = ch.hp
    const ups = addXp(w, new Pcg32Stub(), 90 + 5)
    assert.deepEqual(ups, [{ level: 2, stat: null }, { level: 3, stat: null }])
    assert.equal(ch.level, 3)
    assert.equal(ch.xp, 5)
    assert.equal(ch.hp, hp0 + 8)
    assert.equal(ch.hp, maxHp(w))
  })

  it('레벨 4에 능력치 배분(life 흐름), 사용 점수 × 0.5', () => {
    const w = makeWorld()
    setTraits(w, [])
    const ch = w.state.character!
    ch.level = 3
    ch.stat_use_points.str = 10
    const before = ch.stats.str
    const ups = addXp(w, Pcg32.seed(1n, 2n), 115)
    assert.equal(ups.length, 1)
    assert.equal(ups[0]!.level, 4)
    assert.ok(ups[0]!.stat)
    assert.deepEqual(ch.stat_growth, [{ level: 4, stat: ups[0]!.stat }])
    assert.equal(ch.stat_use_points.str, 5)
    if (ups[0]!.stat === 'str') assert.equal(ch.stats.str, before + 1)
  })
})

describe('능력치 배분 점수(05 §4.2)', () => {
  it('수호자 예시: 힘 0.68 · 민첩 0.08 · 지식 0.06 · 의지 0.16 · 사교 0.03(하한) · 행운 0.07', () => {
    const w = makeWorld()
    setTraits(w, [])
    const ch = w.state.character!
    ch.specialization = 'guardian'
    ch.stat_use_points = { str: 40, dex: 8, kno: 6, wil: 4, soc: 2, luk: 1 }
    const got = allocationWeights(w)
    ;[0.68, 0.08, 0.06, 0.16, 0.03, 0.07].forEach((v, i) => assert.ok(Math.abs(got[i]! - v) < 1e-9, `${i}: ${got[i]}`))
  })

  it('초보 모험가는 사용 비율만, 사용 점수가 없으면 각 1로 본다, 상한 8은 후보에서 빠진다', () => {
    const w = makeWorld()
    setTraits(w, [])
    setStats(w, { str: 8 })
    const got = allocationWeights(w)
    assert.deepEqual(got.map((x) => Math.round(x * 1000) / 1000), [0, 0.2, 0.2, 0.2, 0.2, 0.05])
  })

  it('가중 추첨으로 1점, 기록과 감쇠', () => {
    const w = makeWorld()
    setTraits(w, [])
    const ch = w.state.character!
    ch.level = 7
    ch.stat_use_points = { str: 0, dex: 4, kno: 0, wil: 0, soc: 0, luk: 0 }
    const weights = allocationWeights(w)
    const dex = ch.stats.dex
    assert.equal(allocateStat(w, scriptedRng([{ weights, index: 1 }])), 'dex')
    assert.equal(ch.stats.dex, dex + 1)
    assert.deepEqual(ch.stat_growth, [{ level: 7, stat: 'dex' }])
    assert.equal(ch.stat_use_points.dex, 2)
  })
})

describe('숙련 사용 횟수(05 §5)', () => {
  it('단계 문턱 15/50/120/250/450, 수호자 근접 ×1.25', () => {
    const w = makeWorld()
    const ch = w.state.character!
    ch.specialization = 'guardian'
    assert.equal(addSkillUses(w, 'melee', 11), null)
    assert.deepEqual(addSkillUses(w, 'melee', 1), { skill: 'melee', from: 0, to: 1 }) // 15.0
    assert.deepEqual(addSkillUses(w, 'melee', 100), { skill: 'melee', from: 1, to: 3 }) // 140
    assert.equal(addSkillUses(w, 'survival', 1), null)
    assert.equal(ch.skills.survival.uses, 1.25)
  })
})

describe('노화(05 §9)', () => {
  it('50세 지식·의지 +1(상한 8이면 적용 안 함), 60세 힘·민첩 −1, 70·80세 −1(최저 1)', () => {
    const w = makeWorld()
    setStats(w, { str: 2, dex: 1, kno: 8, wil: 3 })
    assert.deepEqual(applyAging(w, 49, 50), [{ age: 50, stat: 'wil', delta: 1 }])
    // 60세 이정표에는 floor가 없지만 능력치 최저 1(05 §1) 아래로 가지 않는다
    assert.deepEqual(applyAging(w, 50, 60), [{ age: 60, stat: 'str', delta: -1 }])
    const ch = w.state.character!
    assert.deepEqual([ch.stats.str, ch.stats.dex, ch.stats.kno, ch.stats.wil], [1, 1, 8, 4])
    setStats(w, { str: 3, dex: 3 })
    assert.deepEqual(applyAging(w, 60, 80).map((c) => [c.age, c.stat, c.delta]), [[70, 'str', -1], [70, 'dex', -1], [80, 'str', -1], [80, 'dex', -1]])
    assert.deepEqual(applyAging(w, 80, 95), []) // 90세 −1이지만 이미 최저 1
  })

  it('노화로 최대 HP가 줄면 현재 HP를 자른다', () => {
    const w = makeWorld()
    setTraits(w, [])
    setStats(w, { str: 4, dex: 3 })
    const ch = w.state.character!
    ch.hp = maxHp(w)
    const before = ch.hp
    applyAging(w, 59, 60)
    assert.equal(maxHp(w), before - 3) // 힘 −1 → 3 × 힘
    assert.equal(ch.hp, maxHp(w))
  })

  it('회복 계수: 18~49 1.0, 50~59 0.9', () => {
    const w = makeWorld()
    assert.equal(recoveryCoef(w), 1.0)
    w.state.character!.eff_min = 12 * 37 // 55세
    assert.equal(recoveryCoef(w), 0.9)
  })
})

// 레벨 1~3 사이에는 배분이 없어 난수를 쓰지 않는다
class Pcg32Stub {
  nextU32(): number { throw new Error('난수를 쓰면 안 된다') }
  bounded = this.nextU32
  int = this.nextU32
  d20 = this.nextU32
  chance = (): boolean => this.nextU32() > 0
  weightedIndex = this.nextU32
  pick = <T>(): T => this.nextU32() as T
}
