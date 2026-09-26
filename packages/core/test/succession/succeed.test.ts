import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { World } from '../../src/index'
import { designateRelic, endLife, relicReturn, startHeir, type SuccessionPlan } from '../../src/succession/index'
import { give, lifeWorld, setAge, withFamily } from './fixture'

function retiringMora(seed?: string): World {
  const w = lifeWorld(seed !== undefined ? { seed } : {})
  const ch = w.state.character!
  withFamily(w, 2)
  ch.level = 26
  ch.coins = 1240
  ch.traits.push({ id: 'TA01', since_age: 36, source: 'acquired' })
  give(w, 'W07', 'rare', 'equip')
  give(w, 'J04', 'good', 'equip')
  give(w, 'A07', 'common', 'equip')
  give(w, 'W08', 'good', 'bag')
  give(w, 'R02', 'common', 'bag')
  designateRelic(w, w.state.inventory.equipped.weapon!, 1)
  designateRelic(w, w.state.inventory.equipped.accessory!, 2)
  setAge(w, 68)
  return w
}

function succeed(w: World, kind: 'retired' | 'died' = 'retired'): { plan: SuccessionPlan; heirUid: string } {
  const plan = endLife(w, { kind, place: 'T00', roleId: kind === 'retired' ? 'instructor' : null })
  const heir = startHeir(w, plan)
  return { plan, heirUid: heir.uid }
}

describe('계승 5단계(12 §1)', () => {
  it('1~2단계에서 연대기가 쌓이고 계승 대기로 멈춘다', () => {
    const w = retiringMora()
    const plan = endLife(w, { kind: 'retired', place: 'T00', roleId: 'instructor' })
    assert.equal(w.state.family.chronicle.length, 1)
    assert.equal(w.state.family.chronicle[0]!.end_age, 68)
    assert.equal(w.state.family.chronicle[0]!.end_kind, 'retired')
    assert.ok(plan.record.epithet.includes('모라'))
    assert.equal(w.state.current_activity.state, 'awaiting_succession')
    assert.equal(w.clockRunning, false)
  })

  it('3~5단계에서 새 인물이 18세·레벨 1로 출발한다', () => {
    const w = retiringMora()
    const { plan } = succeed(w)
    const heir = w.state.character!
    assert.equal(heir.generation, 2)
    assert.equal(heir.level, 1)
    assert.equal(heir.eff_min, 0)
    assert.equal(heir.parent_uid, 'ch_0001')
    assert.ok(heir.parent_call!.length > 0)
    assert.equal(heir.family_role, 'direct')
    assert.equal(w.state.current_activity.state, 'town_idle')
    // 출발 계절 = 부모 생애 종료 계절의 다음 계절
    assert.equal(heir.birth_season, 'summer')
    void plan
  })
})

describe('출발 풍경과 유품 귀환(12 §1.3·§5.6, D76)', () => {
  it('출발하면 마지막 기록이 [계승] 마을 어귀 한 줄이다', () => {
    const w = retiringMora()
    succeed(w)
    const last = w.state.journal.at(-1)!
    assert.equal(last.tag, 'succession')
    assert.match(last.line, new RegExp(`^${w.state.character!.name}[은는] 마을 어귀를 나섰다\.$`))
  })

  it('물려받아 착용한 유품은 생애에 한 번만 돌아오고, 무기가 먼저다', () => {
    const w = retiringMora()
    succeed(w)
    const inv = w.state.inventory
    const weapon = inv.equipped.weapon!
    assert.equal(w.state.item_instances[weapon]!.inherited_from_gen, 1) // 등록 1위 W07이 자동 장착됐다
    const first = relicReturn(w, 'D1')!
    assert.equal(first.sub, 'relic_return')
    assert.equal(first.refs?.item_uid, weapon)
    assert.match(first.line, new RegExp(`^${w.state.character!.parent_call}의 .+ 돌아왔다$`))
    assert.match(first.detail!, new RegExp(`다시 ${w.content.get('region', 'D1').name}에 섰다\.$`))
    const second = relicReturn(w, 'D1')
    assert.notEqual(second?.refs?.item_uid, weapon, '같은 유품은 한 생애에 한 번')
    // 물려받지 않은 장비만 차고 있으면 없다
    for (const slot of ['weapon', 'armor', 'accessory', 'relic'] as const) {
      const u = inv.equipped[slot]
      if (u && w.state.item_instances[u]!.inherited_from_gen !== undefined) inv.equipped[slot] = null
    }
    assert.equal(relicReturn(w, 'D1'), null)
  })
})

