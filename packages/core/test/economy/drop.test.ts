// 08 §6 드롭 결정과 §9.3~§9.5 가방·대기함·고유 장비 대체.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Rng } from '../../src/index'
import { dropCandidates, dropGradeWeights, grantItem, guaranteedDrop, markRareGain, materializeItem, putPending, rollDrop, rollEncounterDrop, stowLoot } from '../../src/items/index'
import { baseContent, baseWorld, give } from './base-fixture'

// 예정된 값만 돌려주는 난수(weightedPick은 nextU32 하나를 쓴다)
function fakeRng(plan: { u32?: number[]; chance?: boolean[]; pick?: number[] } = {}): Rng {
  const u32 = [...(plan.u32 ?? [])]
  const chance = [...(plan.chance ?? [])]
  const pick = [...(plan.pick ?? [])]
  const fail = (what: string): never => {
    throw new Error(`fakeRng: 예정에 없던 ${what}`)
  }
  return {
    nextU32: () => (u32.length ? u32.shift()! : fail('nextU32')),
    chance: () => (chance.length ? chance.shift()! : fail('chance')),
    pick: <T>(items: readonly T[]) => items[pick.length ? pick.shift()! : 0]!,
    bounded: () => fail('bounded'),
    int: () => fail('int'),
    d20: () => fail('d20'),
    weightedIndex: () => fail('weightedIndex'),
  }
}
// 가중치 목록에서 index가 뽑히게 하는 u32
const atIndex = (weights: number[], index: number): number => {
  const total = weights.reduce((a, b) => a + b, 0)
  const before = weights.slice(0, index).reduce((a, b) => a + b, 0)
  return Math.floor(((before + weights[index]! / 2) / total) * 0x100000000)
}

describe('08 §6.3 행운 보정', () => {
  it('행운 4가 던전 보물 상자를 열면 64.44 / 28 / 7.56 / 0', () => {
    const w = dropGradeWeights(baseContent(), 'treasure_chest', 4)
    assert.deepEqual(w.map((x) => Math.round(x * 100) / 100), [64.44, 28, 7.56, 0])
  })

  it('보정은 rare_drop_cap(×1.16)에서 멈춘다', () => {
    const w = dropGradeWeights(baseContent(), 'treasure_chest', 20)
    assert.equal(Math.round(w[2]! * 100) / 100, 8.12)
  })
})

