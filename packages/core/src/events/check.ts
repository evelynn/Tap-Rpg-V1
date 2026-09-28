// 사건 판정(05 §6, 10 §5.3·§6.2): 난이도, 성공 확률 P, 미리 굴린 주사위로 판정.
import type { Modifier } from '../schema/index'
import type { RuleContext } from '../rules/context'
import { checkBonus, checkDc, evaluateCheck, partialAllowed, rollCheck, successChance, type CheckRoll } from '../rules/check'
import { collectModSources } from '../rules/modifiers'
import { bind, placeLevel, type EventScope, type EventWorld } from './scope'

export interface EventCheck {
  kind?: string
  any_of?: readonly [string, string]
  dc?: number
  dc_offset?: number
  partial_allowed?: boolean
  situational?: readonly Modifier[]
}

const kindsOf = (c: EventCheck): [string] | [string, string] => (c.kind !== undefined ? [c.kind] : [c.any_of![0], c.any_of![1]])

export function eventCheckDc(w: EventWorld, rule: RuleContext, c: EventCheck, scope: EventScope, kind: string): number {
  return checkDc(rule, kind, { regionLevel: placeLevel(w, scope.place), dc: c.dc, dcOffset: c.dc_offset })
}

// partial_allowed는 종류 기본값을 끄는 용도로만 쓴다(16 §4.2)
export function partialOn(rule: RuleContext, c: EventCheck, kind: string): boolean {
  return c.partial_allowed !== false && partialAllowed(rule, kind, c.partial_allowed)
}

const situational = (c: EventCheck, scope: EventScope): Modifier[] =>
  (c.situational ?? []).map((m) => ({ ...m, target: bind(m.target, scope) }))

// 성공 확률 P = (21 − (DC − 보정 합)) / 20, 상하한 자름. 부분 성공이 허용되면 +0.10(10 §5.3)
export function eventSuccessChance(w: EventWorld, rule: RuleContext, c: EventCheck, scope: EventScope): number {
  const b = w.content.balance.check
  const sources = collectModSources(rule)
  let best: { kind: string; bonus: number } | undefined
  for (const kind of kindsOf(c)) {
    const cb = checkBonus(rule, kind, { situational: situational(c, scope) }, sources)
    if (!best || cb.bonus > best.bonus) best = { kind, bonus: cb.bonus }
  }
  const p = successChance(rule, eventCheckDc(w, rule, c, scope, best!.kind) - best!.bonus)
  return partialOn(rule, c, best!.kind) ? Math.min(b.success_p_clamp[1], p + b.partial_p_bonus) : p
}

// 미리 굴린 주사위로 판정한다(상태는 바꾸지 않는다)
export function rollEventCheck(w: EventWorld, rule: RuleContext, c: EventCheck, scope: EventScope, dice: number): CheckRoll {
  const roll = rollCheck(rule, w.rng.event, {
    kinds: kindsOf(c),
    dc: (kind) => eventCheckDc(w, rule, c, scope, kind),
    situational: situational(c, scope),
    dice,
  })
  const result = evaluateCheck(rule, dice, roll.record.total, roll.record.dc, partialOn(rule, c, roll.kind))
  return { ...roll, result, record: { ...roll.record, result } }
}
