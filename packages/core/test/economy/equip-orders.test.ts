// 03 §5.3.1 출정 중 장착·해제 예약: 슬롯당 1건, 다음 마을 도착 때 적용.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyEquipOrders, cancelEquipOrder, dropItemRefs, orderEquip, suggest } from '../../src/items/index'
import { isInTown } from '../../src/activity/town'
import { repairSave } from '../../src/save/index'
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

  it('일시정지·치료·선택 대기는 그 직전 상태로 마을 여부를 본다(독립 검증 1)', () => {
    const w = baseWorld()
    const ca = w.state.current_activity
    ca.state = 'paused'
    ca.paused_from = 'town_idle'
    assert.equal(isInTown(w), true)
    ca.paused_from = 'travel'
    assert.equal(isInTown(w), false)
    ca.state = 'treatment'
    assert.equal(isInTown(w), true)
  })

  it('장비가 사라지면 제안·예약·유품 지정이 함께 지워지고, 남은 예약이 새 예약을 막지 않는다(독립 검증 2·3)', () => {
    const w = baseWorld()
    const lost = bagged(w, 'W03')
    orderEquip(w, lost, 'equip')
    suggest(w, { slot: 'weapon', source: { uid: lost }, improvement: 0.1, reason: 'weapon_hit', created_eff_min: 0 }, 'x')
    w.state.inventory.relic_designations = [{ uid: lost, priority: 1 }]
    dropItemRefs(w.state.inventory, lost)
    delete w.state.item_instances[lost]
    const inv = w.state.inventory
    assert.deepEqual([inv.bag.includes(lost), inv.equip_orders, inv.equip_suggestions, inv.relic_designations], [false, [], [], []])
    // 옛 저장처럼 사라진 장비를 가리키는 예약이 남아 있어도 다음 예약은 된다
    inv.equip_orders = [{ uid: 'it_gone', op: 'equip' }]
    const next = bagged(w, 'W02')
    orderEquip(w, next, 'equip')
    assert.deepEqual(inv.equip_orders, [{ uid: next, op: 'equip' }])
    // 저장 보정 B14도 없는 장비를 가리키는 예약·제안을 지운다
    inv.equip_orders = [{ uid: 'it_gone', op: 'equip' }]
    inv.equip_suggestions = [{ slot: 'armor', source: { uid: 'it_gone' }, improvement: 0.1, reason: 'armor_ac', created_eff_min: 0 }]
    assert.ok(repairSave(w.content, w.state).some((d) => d.code === 'B14'))
    assert.deepEqual([inv.equip_orders, inv.equip_suggestions], [[], []])
  })

  it('가방이 가득할 때 대기함 장비를 입던 슬롯에 장착하는 예약은 버린다(가방 21칸 방지, 독립 검증 4)', () => {
    const w = baseWorld()
    const worn = equipNew(w, 'W02')
    const boxed = give(w, 'W03')
    w.state.inventory.pending_box.push(boxed)
    orderEquip(w, boxed, 'equip')
    for (let i = 0; i < w.content.balance.stats.bag_slots; i++) bagged(w, 'A02')
    applyEquipOrders(w)
    assert.equal(w.state.inventory.equipped.weapon, worn)
    assert.equal(w.state.inventory.bag.length, w.content.balance.stats.bag_slots)
  })

  it('수락한 제안은 같은 슬롯의 새 판단이 바꾸지 않는다(독립 검증 6)', () => {
    const w = baseWorld()
    suggest(w, { slot: 'armor', source: { shop_def_id: 'A02', grade: 'common', price: 100 }, improvement: 0.1, reason: 'armor_ac', created_eff_min: 0 }, 'a')
    w.state.inventory.equip_suggestions[0]!.accepted = true
    assert.equal(suggest(w, { slot: 'armor', source: { shop_def_id: 'A03', grade: 'common', price: 200 }, improvement: 0.2, reason: 'armor_ac', created_eff_min: 1 }, 'b'), null)
    assert.equal((w.state.inventory.equip_suggestions[0]!.source as { shop_def_id: string }).shop_def_id, 'A02')
  })
})
