// 03 §5.3.1 출정 중 장착·해제 예약: 슬롯당 1건, 다음 마을 도착 때 적용.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyEquipOrders, cancelEquipOrder, orderEquip } from '../../src/items/index'
import { baseWorld, equipNew, give } from './base-fixture'

function bagged(w: ReturnType<typeof baseWorld>, defId: string): string {
  const uid = give(w, defId)
  w.state.inventory.bag.push(uid)
  return uid
}

describe('03 §5.3.1 장착 예약', () => {
  it('같은 슬롯의 새 예약이 이전 예약을 바꾸고, 다른 슬롯은 함께 남는다', () => {
    const w = baseWorld()
    const a = bagged(w, 'W02')
    const b = bagged(w, 'W03')
    const c = bagged(w, 'A02')
    orderEquip(w, a, 'equip')
    orderEquip(w, c, 'equip')
    orderEquip(w, b, 'equip')
    assert.deepEqual(w.state.inventory.equip_orders, [{ uid: c, op: 'equip' }, { uid: b, op: 'equip' }])
    cancelEquipOrder(w, c)
    assert.deepEqual(w.state.inventory.equip_orders, [{ uid: b, op: 'equip' }])
  })

  it('도착 때 장착하고 잠근다, 입던 것은 가방으로. 예약은 비운다', () => {
    const w = baseWorld()
    const old = equipNew(w, 'W02')
    const nu = bagged(w, 'W03')
    orderEquip(w, nu, 'equip')
    applyEquipOrders(w)
    const inv = w.state.inventory
    assert.equal(inv.equipped.weapon, nu)
    assert.ok(inv.bag.includes(old) && !inv.bag.includes(nu))
    assert.equal(w.state.item_instances[nu]!.locked, true)
    assert.deepEqual(inv.equip_orders, [])
  })

  it('해제 예약은 가방이 가득 차면 버린다', () => {
    const w = baseWorld()
    const worn = equipNew(w, 'A02')
    orderEquip(w, worn, 'unequip')
    for (let i = 0; i < w.content.balance.stats.bag_slots; i++) bagged(w, 'W02')
    applyEquipOrders(w)
    assert.equal(w.state.inventory.equipped.armor, worn)
    assert.deepEqual(w.state.inventory.equip_orders, [])
  })

  it('저주 장비는 확인 없이 예약하지 않는다', () => {
    const w = baseWorld()
    const cursed = bagged(w, 'J05')
    assert.throws(() => orderEquip(w, cursed, 'equip'), /저주/)
    orderEquip(w, cursed, 'equip', true)
    applyEquipOrders(w)
    assert.equal(w.state.inventory.equipped.accessory, cursed)
  })
})
