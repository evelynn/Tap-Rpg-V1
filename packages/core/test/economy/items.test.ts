// 08 장비 수치·가격·잠재 상태 대조(설계 문서의 계산 예시를 합격 기준으로 옮겼다). 데이터는 기반 팩 content/base.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { damageProfile, hitBonus, innFee } from '../../src/index'
import { itemStats, levelTier, placeTier } from '../../src/items/index'
import { appraisal, basePrice, consumableBasePrice, itemBuyPrice, maintenanceFee, sellPrice, tierSlotPrice } from '../../src/economy/index'
import { baseContent, baseWorld, equipNew, give } from './base-fixture'

const C = () => baseContent()

describe('01 §9.2 장비 기준 가격', () => {
  it('단계 × 슬롯 배수 (일반)', () => {
    const rows: [number, number, number, number, number][] = [
      [1, 120, 108, 96, 180],
      [2, 380, 342, 304, 570],
      [3, 1100, 990, 880, 1650],
      [4, 3000, 2700, 2400, 4500],
      [5, 7500, 6750, 6000, 11250],
    ]
    for (const [tier, w, a, j, r] of rows) {
      assert.deepEqual(
        (['weapon', 'armor', 'accessory', 'relic'] as const).map((s) => Math.round(tierSlotPrice(C(), tier, s, 'common'))),
        [w, a, j, r],
        `T${tier}`,
      )
    }
  })

  it('등급 배수와 반올림: W04 380 / 836 / 1,900, A02 108 / 238 / 540, J03 304 / 669 / 1,520', () => {
    assert.deepEqual((['common', 'good', 'rare'] as const).map((g) => basePrice(C(), 'W04', g)), [380, 836, 1900])
    assert.deepEqual((['common', 'good', 'rare'] as const).map((g) => basePrice(C(), 'A02', g)), [108, 238, 540])
    assert.deepEqual((['common', 'good', 'rare'] as const).map((g) => basePrice(C(), 'J03', g)), [304, 669, 1520])
  })

  it('평가가: W07 5,500 · W10 37,500(전설 = 같은 단계 희귀) · R03 22,500 · J01 211 · J05 12,000', () => {
    assert.equal(appraisal(C(), 'W07', 'rare'), 5500)
    assert.equal(appraisal(C(), 'W10', 'legendary'), 37500)
    assert.equal(appraisal(C(), 'R03', 'rare'), 22500)
    assert.equal(appraisal(C(), 'J01', 'good'), 211)
    assert.equal(appraisal(C(), 'J05', 'rare'), 12000)
  })
})

describe('08 §3.1 등급별 기본 수치', () => {
  const stats = (defId: string, grade: 'common' | 'good' | 'rare' | 'legendary') => itemStats(C(), { def_id: defId, grade })

  it('무기 피해: T1 2~5 / 2~6 / 3~7, T2 5~10 / 6~12 / 7~13, T5 17~29 / 20~33 / 22~38 / 25~42', () => {
    assert.deepEqual((['common', 'good', 'rare'] as const).map((g) => stats('W02', g).damage), [[2, 5], [2, 6], [3, 7]])
    assert.deepEqual((['common', 'good', 'rare'] as const).map((g) => stats('W04', g).damage), [[5, 10], [6, 12], [7, 13]])
    assert.deepEqual((['common', 'good', 'rare'] as const).map((g) => stats('W06', g).damage), [[8, 16], [9, 18], [10, 21]])
    assert.deepEqual((['common', 'good', 'rare'] as const).map((g) => stats('W08', g).damage), [[12, 22], [14, 25], [16, 29]])
    assert.deepEqual((['common', 'good', 'rare'] as const).map((g) => stats('W09', g).damage), [[17, 29], [20, 33], [22, 38]])
    assert.deepEqual(stats('W10', 'legendary').damage, [25, 42])
  })

  it('명중 보정: 일반 0, 좋은 +1, 희귀 +1, 전설 +2. W01은 base 1~4', () => {
    assert.deepEqual((['common', 'good', 'rare', 'legendary'] as const).map((g) => stats('W04', g).hit), [0, 1, 1, 2])
    assert.deepEqual(stats('W01', 'common').damage, [1, 4])
  })

  it('방어구 방어는 등급마다 오르고 체력은 그대로', () => {
    const ac = (id: string) => (['common', 'good', 'rare'] as const).map((g) => stats(id, g).ac)
    assert.deepEqual(ac('A02'), [1, 2, 3])
    assert.deepEqual(ac('A03'), [3, 4, 5])
    assert.deepEqual(ac('A05'), [5, 6, 7])
    assert.deepEqual(ac('A06'), [7, 8, 9])
    assert.deepEqual(ac('A07'), [9, 10, 11])
    assert.deepEqual((['common', 'good', 'rare'] as const).map((g) => stats('A07', g).hp), [20, 20, 20])
    assert.deepEqual(stats('A02', 'rare').hp, 0)
  })
})

describe('08 §3.8 W04를 든 레벨 9 인물(힘 4, 근접 2)', () => {
  const setup = (grade: 'common' | 'good' | 'rare') => {
    const w = baseWorld()
    const ch = w.state.character!
    ch.level = 9
    ch.stats.str = 4
    ch.skills.melee = { uses: 0, rank: 2 }
    equipNew(w, 'W04', grade)
    return w
  }

  it('명중 일반 +6 / 좋은 +7 / 희귀 +7, 피해 7~12 / 8~14 / 9~15', () => {
    const rows: [('common' | 'good' | 'rare'), number, number, number][] = [
      ['common', 6, 7, 12], ['good', 7, 8, 14], ['rare', 7, 9, 15],
    ]
    for (const [grade, hit, lo, hi] of rows) {
      const w = setup(grade)
      assert.equal(hitBonus(w).bonus, hit, grade)
      const d = damageProfile(w)
      assert.deepEqual([d.min + d.bonus, d.max + d.bonus], [lo, hi], grade)
    }
  })
})

