// 특성 행동 훅 읽기(CONTENT_SCHEMA §4.8 traitHooks). 훅 이름은 등록부와 같다.
import { characterOf, type RuleContext } from '../rules/context'

type Hooks = Record<string, unknown>

// 지금 켜진 특성(변이 포함)의 ai_hooks
export function activeHooks(ctx: RuleContext): Hooks[] {
  const ch = characterOf(ctx)
  const ids = ch.traits.filter((t) => !t.inactive).map((t) => t.id)
  if (ch.mutation) ids.push(ch.mutation.trait_id)
  return ids.map((id) => (ctx.content.get('trait', id).ai_hooks ?? {}) as Hooks)
}

export function hookValues(ctx: RuleContext, name: string): unknown[] {
  return activeHooks(ctx).map((h) => h[name]).filter((v) => v !== undefined)
}

export const hookOn = (ctx: RuleContext, name: string): boolean => hookValues(ctx, name).some((v) => v === true)

// 훅 값마다 pick을 부르고 합한다
export function hookSum(ctx: RuleContext, name: string, pick: (v: unknown) => number | undefined): number {
  return hookValues(ctx, name).reduce<number>((s, v) => s + (pick(v) ?? 0), 0)
}
