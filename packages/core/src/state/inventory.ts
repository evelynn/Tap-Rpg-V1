// 가방·장착(16 §5.5)과 장비 인스턴스.
import { z } from 'zod'
import { GRADES, SLOTS, modifier } from '../schema/index'
import { defId, effMinV, intV, nat, s, uid } from './common'

const grade = z.enum(GRADES)
const slot = z.enum(SLOTS)

export const inventorySchema = s({
  equipped: z.record(slot, uid.nullable()),
  bag: z.array(uid),
  pending_box: z.array(uid),
  consumables: z.record(defId, nat),
  relic_designations: z.array(s({ uid, priority: z.union([z.literal(1), z.literal(2)]) })),
  equip_suggestions: z.array(s({
    slot,
    source: z.union([s({ uid }), s({ shop_def_id: defId, grade, price: nat })]),
    improvement: z.number(),
    reason: z.string(),
    created_eff_min: effMinV,
  })),
  dismissed_suggestions: z.array(s({ def_id: defId, grade, season_key: z.string() })),
  // 출정 중 장착·해제 예약(03 §5.3.1). 슬롯당 1건, 다음 마을 도착 때 적용. optional이라 옛 저장도 읽는다
  equip_orders: z.array(s({ uid, op: z.enum(['equip', 'unequip']) })).optional(),
})
export type Inventory = z.infer<typeof inventorySchema>

export const itemInstanceSchema = s({
  uid,
  def_id: defId,
  grade,
  effects: z.array(defId).optional(),
  prefix: z.string().optional(),
  defect: z.array(modifier).optional(),
  locked: z.boolean(),
  lock_source: z.enum(['user', 'manual_equip']).optional(),
  used: z.boolean().optional(),
  acquired: s({ gen: intV, char_uid: uid, age: intV, location: defId, source: z.string() }),
  history: z.array(s({
    gen: intV,
    char_name: z.string(),
    age: intV,
    kind: z.enum(['acquired', 'equipped', 'notable', 'inherited', 'potential_opened']),
    text: z.string(),
  })),
  charges: z.record(z.string(), nat).optional(),
  inherited_from_gen: intV.optional(),
})
export type ItemInstance = z.infer<typeof itemInstanceSchema>
