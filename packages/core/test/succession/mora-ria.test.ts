// 12 §9 기준 시나리오(모라 → 리아). 문서 묶음 전체의 기준값이라 고정 난수로 그대로 재현한다.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { birthStatWeights, itemStats, sellPrice } from '../../src/index'
import { fullTraitSet, inheritTraits, relicsToPass, settle, writePartner } from '../../src/succession/index'
import { give, lifeWorld, scripted, setAge, stripStartingKit } from './fixture'

const MORA_INNATE = ['TI01', 'TI08'] // 12 §9.1 튼튼한 체질, 대식가
const BORI = ['TI06'] // 배우자 보리(호기심 많음)

describe('12 §9.2 자녀 후보 생성', () => {
  it('리아: 모라 TI01 성공·TI08 실패, 보리 TI06 성공 → 유전분 2, 신규 0', () => {
    const w = lifeWorld()
    // 0.21 < 0.35 성공, 0.62 실패, 0.30 < 0.35 성공. 신규 개수는 {0:60, 1:40}에서 0
    const rng = scripted({ chance: [true, false, true], frac: [0.1] })
    const inherited = inheritTraits(w.content, rng, { parent: MORA_INNATE, otherParent: BORI })
    assert.deepEqual(inherited, [{ id: 'TI01', from: 'parent' }, { id: 'TI06', from: 'other_parent' }])
    const all = fullTraitSet(w.content, rng, inherited)
    assert.deepEqual(all.map((t) => t.id), ['TI01', 'TI06'])
  })

  it('하온: 모라 TI01 실패·TI08 성공, 보리 실패 → 유전분 1, 신규 1', () => {
    const w = lifeWorld()
    const rng = scripted({ chance: [false, true, false], frac: [0.5, 0] })
    const inherited = inheritTraits(w.content, rng, { parent: MORA_INNATE, otherParent: BORI })
    assert.deepEqual(inherited, [{ id: 'TI08', from: 'parent' }])
    // 유전분 1 → {0:35, 1:50, 2:15}, r = 0.5 × 100 = 50 → 색인 1(신규 1개)
    const all = fullTraitSet(w.content, rng, inherited)
    assert.equal(all.length, 2)
    assert.equal(all[1]!.from, 'new')
  })

  it('후천 특성(TA01·TA04·TA05)은 유전 대상이 아니다', () => {
    const w = lifeWorld()
    const rng = scripted({ chance: [false, false, false], frac: [0] })
    const inherited = inheritTraits(w.content, rng, { parent: MORA_INNATE, otherParent: BORI })
    assert.deepEqual(inherited, [])
  })
})

describe('12 §9.6 출생 능력치 가중치', () => {
  it('리아의 분배 가중치는 힘 18 · 민첩 10 · 지식 15 · 의지 15 · 사교 10 · 행운 11이다', () => {
    const w = lifeWorld()
    const weights = birthStatWeights(w.content, { traits: ['TI01', 'TI06'], background: 'bg_miner', parentBest: ['str'] })
    assert.deepEqual(weights, [18, 10, 15, 15, 10, 11])
  })
})

describe('12 §9.4 유품과 잠재 상태', () => {
  it('W07(T3 희귀 고유)을 레벨 1 후계자가 받으면 피해 3~7 · 명중 +1 · 특수 효과 잠듦', () => {
    const w = lifeWorld()
    const uid = give(w, 'W07', 'rare', 'equip')
    const inst = { ...w.state.item_instances[uid]!, inherited_from_gen: 1 }
    const s = itemStats(w.content, inst, 1)
    assert.equal(s.dormant, true)
    assert.deepEqual(s.damage, [3, 7])
    assert.equal(s.hit, 1)
    // 레벨 12(T3)에서 개방
    const open = itemStats(w.content, inst, 12)
    assert.equal(open.dormant, false)
    assert.deepEqual(open.damage, [10, 21])
  })

  it('등록 유품 2개가 은퇴 때 그대로 넘어간다', () => {
    const w = lifeWorld()
    const weapon = give(w, 'W07', 'rare', 'equip')
    const acc = give(w, 'J04', 'good', 'equip')
    w.state.inventory.relic_designations = [{ uid: weapon, priority: 1 }, { uid: acc, priority: 2 }]
    assert.deepEqual(relicsToPass(w, 'retired').map((i) => i.uid), [weapon, acc])
    assert.deepEqual(relicsToPass(w, 'died').map((i) => i.uid), [weapon])
  })
})

describe('12 §6.2·§9.5 재산 정산', () => {
  it('정산 총액 4,721 → 20% 944 → 상한 360동전', () => {
    const w = lifeWorld()
    const ch = w.state.character!
    stripStartingKit(w)
    ch.coins = 1240
    const armor = give(w, 'A07', 'common', 'equip') // T5 일반, 착용
    const weapon = give(w, 'W08', 'good', 'bag') // T4 좋은, 가방
    const relic = give(w, 'R02', 'common', 'bag') // T2 일반, 가방
    const keepsake = give(w, 'J05', 'rare', 'bag') // 희귀 → 기념품
    w.state.inventory.consumables.CP05 = 2 // 회복약 T5 2개, 정산 제외
    assert.deepEqual(
      [armor, weapon, relic].map((u) => sellPrice(w, w.state.item_instances[u]!, [])),
      [1688, 1650, 143],
    )
    const s = settle(w, 'retired', [])
    assert.equal(s.total, 4721)
    assert.equal(s.ratio, 0.2)
    assert.equal(s.transferred, 360)
    assert.equal(s.capped, true)
    assert.deepEqual(s.keepsakes.map((i) => i.uid), [keepsake])
  })

  it('사망은 10%이고 상한 안이면 그대로 넘어간다(12 §6.2)', () => {
    const w = lifeWorld()
    stripStartingKit(w)
    w.state.character!.coins = 410
    give(w, 'W02', 'common', 'bag')
    const s = settle(w, 'died', [])
    assert.equal(s.ratio, 0.1)
    assert.equal(s.transferred, Math.floor(s.total * 0.1))
    assert.ok(s.transferred < 360)
  })
})

describe('12 §2.1 동반자', () => {
  it('동반자는 가문에 남고 자녀 유전의 다른 한 출처가 된다', () => {
    const w = lifeWorld()
    setAge(w, 30)
    writePartner(w.state.family, { gen: 1, name: '보리', job: '약초꾼', traits: BORI, hair_color: 'hair_chestnut' })
    const rng = scripted({ chance: [false, false, true], frac: [0] })
    const inherited = inheritTraits(w.content, rng, { parent: MORA_INNATE, otherParent: BORI })
    assert.deepEqual(inherited, [{ id: 'TI06', from: 'other_parent' }])
  })
})
