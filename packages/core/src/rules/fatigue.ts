// 피로 증감(01 §2.5, 08 §3.3). 증가분에만 fatigue_gain_mult(A04 폐광 −30%, TM01 ×1.5)와
// 낮 출정의 day_fatigue_mult(R04)를 곱한다. 감소(야영·휴식)에는 곱하지 않는다.
import { characterOf, type RuleContext } from './context'
import { modValue } from './modifiers'
import { roundHalfUp } from './num'

// 실제로 바뀐 피로량을 돌려준다(0~fatigue.max로 자른 뒤)
export function addFatigue(ctx: RuleContext, delta: number): number {
  const ch = characterOf(ctx)
  const max = ctx.content.balance.stats.fatigue.max
  let d = delta
  if (d > 0) {
    const day = ctx.state.current_activity.sortie?.time_of_day === 'day'
    d = roundHalfUp(d * modValue(ctx, 'fatigue_gain_mult', 1) * (day ? modValue(ctx, 'day_fatigue_mult', 1) : 1))
  }
  const before = ch.fatigue
  ch.fatigue = Math.max(0, Math.min(max, before + d))
  return ch.fatigue - before
}
