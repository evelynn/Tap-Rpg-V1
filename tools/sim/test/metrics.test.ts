// 지표 계산(17 §5.2): 분위수와 합격 판정
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { LifeRow } from '../src/life'
import { aggregate, METRICS, quantile } from '../src/metrics'
import { baseContent } from './fixture'

const metric = (key: string) => {
  const m = METRICS.find((x) => x.key === key)
  assert.ok(m, `지표 ${key}가 없다`)
  return m
}

// 재려는 값만 채운 생애 한 줄
function row(over: Partial<LifeRow>): LifeRow {
  return {
    attitude: 'stable', seed: 1, gen: 1, end_kind: 'retired', end_age: 68, minutes: 600, peak_level: 20,
    combat_rounds: null, combat_hp_loss: null, sortie_minutes: null, level10_age: null, level20_age: null,
    retire_level: null, share_hunt: null, share_adventure: null, share_dungeon: null, normal_defeats: 0,
    fate_offers: 0, expense_ratio: null, first5_level2: null, first5_equip: null, first10_check: null,
    first10_return: null, first10_rest: null, income: 0, spend: 0, coins_end: 0, death_cause: null,
    sorties: 0, discoveries: 0, event_repeat_max: 0, bankruptcies: 0, choice_waits: 0, level30: 0,
    guild_rank: 'apprentice', deep_dungeon_age: null, deep_route_age: null, vampire: 0, thirst_end: 0,
    thirst_max: 0, thirst_high_ratio: 0, fate_by_event: {}, consumables: {},
    ...over,
  }
}

describe('분위수', () => {
  it('값이 없으면 null이다', () => {
    assert.equal(quantile([], 0.5), null)
  })

  it('중앙값과 p10·p90을 선형 보간으로 낸다', () => {
    const v = [1, 2, 3, 4, 5]
    assert.equal(quantile(v, 0.5), 3)
    assert.equal(quantile(v, 0.1), 1.4)
    assert.equal(quantile(v, 0.9), 4.6)
  })

  it('짝수 개수의 중앙값은 가운데 둘의 평균이다', () => {
    assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5)
  })
})

describe('합격 판정(17 §5.2)', () => {
  const content = baseContent()
  const rounds = metric('combat_rounds') // 목표 3~5

  it('중앙값이 범위 안이고 80% 이상이 범위 안이면 합격이다', () => {
    const rows = [4, 4, 4, 4, 4, 4, 4, 4, 4, 9].map((v) => row({ combat_rounds: v }))
    const s = aggregate(rounds, 'stable', content, rows)
    assert.equal(s.median, 4)
    assert.equal(s.in_range, 9)
    assert.equal(s.pass, true)
  })

  it('중앙값이 범위 안이어도 범위 안 생애가 80% 미만이면 불합격이다', () => {
    const rows = [1, 1, 4, 4, 4, 4, 9, 9, 9, 9].map((v) => row({ combat_rounds: v }))
    const s = aggregate(rounds, 'stable', content, rows)
    assert.equal(s.median, 4)
    assert.equal(s.in_range, 4)
    assert.equal(s.pass, false)
  })

  it('값이 없는 생애는 범위 밖으로 센다', () => {
    const rows = [row({ combat_rounds: 4 }), row({ combat_rounds: null })]
    const s = aggregate(rounds, 'stable', content, rows)
    assert.equal(s.lives, 2)
    assert.equal(s.measured, 1)
    assert.equal(s.in_range_ratio, 0.5)
    assert.equal(s.pass, false)
  })

  it('은퇴 지표는 은퇴로 끝난 생애만 센다', () => {
    const m = metric('retire_level')
    const rows = [
      row({ end_kind: 'retired', retire_level: 26 }),
      row({ end_kind: 'died', retire_level: null }),
      row({ end_kind: 'running', retire_level: null }),
    ]
    const s = aggregate(m, 'adventurous', content, rows)
    assert.deepEqual(s.target, [26, 28])
    assert.equal(s.lives, 1)
    assert.equal(s.pass, true)
  })

  it('첫 5분·첫 10분 지표는 새 가문 첫 인물만 센다', () => {
    const m = metric('first5_level2')
    const rows = [row({ gen: 1, first5_level2: 1 }), row({ gen: 2, first5_level2: null })]
    const s = aggregate(m, 'stable', content, rows)
    assert.equal(s.lives, 1)
    assert.equal(s.pass, true)
  })

  it('활동 비중 목표는 태도 정의의 가중치 ±10%p다(01 §17)', () => {
    const m = metric('share_dungeon')
    assert.deepEqual(m.range('stable', content), [0, 20])
    assert.deepEqual(m.range('challenging', content), [45, 65])
    assert.equal(m.range('없는태도', content), null)
  })
})