describe('12 §5.5 유품 잠재 상태', () => {
  const dormantAt = (defId: string, grade: 'rare' | 'legendary', level: number) => {
    const w = baseWorld()
    w.state.character!.level = level
    const uid = give(w, defId, grade)
    w.state.item_instances[uid]!.inherited_from_gen = 1
    return itemStats(C(), w.state.item_instances[uid]!, level)
  }

  it('예시 1 — W07(T3 희귀)을 레벨 1 후계자가 받음', () => {
    assert.deepEqual(dormantAt('W07', 'rare', 1), { tier: 1, dormant: true, damage: [3, 7], hit: 1, ac: null, hp: null })
    assert.deepEqual(dormantAt('W07', 'rare', 6).damage, [7, 13])
    const open = dormantAt('W07', 'rare', 12)
    assert.deepEqual([open.damage, open.dormant], [[10, 21], false])
  })

  it('예시 2 — W10(T5 전설)을 레벨 1 후계자가 받음', () => {
    assert.deepEqual([1, 6, 12, 18, 24].map((l) => dormantAt('W10', 'legendary', l).damage), [[3, 7], [7, 15], [12, 23], [17, 32], [25, 42]])
    assert.deepEqual([1, 24].map((l) => dormantAt('W10', 'legendary', l).hit), [2, 2])
  })

  it('잠재 상태에서는 특수 효과가 잠든다(수정자 집계에서 빠진다)', () => {
    const w = baseWorld()
    w.state.character!.level = 1
    const uid = equipNew(w, 'A07', 'common')
    w.state.item_instances[uid]!.inherited_from_gen = 1
    assert.equal(itemStats(C(), w.state.item_instances[uid]!, 1).ac, 1)
  })
})

describe('08 §5.2 가격 계산 순서', () => {
  it('할인은 합산하고 상한 −20%, 할증은 상한 없이 더한다', () => {
    const w = baseWorld()
    const ch = w.state.character!
    const priceMod = (value: number) => ({ modifier: { target: 'price_mult', op: 'add' as const, value }, scope: 'sortie' as const, remaining: null, expires_eff_min: null, source_event: null })
    assert.equal(itemBuyPrice(w, 'W04', 'common'), 380)
    ch.temp_mods = [priceMod(-0.1), priceMod(-0.06)] // TA01 −10% + E12 −3% ×2
    assert.equal(itemBuyPrice(w, 'W04', 'common'), 319) // 380 × 0.84
    ch.temp_mods.push(priceMod(-0.1)) // 합계 −26% → 상한 −20%
    assert.equal(itemBuyPrice(w, 'W04', 'common'), 304)
    ch.temp_mods.push({ ...priceMod(0), modifier: { target: 'shop_surcharge', op: 'add', value: 0.2 } })
    assert.equal(itemBuyPrice(w, 'W04', 'common'), 380) // 1 − 0.2 + 0.2
  })

  it('판매가 = 기준가 × 25%, 반올림. 판매 불가는 null, 지원 지급품은 0', () => {
    const w = baseWorld()
    const sell = (id: string, grade: 'common' | 'good' | 'rare') => sellPrice(w, { def_id: id, grade, acquired: { gen: 1, char_uid: 'ch_0001', age: 18, location: 'T00', source: 'drop' } })
    assert.equal(sell('W04', 'common'), 95)
    assert.equal(sell('W04', 'good'), 209)
    assert.equal(sell('W04', 'rare'), 475)
    assert.equal(sell('A03', 'common'), 86) // 342 × 0.25 = 85.5 → 86
    assert.equal(sell('A07', 'common'), 1688)
    assert.equal(sell('R01', 'rare'), 713)
    assert.equal(sell('W01', 'common'), 5)
    assert.equal(sell('W07', 'rare'), null)
    assert.equal(sellPrice(w, { def_id: 'W01', grade: 'common', acquired: { gen: 1, char_uid: 'ch_0001', age: 18, location: 'T00', source: 'aid' } }), 0)
  })

  it('여관비 = (5 + 2 × 레벨), 정비비 = 착용 장비 평가가 합 × 0.5% 올림', () => {
    const w = baseWorld()
    w.state.character!.level = 5
    assert.equal(innFee(w), 15)
    // 시작 장비 W01 + A01 = 120 + 108 → 1.14 → 2
    assert.equal(maintenanceFee(w), 2)
  })

  it('CP08 달빛 포도주 = 레벨 기준 단계 회복약 × 2 (20 / 60 / 160 / 400 / 900)', () => {
    const w = baseWorld()
    const cp08 = C().get('consumable', 'CP08')
    const prices = [1, 6, 12, 18, 24].map((lv) => {
      w.state.character!.level = lv
      return consumableBasePrice(w, cp08)
    })
    assert.deepEqual(prices, [20, 60, 160, 400, 900])
  })
})

describe('단계 도우미', () => {
  it('레벨 기준 단계와 장소 단계', () => {
    assert.deepEqual([1, 5, 6, 11, 12, 17, 18, 23, 24, 30].map((l) => levelTier(C(), l)), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
    assert.deepEqual(['H1', 'H3', 'D1', 'D2', 'D3'].map((r) => placeTier(C(), r)), [1, 2, 2, 3, 5])
  })
})