describe('08 §6.1 드롭 후보와 단계', () => {
  it('H1(T1) 후보 = 장소 전용 W03·J02(가중치 2) + 상점 품목 W02·A02(1)', () => {
    const c = dropCandidates(baseContent(), 'H1', 1).map((x) => [x.def.id, x.weight])
    assert.deepEqual(c, [['W02', 1], ['W03', 2], ['A02', 1], ['J02', 2]])
  })

  it('D2(T3) 후보: 장소 전용 A05는 2, 단계가 다른 W08·A06은 1', () => {
    const c = new Map(dropCandidates(baseContent(), 'D2', 3).map((x) => [x.def.id, x.weight]))
    assert.deepEqual([c.get('A05'), c.get('W08'), c.get('A06'), c.get('W06')], [2, 1, 1, 1])
  })

  it('사냥 조우 드롭: 일반 등급 W03', () => {
    const w = baseWorld()
    const rng = fakeRng({ chance: [true], u32: [atIndex([90, 9, 1, 0], 0), atIndex([1, 2, 1, 2], 1)] })
    assert.deepEqual(rollDrop(w, rng, { table: 'hunt', location: 'H1' }), { def_id: 'W03', grade: 'common', effects: [] })
  })

  it('좋은 등급이면 60% 확률로 작은 효과 1개', () => {
    const w = baseWorld()
    const rng = fakeRng({ chance: [true, true], u32: [atIndex([90, 9, 1, 0], 1), atIndex([1, 2, 1, 2], 0)], pick: [1] })
    const spec = rollDrop(w, rng, { table: 'hunt', location: 'H1' })
    assert.equal(spec!.grade, 'good')
    assert.equal(spec!.effects.length, 1)
    assert.ok(['E01', 'E02', 'E07', 'E08', 'E09'].includes(spec!.effects[0]!))
  })

  it('관문 보상의 단계는 관문 적 레벨의 단계다(EB01 L13 → T3)', () => {
    const w = baseWorld()
    const rng = fakeRng({ chance: [true, true], u32: [atIndex([0, 60, 38, 2], 1), atIndex([1, 1, 2, 1], 2)], pick: [0] })
    const spec = rollDrop(w, rng, { table: 'elite_gate', location: 'D2', gateEnemy: 'EB01' })
    assert.equal(baseContent().get('item', spec!.def_id).tier, 3)
  })

  it('D3 보물 방에서 희귀가 나오면 50%로 J05, 이미 가문에 있으면 일반 굴림으로 돌아간다', () => {
    const w = baseWorld()
    const rare = atIndex([65, 28, 7, 0], 2)
    const first = rollDrop(w, fakeRng({ chance: [true, true], u32: [rare] }), { table: 'treasure_chest', location: 'D3', room: 'treasure' })
    assert.deepEqual(first, { def_id: 'J05', grade: 'rare', effects: [] })
    materializeItem(w, first!, { gen: 1, char_uid: w.state.character!.uid, age: 18, location: 'D3', source: 'drop' })
    stowLoot(w, w.state.inventory.bag.at(-1) ?? Object.keys(w.state.item_instances).at(-1)!)
    const again = rollDrop(w, fakeRng({ chance: [true], u32: [rare, atIndex([1, 1, 2], 2)], pick: [0] }), { table: 'treasure_chest', location: 'D3', room: 'treasure' })
    assert.notEqual(again!.def_id, 'J05')
    assert.equal(again!.grade, 'rare')
    assert.equal(again!.effects.length, 1)
  })
})

describe('08 §6.4 첫 출정 보장 드롭 (D21)', () => {
  it('첫 가문 첫 인물의 첫 출정 3번째 조우는 A02 일반, 부가 효과 없음', () => {
    const w = baseWorld({ flags: { first_sortie_of_family: true, first_sortie_of_character: true } })
    assert.deepEqual(guaranteedDrop(w, 3), { def_id: 'A02', grade: 'common', effects: [] })
    assert.equal(guaranteedDrop(w, 2), null)
    // 조우 드롭은 보장 드롭을 먼저 쓴다(난수를 쓰지 않는다)
    assert.deepEqual(rollEncounterDrop(w, fakeRng(), { table: 'hunt', location: 'H1', encounterNo: 3 })!.def_id, 'A02')
  })

  it('첫 가문이 아니면 보장 드롭이 없다', () => {
    const w = baseWorld({ flags: { first_sortie_of_family: false, first_sortie_of_character: true } })
    assert.equal(guaranteedDrop(w, 3), null)
  })
})

describe('08 §9.5 고유 장비 재획득 대체', () => {
  it('W10을 다시 얻으면 T5 희귀(W09 또는 A07) 1개로 대신 준다', () => {
    const w = baseWorld()
    const uid = give(w, 'W10')
    w.state.inventory.bag.push(uid)
    const got = grantItem(w, fakeRng({ pick: [0, 0] }), { item_id: 'W10', to: 'bag', source: 'gate' })
    const inst = w.state.item_instances[got!.uid]!
    assert.equal(got!.replaced_from, 'W10')
    assert.ok(['W09', 'A07'].includes(inst.def_id))
    assert.equal(inst.grade, 'rare')
    assert.equal(inst.effects!.length, 1)
  })

  it('가문에 없으면 그대로 준다', () => {
    const w = baseWorld()
    const got = grantItem(w, fakeRng(), { item_id: 'W07', to: 'bag', source: 'event' })
    assert.equal(w.state.item_instances[got!.uid]!.def_id, 'W07')
  })
})

