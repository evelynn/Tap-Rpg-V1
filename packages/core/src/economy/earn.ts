// 번 동전(12 §7.1, 16 §5.3 life_record.summary.coins_earned). 들어온 동전을 소지금과 생애 카운터에 함께 더한다.
// 전리품·판매·의뢰 보상처럼 동전이 들어오는 자리는 이 함수를 쓴다. 손실·지출은 세지 않는다(총수입)
import { characterOf, type RuleContext } from '../rules/context'

export const COINS_EARNED = 'coins_earned'

export function earnCoins(ctx: RuleContext, n: number): void {
  const ch = characterOf(ctx)
  ch.coins += n
  if (n > 0) ch.counters[COINS_EARNED] = (ch.counters[COINS_EARNED] ?? 0) + n
}
