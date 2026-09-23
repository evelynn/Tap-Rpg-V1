// 장비 인스턴스 소속 불변식(08 §9.3·§13.3): 출정 중 얻은 장비는 장착되거나 가방(차면 현장 정리)·수령 대기함에 들어간다.
// 어디에도 속하지 않는 인스턴스(고아)는 없어야 한다. 소속 밖에 남아도 되는 것은 판매 기록(희귀 이상·고유, 08 §13.3)과 쓴 기념품뿐이다.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createItemInstance, submitPendingAuto, succeed, type World } from '../../src/index'
import { makeGame } from './life-fixture'

const RECORD_GRADES = new Set(['rare', 'legendary'])

function ownedUids(world: World): Set<string> {
  const inv = world.state.inventory
  return new Set([...Object.values(inv.equipped).filter((u): u is string => !!u), ...inv.bag, ...inv.pending_box])
}

// 1분씩 돌리며 매 걸음 소속을 본다. 희귀 이상은 판매 기록으로 남을 수 있으나, 한 번도 소속된 적 없이 떨어져 있으면 고아다
function orphansAfter(world: World, minutes: number): { orphans: string[]; instances: number } {
  const everOwned = new Set<string>()
  const orphans = new Set<string>()
  const seen = new Set<string>()
  const check = () => {
    const owned = ownedUids(world)
    for (const u of owned) everOwned.add(u)
    for (const inst of Object.values(world.state.item_instances)) {
      seen.add(inst.uid)
      if (owned.has(inst.uid) || inst.used) continue
      const record = (RECORD_GRADES.has(inst.grade) || world.content.get('item', inst.def_id).unique) && everOwned.has(inst.uid)
      if (!record) orphans.add(`${inst.uid} ${inst.def_id} ${inst.grade} ${inst.acquired.source}`)
    }
  }
  for (let i = 0; i < minutes; i++) {
    check()
    if (world.state.pending_choice) {
      submitPendingAuto(world)
      continue
    }
    if (world.state.current_activity.state === 'awaiting_succession') {
      succeed(world)
      continue
    }
    world.advance(60)
  }
  check()
  return { orphans: [...orphans], instances: seen.size }
}

describe('장비 인스턴스 소속 불변식(08 §9.3)', () => {
  const cases = ['stable', 'adventurous', 'challenging'].flatMap((attitude) =>
    ['0123456789abcdef', '0000000000007a01'].map((seed) => ({ attitude, seed })))
  for (const c of cases) {
    it(`${c.attitude} ${c.seed}: 1500분 동안 고아 인스턴스 0`, () => {
      const world = makeGame({ seed: c.seed, attitude: c.attitude })
      const r = orphansAfter(world, 1500)
      assert.ok(r.instances > 10, `장비가 너무 적다: ${r.instances}`)
      assert.deepEqual(r.orphans, [], `고아 인스턴스 ${r.orphans.length}/${r.instances}`)
    })
  }

  it('가방이 찬 채로 출정하면 현장 정리하고 출정마다 한 줄을 남긴다(08 §9.3 3)', () => {
    const world = makeGame({ seed: '0123456789abcdef', attitude: 'adventurous' })
    for (let i = 0; i < 200 && !world.state.current_activity.sortie; i++) world.advance(60)
    const s = world.state.current_activity.sortie
    assert.ok(s, '출정이 시작되지 않았다')
    const ch = world.state.character!
    const bagSlots = world.content.balance.stats.bag_slots
    while (world.state.inventory.bag.length < bagSlots) {
      const inst = createItemInstance(world.content, world.state, 'W01', 'common', {
        gen: ch.generation, char_uid: ch.uid, age: 16, location: s.location_id, source: 'test',
      })
      world.state.inventory.bag.push(inst.uid)
    }
    const before = world.state.journal.length
    for (let i = 0; i < 400 && world.state.current_activity.sortie?.id === s.id && world.state.current_activity.state !== 'town_idle'; i++) {
      if (world.state.pending_choice) submitPendingAuto(world)
      else world.advance(60)
    }
    const lines = world.state.journal.slice(before).filter((e) => e.tag === 'gear' && /^가방이 차서 \d+개를 현장에서 팔았다\.$/.test(e.line))
    assert.equal(lines.length, 1, `현장 정리 기록 ${lines.length}건`)
    assert.ok(world.state.inventory.bag.length <= bagSlots, `가방 ${world.state.inventory.bag.length}칸`)
  })
})