describe('계승 규칙 검사 위반 0(17 §4 단계 4)', () => {
  const kinds = [['retired', 2], ['died', 1]] as const
  for (const [kind, max] of kinds) {
    it(`${kind}: 유품 ${max}개 이하, 이전액 360 이하`, () => {
      const w = retiringMora()
      const { plan } = succeed(w, kind)
      assert.ok(plan.relicUids.length <= max, `유품 ${plan.relicUids.length}개`)
      assert.ok(plan.settlement.transferred <= 360, `이전액 ${plan.settlement.transferred}`)
      const bagAndEquipped = [
        ...Object.values(w.state.inventory.equipped).filter((u) => u !== null),
        ...w.state.inventory.bag,
      ]
      const inherited = bagAndEquipped.filter((u) => w.state.item_instances[u]?.inherited_from_gen !== undefined)
      assert.equal(inherited.length, plan.relicUids.length)
    })
  }

  it('레벨 1로 시작하고 숙련은 출신 배경이 준 1단계 외 0이다', () => {
    const w = retiringMora()
    succeed(w)
    const heir = w.state.character!
    assert.equal(heir.level, 1)
    assert.equal(heir.xp, 0)
    for (const [skill, v] of Object.entries(heir.skills)) {
      const expected = skill === w.content.get('background', heir.background).start_skill ? 1 : 0
      assert.equal(v.rank, expected, `숙련 ${skill}`)
    }
  })

  it('후천 특성은 유전되지 않고, 유전 선천 특성은 2개 이하(이전 인물 출처는 1개 이하)다', () => {
    for (let i = 0; i < 12; i++) {
      const w = retiringMora(`1111111111${i.toString(16).padStart(6, '0')}`)
      succeed(w)
      const heir = w.state.character!
      for (const t of heir.traits) {
        assert.equal(w.content.get('trait', t.id).kind, 'innate', `${t.id}는 선천 특성이 아니다`)
        assert.notEqual(t.source, 'acquired')
      }
      const inherited = heir.traits.filter((t) => t.source !== 'new')
      assert.ok(inherited.length <= 2, `유전 ${inherited.length}개`)
      assert.ok(inherited.filter((t) => t.source === 'parent').length <= 1)
      assert.ok(inherited.filter((t) => t.source === 'other_parent').length <= 1)
    }
  })

  it('시작 소지품은 01 §9.7과 같고, 유품이 채운 슬롯의 시작 장비만 빠진다', () => {
    const w = retiringMora()
    const { plan } = succeed(w)
    const kit = w.content.balance.economy.starting_kit
    const heir = w.state.character!
    assert.equal(heir.coins, kit.coins + plan.settlement.transferred)
    // 12 §9.4: 유품 W07이 무기 칸을 채우므로 시작 소지품의 W01은 받지 않는다
    assert.equal(w.state.item_instances[w.state.inventory.equipped.weapon!]!.def_id, 'W07')
    assert.equal(w.state.item_instances[w.state.inventory.equipped.accessory!]!.def_id, 'J04')
    assert.deepEqual(w.state.inventory.consumables, { ...kit.consumables })
    for (const id of kit.items) {
      const slot = w.content.get('item', id).slot
      const uid = w.state.inventory.equipped[slot]!
      const inst = w.state.item_instances[uid]!
      // 그 슬롯에 유품이 들어갔으면 시작 장비 대신 유품이다
      if (inst.inherited_from_gen === undefined) assert.equal(inst.def_id, id)
    }
  })

  it('흡혈귀 형질은 후계자에게 남지 않는다(09 §7.10)', () => {
    const w = retiringMora()
    const ch = w.state.character!
    ch.mutation = { trait_id: 'TM01', since_age: 58, long_sleep_age: 98, thirst: 80 }
    ch.traits.push({ id: 'TM01', since_age: 58, source: 'acquired' })
    ch.retire_age = 78
    ch.lifespan_extended = true
    w.state.inventory.consumables.CP08 = 3
    const plan = endLife(w, { kind: 'long_sleep', place: 'T00', longSleep: { cause: 'age', sleep_age: 98 } })
    startHeir(w, plan)
    const heir = w.state.character!
    assert.equal(heir.mutation, null)
    assert.equal(heir.traits.some((t) => t.id === 'TM01'), false)
    assert.equal(heir.retire_age, 68)
    assert.equal(heir.lifespan_extended, false)
    assert.equal(w.state.inventory.consumables.CP08, undefined)
    assert.equal(plan.relicUids.length, 2) // 긴 잠은 은퇴와 같다
  })
})

describe('결정성', () => {
  it('같은 시드 → 같은 계승 결과', () => {
    const a = retiringMora('abcdef0123456789')
    const b = retiringMora('abcdef0123456789')
    succeed(a)
    succeed(b)
    assert.deepEqual(a.snapshot(), b.snapshot())
  })

  it('다른 시드 → 다른 후계자', () => {
    const a = retiringMora('abcdef0123456789')
    const b = retiringMora('0f0f0f0f0f0f0f0f')
    succeed(a)
    succeed(b)
    assert.notDeepEqual(a.state.character!.birth_stats, b.state.character!.birth_stats)
  })
})
