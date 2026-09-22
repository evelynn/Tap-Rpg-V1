import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ageAt, lifeStageAt, seasonAt, stageBoundaryReached, type StageBoundaries, type TimeBalance } from '../src/time/index'

// 01 §1.1, 16 §2.1 balance.time 값, 생애 단계 경계는 balance.aging.life_stages의 from_age(I10)
const time: TimeBalance = { min_per_year: 12, season_min: 3, start_age: 18 }
const stages: StageBoundaries = [30, 50, 65]

describe('생애 시계', () => {
  it('나이 = 시작 나이 + ⌊eff_min/12⌋', () => {
    assert.equal(ageAt(0, time), 18)
    assert.equal(ageAt(11.99, time), 18)
    assert.equal(ageAt(12, time), 19)
    assert.equal(ageAt(144, time), 30)
    assert.equal(ageAt(600, time), 68)
  })

  it('계절은 출발 계절에서 3분마다 순환한다', () => {
    assert.equal(seasonAt(0, 'autumn', time), 'autumn')
    assert.equal(seasonAt(2.99, 'autumn', time), 'autumn')
    assert.equal(seasonAt(3, 'autumn', time), 'winter')
    assert.equal(seasonAt(6, 'autumn', time), 'spring')
    assert.equal(seasonAt(12, 'autumn', time), 'autumn') // 1년 뒤 같은 계절
    assert.equal(seasonAt(213.75, 'spring', time), 'winter') // ⌊71.25⌋ = 71, 71 mod 4 = 3
  })

  it('생애 단계(09 §1.1)', () => {
    const cases: [number, string][] = [
      [18, 'novice'], [29, 'novice'], [30, 'prime'], [49, 'prime'],
      [50, 'veteran'], [64, 'veteran'], [65, 'elder'], [98, 'elder'],
    ]
    for (const [age, stage] of cases) assert.equal(lifeStageAt(age, stages), stage, `${age}세`)
  })

  it('생애 단계 경계 도달 판정', () => {
    assert.equal(stageBoundaryReached(29, 30, stages), 30)
    assert.equal(stageBoundaryReached(30, 31, stages), null) // 이미 넘은 경계는 다시 알리지 않는다
    assert.equal(stageBoundaryReached(25, 29, stages), null)
    assert.equal(stageBoundaryReached(40, 66, stages), 50) // 여럿이면 가장 이른 경계
    assert.equal(stageBoundaryReached(64, 65, stages), 65)
  })
})
