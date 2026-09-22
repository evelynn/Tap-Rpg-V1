// 장비 부가 효과(item_effect) 스키마. 좋은 등급 작은 효과·희귀 등급 행동 효과(08 §3.6·§3.7).
import { z } from 'zod'
import { def, modifier, ratio, slot } from '../common'

export const itemEffectSchema = def({
  name: z.string(),
  grade: z.enum(['good', 'rare']),
  slots: z.array(slot).min(1),
  modifiers: z.array(modifier),
  // 08 §7.3 평가 가치(ratio, 0.015 = 1.5%). 전투식에 반영되는 효과는 null
  value_pct: ratio.nullable(),
  description: z.string(),
})
