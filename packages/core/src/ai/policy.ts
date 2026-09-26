// 사용자 방침 바꾸기(03 §5.4·§2.6). 방침은 다음 판단 지점부터 적용된다. 값만 바꾸는 방침은 부르는 쪽이 policies에 바로 쓴다.
import type { RuleContext } from '../rules/context'

// 태도: 생애 기록의 태도 이력(attitude_log, 12 §7.1 사용 시간)에 남긴다. 같은 순간에 여러 번 바꾸면 마지막 값만 남긴다
export function setAttitude(ctx: RuleContext, id: string): void {
  ctx.content.get('attitude', id)
  const p = ctx.state.policies
  if (p.attitude === id) return
  p.attitude = id
  const ch = ctx.state.character
  if (!ch) return
  const last = ch.attitude_log.at(-1)
  if (last && last.eff_min === ch.eff_min) last.attitude = id
  else ch.attitude_log.push({ eff_min: ch.eff_min, attitude: id })
}