describe('08 §9.3~§9.4 현장 정리와 수령 대기함', () => {
  const fill = (w: ReturnType<typeof baseWorld>, n: number, defId = 'W02') => {
    for (let i = 0; i < n; i++) w.state.inventory.bag.push(give(w, defId, 'common'))
  }

  it('가방이 차면 판매가가 가장 낮은 비보호 장비 1개를 현장 환전한다(판매가 × 80%, 내림)', () => {
    const w = baseWorld()
    const ch = w.state.character!
    fill(w, 19)
    w.state.inventory.bag.push(give(w, 'J02', 'common')) // 판매가 24가 가장 낮다
    ch.coins = 0
    const r = stowLoot(w, give(w, 'W04', 'common'))
    assert.deepEqual([r.fieldSold, ch.coins], [1, 19]) // 24 × 0.8 = 19.2 → 19
    assert.equal(w.state.inventory.bag.length, 20)
    assert.ok(!w.state.inventory.bag.some((u) => w.state.item_instances[u]?.def_id === 'J02'))
  })

  it('모두 보호 대상이면 희귀·고유는 수령 대기함으로 간다', () => {
    const w = baseWorld()
    fill(w, 20, 'W07') // 고유 = 보호 대상
    const uid = give(w, 'J05', 'rare')
    assert.deepEqual(stowLoot(w, uid), { fieldSold: 0 })
    assert.deepEqual(w.state.inventory.pending_box, [uid])
  })

  it('대기함이 가득 차면 가장 오래된 희귀(고유 제외)를 판매가로 환전한다', () => {
    const w = baseWorld()
    const ch = w.state.character!
    const first = give(w, 'A05', 'rare')
    putPending(w, first)
    for (let i = 0; i < 9; i++) putPending(w, give(w, 'W07', 'rare'))
    ch.coins = 0
    putPending(w, give(w, 'J05', 'rare'))
    assert.equal(ch.coins, 1238) // A05 희귀 4,950 × 25%
    assert.equal(w.state.inventory.pending_box.length, 10)
    assert.ok(!w.state.inventory.pending_box.includes(first))
  })
})

describe('희귀 이상 획득 기록(14 §2, 18 §4.1 rare_gain, D76)', () => {
  it('가방에만 들어간 희귀 장비는 [장비] 획득 한 줄(주요, rare_gain)을 더한다', () => {
    const w = baseWorld()
    const uid = give(w, 'W08', 'rare')
    w.state.inventory.bag.push(uid)
    const out = markRareGain(w, uid, [])
    assert.equal(out.length, 1)
    assert.deepEqual([out[0]!.tag, out[0]!.importance, out[0]!.sub, out[0]!.refs?.item_uid], ['gear', 'major', 'rare_gain', uid])
    assert.match(out[0]!.line, /손에 넣었다$/)
  })

  it('바로 찬 기록이 있으면 그 기록을 올리고 새 줄을 더하지 않는다', () => {
    const w = baseWorld()
    const uid = give(w, 'W08', 'legendary')
    w.state.inventory.equipped.weapon = uid
    const out = markRareGain(w, uid, [{ tag: 'gear', line: '주운 검을 바로 찼다.', refs: { item_uid: uid } }])
    assert.equal(out.length, 1)
    assert.deepEqual([out[0]!.importance, out[0]!.sub], ['major', 'rare_gain'])
  })

  it('일반·좋은 등급, 가방에 남지 않은(현장에서 판) 희귀는 그대로다', () => {
    const w = baseWorld()
    const good = give(w, 'W08', 'good')
    w.state.inventory.bag.push(good)
    assert.deepEqual(markRareGain(w, good, []), [])
    const sold = give(w, 'W08', 'rare')
    assert.deepEqual(markRareGain(w, sold, []), [])
  })
})
