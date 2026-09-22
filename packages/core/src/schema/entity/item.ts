// 장비(item) 스키마. 근거: CONTENT_SCHEMA §5.5, 16 §2.5, 08 §3·§5·§9.5.
import { z } from 'zod'
import { def, grade, int, modifier, nonNegInt, obj, range, ratio, ref, ROOM_KINDS, slot, template, tier } from '../common'

// 획득처. kind로 갈래를 고른다. drop 항목은 드롭 규칙의 입력(08 §6.1 장소 전용 장비).
// room·grade_is·chance가 없으면 그 장소의 일반 드롭 후보, 있으면 그 조건에서만 나온다.
export const itemSourceSchema = z.discriminatedUnion('kind', [
  obj({ kind: z.literal('event'), id: ref('event'), detail: z.string().optional() }),
  obj({
    kind: z.literal('drop'),
    id: ref('region'),
    room: z.enum(ROOM_KINDS).optional(),
    grade_is: grade.optional(),
    chance: ratio.optional(),
    once_per_life: z.boolean().optional(),
    detail: z.string().optional(),
  }),
  obj({ kind: z.literal('discovery'), id: ref('discovery'), detail: z.string().optional() }),
  obj({
    kind: z.enum(['shop', 'gate', 'guild_special', 'start', 'aid']),
    id: z.string().optional(),
    detail: z.string().optional(),
  }),
])

// 판매 선언의 단일 출처(시설에는 stock이 없다). 같은 시설·같은 pick_group은 재고 갱신마다 1개만 진열.
const shopEntry = obj({
  facility: ref('facility'),
  guild_rank_req: ref('guild_rank').optional(),
  grades: z.array(grade).min(1).optional(),
  pick_group: z.string().optional(),
})

// 고유 장비 재획득 대체(08 §9.5): 풀에서 균등 1개, 또는 그 출처의 일반 굴림을 이 장비를 빼고 다시.
const reacquire = z.union([
  obj({ pool: z.array(ref('item')).min(1), grade }),
  obj({ reroll: z.literal(true) }),
])

export const itemSchema = def({
  name: z.string(),
  slot,
  tier,
  grade_mode: z.enum(['rolled', 'fixed']),
  fixed_grade: grade.optional(),
  unique: z.boolean(),
  stat: z.enum(['str', 'dex', 'best_of_str_dex']).optional(),
  // 없으면 단계 기본 성능(01 §9.3), 있으면 덮어쓴다
  base: obj({ damage: range.optional(), hit: int.optional(), ac: int.optional(), hp: int.optional() }).optional(),
  modifiers: z.array(modifier).optional(),
  // 등급별 수정자. modifiers와 둘 다 있으면 합친다
  grade_modifiers: z.partialRecord(grade, z.array(modifier)).optional(),
  // 없으면 효과 정의의 slots로 정한다
  allowed_effects: z.array(ref('item_effect')).optional(),
  single_use: z.boolean().optional(),
  keepsake_after_use: z.string().optional(),
  cursed: z.boolean(),
  sources: z.array(itemSourceSchema),
  shop: z.array(shopEntry).optional(),
  reacquire: reacquire.optional(),
  price_override: nonNegInt.optional(),
  sellable: z.boolean(),
  sell_price_override: nonNegInt.optional(),
  appraisal_override: nonNegInt.optional(),
  visual_group: z.string(),
  story_template: template,
  description: z.string(),
}).superRefine((it, ctx) => {
  const add = (path: string, message: string, rule?: string) =>
    ctx.addIssue({ code: 'custom', path: [path], message, ...(rule ? { params: { rule } } : {}) })

  if ((it.slot === 'weapon') !== (it.stat !== undefined)) {
    add('stat', it.slot === 'weapon' ? '무기는 stat이 필요하다' : '무기가 아니면 stat을 쓰지 않는다')
  }
  if ((it.grade_mode === 'fixed') !== (it.fixed_grade !== undefined)) {
    add('fixed_grade', it.grade_mode === 'fixed' ? 'grade_mode fixed면 fixed_grade가 필요하다' : 'grade_mode rolled면 fixed_grade를 쓰지 않는다')
  }
  // V15 고유 장비
  if (it.unique) {
    if (it.grade_mode !== 'fixed') add('grade_mode', '고유 장비는 grade_mode fixed여야 한다', 'V15')
    if (it.sources.length === 0) add('sources', '고유 장비는 획득처가 1개 이상 필요하다', 'V15')
    // 상점 전용 고유는 가문에 있으면 진열에서 빠지므로 대체가 필요 없다
    const shopOnly = it.sources.length > 0 && it.sources.every((s) => s.kind === 'shop' || s.kind === 'guild_special')
    if (shopOnly && it.reacquire) add('reacquire', '상점 전용 고유 장비는 reacquire를 두지 않는다', 'V15')
    if (!shopOnly && !it.reacquire) add('reacquire', '고유 장비는 재획득 대체 reacquire가 필요하다(08 §9.5)', 'V15')
  }
  // V16 저주 장비(offer_purchase 풀 검사는 W1 교차)
  if (it.cursed && it.shop?.length) add('shop', '저주 장비는 상점에 진열하지 않는다', 'V16')
})

export type Item = z.infer<typeof itemSchema>
