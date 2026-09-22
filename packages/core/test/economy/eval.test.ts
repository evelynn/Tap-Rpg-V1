// 08 §7 장비 평가 점수와 개선률 — 문서의 계산 예 1~3을 그대로 검산한다.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { improvement, itemValue, referenceEnemy, worthSwapping } from '../../src/items/index'
import { baseContent, baseWorld, equipNew } from './base-fixture'

const near = (a: number, b: number, eps = 0.0005) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`)

describe('08 §7.1 기준 적', () => {
  it('레벨 L 기준 적: 방어 10 + ⌊L/3⌋, 명중 2 + ⌊L/3⌋, 평균 피해', () => {
    assert.deepEqual(referenceEnemy(baseContent(), 1), { ac: 10, hit: 2, avgDamage: 1.5 })
    assert.deepEqual(referenceEnemy(baseContent(), 14).ac, 14)
    assert.deepEqual(referenceEnemy(baseContent(), 20), { ac: 16, hit: 8, avgDamage: 7 })
  })
})

describe('08 §7.4 계산 예 1 — 첫 인물, 모험적, 레벨 1', () => {
  const setup = () => {
    const w = baseWorld()
    const ch = w.state.character!
    ch.stats.str = 3
    ch.stats.dex = 2
    return w
  }

  it('A01 → A02는 +9.1%이고 교체 기준(8%)을 넘는다', () => {
    const w = setup()
    const imp = improvement(w, { def_id: 'A02', grade: 'common' })
    near(imp.value, 0.0909)
    assert.equal(imp.reason, 'start') // 시작 지급 장비 교체
    assert.ok(worthSwapping(w, { def_id: 'A02', grade: 'common' }, imp))
  })

  it('W01 → W02는 +28.6%', () => {
    near(improvement(setup(), { def_id: 'W02', grade: 'common' }).value, 0.2857)
  })
})

describe('08 §7.4 계산 예 2 — 도전적, 레벨 14, H3 주 활동', () => {
  it('W04 좋은(늑대 사냥꾼) → W06 일반은 +17.3%', () => {
    const w = baseWorld({ attitude: 'challenging' })
    const ch = w.state.character!
    ch.level = 14
    ch.stats.str = 5
    ch.stats.dex = 3
    ch.skills.melee = { uses: 0, rank: 3 }
    equipNew(w, 'W04', 'good', ['E07'])
    const imp = improvement(w, { def_id: 'W06', grade: 'common' }, { mainPlace: 'H3' })
    near(imp.value, 0.1731)
  })
})

describe('08 §7.4 계산 예 3 — 안정적 길잡이, 레벨 20', () => {
  it('A05 희귀(귀환 발걸음) → A06 일반은 −7.8%라 교체하지 않는다', () => {
    const w = baseWorld({ attitude: 'stable' })
    const ch = w.state.character!
    ch.level = 20
    ch.stats.str = 6
    ch.stats.dex = 4
    ch.specialization = 'pathfinder'
    equipNew(w, 'A05', 'rare', ['X03'])
    // V_현재 = 기동 +1(3% × 길잡이 1.5) + 밤 은밀 1% + X03 4% = 9.5%
    near(itemValue(w, w.state.item_instances[w.state.inventory.equipped.armor!]!).v, 0.095)
    const imp = improvement(w, { def_id: 'A06', grade: 'common' })
    near(imp.vNew, -0.03) // 이동 시간 +10% → −3%
    near(imp.combat, 0.0469)
    near(imp.value, -0.0781)
    assert.equal(worthSwapping(w, { def_id: 'A06', grade: 'common' }, imp), false)
  })
})

describe('08 §7.3 효과 가치 V', () => {
  it('장비 하나의 V는 v_cap(30%)을 넘지 않고, 저주 장비와 잠든 유품은 0이다', () => {
    const w = baseWorld()
    const uid = equipNew(w, 'J05', 'rare') // 저주 장비
    assert.equal(itemValue(w, w.state.item_instances[uid]!).v, 0)
    const j04 = w.state.item_instances[equipNew(w, 'J04', 'rare')]!
    assert.ok(itemValue(w, j04).v > 0)
    j04.inherited_from_gen = 1 // T3 유품을 레벨 1이 받으면 효과가 잠든다
    assert.equal(itemValue(w, j04).v, 0)
  })

  it('공포 판정 가치는 주 활동 장소가 D2·D3·H4·H5면 ×3', () => {
    const w = baseWorld()
    w.state.character!.level = 12
    const j04 = { def_id: 'J04', grade: 'common' as const }
    near(itemValue(w, j04).v, 0.01)
    near(itemValue(w, j04, { mainPlace: 'D2' }).v, 0.03)
  })
})
