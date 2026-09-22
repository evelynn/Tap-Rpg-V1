import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Pcg32, birthStatWeights, drawNewInnateTraits, rollBirthStats } from '../../src/index'
import { makeContent, scriptedRng } from '../fixture'

const content = makeContent()
const IDX = { str: 0, dex: 1, kno: 2, wil: 3, soc: 4, luk: 5 } as const

describe('출생 능력치 — 05 §2.3 예시(고정 난수)', () => {
  it('리아: TI01·TI06, 광부 집안(의지), 부모 최고 능력치 힘 → 가중치 18/10/15/15/10/11, 추첨 힘·민첩·힘·행운', () => {
    const input = { traits: ['TI01', 'TI06'], background: 'bg_miner', parentBest: ['str'] as const }
    const weights = birthStatWeights(content, input)
    assert.deepEqual(weights, [18, 10, 15, 15, 10, 11])
    assert.equal(weights.reduce((a, b) => a + b, 0), 79)
    const rng = scriptedRng(['str', 'dex', 'str', 'luk'].map((s) => ({ weights, index: IDX[s as keyof typeof IDX] })))
    assert.deepEqual(rollBirthStats(content, rng, input), { str: 3, dex: 2, kno: 1, wil: 2, soc: 1, luk: 2 })
  })

  it('아린: TI03, 길드 사환(지식), 입양이라 부모 가중 없음 → 가중치 합 61, 추첨 민첩·힘·민첩·의지', () => {
    const input = { traits: ['TI03'], background: 'bg_guild' }
    const weights = birthStatWeights(content, input)
    assert.deepEqual(weights, [10, 15, 10, 10, 10, 6])
    const rng = scriptedRng(['dex', 'str', 'dex', 'wil'].map((s) => ({ weights, index: IDX[s as keyof typeof IDX] })))
    assert.deepEqual(rollBirthStats(content, rng, input), { str: 2, dex: 3, kno: 2, wil: 2, soc: 1, luk: 1 })
  })

  it('출생 최대 4: 4인 능력치는 후보에서 빠진다', () => {
    const input = { traits: [], background: 'bg_smithy' } // 힘 1점 고정 → 힘 2
    const w = birthStatWeights(content, input)
    const noStr = w.map((x, i) => (i === 0 ? 0 : x))
    const rng = scriptedRng([{ weights: w, index: 0 }, { weights: w, index: 0 }, { weights: noStr, index: 4 }, { weights: noStr, index: 4 }])
    assert.deepEqual(rollBirthStats(content, rng, input), { str: 4, dex: 1, kno: 1, wil: 1, soc: 3, luk: 1 })
  })
})

describe('첫 인물 선천 특성 — 06 §6.2~§6.4', () => {
  const traitWeights = [14, 12, 14, 12, 8, 14, 12, 14] // TI01..TI08

  it('유전분 0 행에서 개수를 뽑고 가중치로 추첨한다', () => {
    const rng = scriptedRng([{ weights: [55, 35, 10], index: 1 }, { weights: traitWeights, index: 2 }, { weights: [14, 12, 12, 8, 14, 12, 14], index: 5 }])
    assert.deepEqual(drawNewInnateTraits(content, rng, []), ['TI03', 'TI07'])
  })

  it('부정 특성 1개뿐이면 부정이 아닌 특성을 하나 더한다', () => {
    const rng = scriptedRng([{ weights: [55, 35, 10], index: 0 }, { weights: traitWeights, index: 4 }, { weights: [14, 12, 14, 12, 14, 12, 14], index: 0 }])
    assert.deepEqual(drawNewInnateTraits(content, rng, []), ['TI05', 'TI01'])
  })

  it('부정 특성은 2개 이상 뽑지 않는다(이미 있으면 후보에서 뺀다)', () => {
    const rng = scriptedRng([{ weights: [35, 50, 15], index: 1 }, { weights: [14, 12, 14, 12, 14, 12, 14], index: 6 }])
    assert.deepEqual(drawNewInnateTraits(content, rng, ['TI05']), ['TI08'])
  })

  it('많은 시드에서 1~3개, 중복 없음, 부정 1개 이하, 부정 단독 없음', () => {
    for (let i = 0n; i < 300n; i++) {
      const t = drawNewInnateTraits(content, Pcg32.seed(i, 7n), [])
      const neg = t.filter((id) => id === 'TI05').length
      assert.ok(t.length >= 1 && t.length <= 3, String(t))
      assert.equal(new Set(t).size, t.length)
      assert.ok(neg <= 1)
      assert.ok(!(t.length === 1 && neg === 1))
    }
  })
})
