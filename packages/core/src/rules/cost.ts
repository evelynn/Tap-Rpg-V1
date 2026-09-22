// 규칙 층이 소유하는 비용 식. 경제(가격)·회복(휴식)·사건 효과가 모두 같은 값을 써야 해서 여기에 둔다.
import { characterOf, type RuleContext } from './context'
import { modValue } from './modifiers'
import { roundHalfUp } from './num'

// 여관비 = (5 + 2 × 레벨) × inn_cost_mult(TI08 ×1.5, TA04 ×0.7), 반올림(08 §5.2).
// withMods=false면 수정자 없는 기본식(파산 종료선, 08 §11)
export function innFee(ctx: RuleContext, withMods = true): number {
  const c = ctx.content.balance.recovery.inn.cost
  const base = c.base + c.per_level * characterOf(ctx).level
  return withMods ? roundHalfUp(base * modValue(ctx, 'inn_cost_mult', 1)) : base
}
