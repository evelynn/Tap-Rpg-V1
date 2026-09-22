// 소모품(consumable) 스키마. 근거: CONTENT_SCHEMA §5.5, 16 §2.6, 08 §4.
import { z } from 'zod'
import { condition, def, int, modifier, nonNegInt, obj, ref, tier } from '../common'

// 가격 구조화(DS-08): 고정값 또는 레벨 기준 단계 회복약 가격의 배수
export const consumablePriceSchema = z.discriminatedUnion('kind', [
  obj({ kind: z.literal('fixed'), value: nonNegInt }),
  obj({ kind: z.literal('potion_of_level_tier'), mult: z.number().positive() }),
])

export const consumableSchema = def({
  name: z.string(),
  // 코드가 뜻을 아는 열거(엔진 처리)
  effect: z.enum(['heal_hp', 'camp_ration', 'cure_minor_injury', 'thirst_down']),
  amount: int,
  tier: tier.optional(),
  price: consumablePriceSchema,
  price_mods: z.array(modifier).optional(),
  carry_group: ref('carry_group'),
  // 판매 선언의 단일 출처
  shop: z.array(ref('facility')),
  // 구매·진열 추가 조건. 회복약의 단계 진열은 엔진이 tier로 판단한다
  requires: condition.optional(),
  sellable: z.literal(false),
}).superRefine((c, ctx) => {
  if (c.effect === 'heal_hp' && c.tier === undefined) {
    ctx.addIssue({ code: 'custom', path: ['tier'], message: '회복약(heal_hp)은 tier가 필요하다' })
  }
})
