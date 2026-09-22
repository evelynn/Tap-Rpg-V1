// 전리품 재료 스키마(16 §2.6.1). 재료 주머니에 쌓이고 가방 칸을 쓰지 않는다.
import { z } from 'zod'
import { def, line, nonNegInt, ref } from '../common'

export const materialSchema = def({
  name: z.string(),
  // 고정 출처를 먼저 둔다: union은 첫 성공 갈래를 쓰므로 'trap'이 적 ref로 잡히지 않는다(W1 V2 워커)
  source: z.union([z.enum(['trap', 'forage', 'vein']), ref('enemy')]),
  sell_price: nonNegInt,
  line,
})
