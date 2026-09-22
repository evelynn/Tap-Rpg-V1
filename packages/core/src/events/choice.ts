// 자동 선택(10 §5): 태도 선호 점수 + 위험 보정 + 성공 보정 + 특성 보정, 위험 한도, 이유 문장 5형.
// 태도 점수·보정값은 attitude 데이터(tag_scores·medium_risk_penalty·low_success_penalty), 문형은 balance.choice_ai에서 읽는다.
import type { Choice } from '../schema/index'
import { ACTIVITY_RISKS, CHOICE_RISKS } from '../schema/index'
import type { RuleContext } from '../rules/context'
import { characterOf } from '../rules/context'
import { eventSuccessChance } from './check'
import { activeTraitIds } from './conditions'
import { render, type EventScope, type EventWorld } from './scope'

export type ReasonKind = 'attitude' | 'trait_changed' | 'trait_confirmed' | 'risk_blocked' | 'no_option'

export interface ChoiceScore {
  id: string
  base: number // 특성 보정을 뺀 점수
  trait: number // 특성 보정 합
  score: number
  p: number | null // 판정 성공 확률(판정 없으면 null)
  allowed: boolean // 위험 한도 안
}

export interface AutoChoice {
  choiceId: string
  reasonKind: ReasonKind
  reason: string
  scores: ChoiceScore[]
}

// 위험 허용 상한(01 §7.1·§18.2): 방침이 태도 기본값이면 태도의 max_risk(모험 활동 중이면 max_risk_adventure)
export function riskCap(w: EventWorld): (typeof ACTIVITY_RISKS)[number] {
  const { state, content } = w
  if (state.policies.risk_cap !== 'attitude_default') return state.policies.risk_cap
  const att = content.get('attitude', state.policies.attitude)
  return (state.current_activity.sortie?.activity === 'adventure' ? att.max_risk_adventure : null) ?? att.max_risk
}

// 치명 선택지는 자동으로 고르지 않는다(10 §5.4)
function riskAllowed(w: EventWorld, risk: Choice['risk']): boolean {
  if (risk === 'lethal') return false
  const grade = w.content.balance.choice_ai.risk_map[risk]
  return ACTIVITY_RISKS.indexOf(grade) <= ACTIVITY_RISKS.indexOf(riskCap(w))
}

// 특성 보정: 보유 특성 ai_hooks.choice_tag_bonus를 선택지 태그마다 더한다. 특성별 기여도 함께
function traitBonus(w: EventWorld, rule: RuleContext, c: Choice): { total: number; by: [string, number][] } {
  const by: [string, number][] = []
  for (const id of activeTraitIds(characterOf(rule))) {
    const bonus = w.content.get('trait', id).ai_hooks?.choice_tag_bonus as Partial<Record<string, number>> | undefined
    const v = (c.tags ?? []).reduce((s, t) => s + (bonus?.[t] ?? 0), 0)
    if (v) by.push([id, v])
  }
  return { total: by.reduce((s, [, v]) => s + v, 0), by }
}

export function scoreChoice(w: EventWorld, rule: RuleContext, c: Choice, scope: EventScope): ChoiceScore {
  const att = w.content.get('attitude', w.state.policies.attitude)
  const p = c.check ? eventSuccessChance(w, rule, c.check, scope) : null
  let base = (c.tags ?? []).reduce((s, t) => s + (att.tag_scores[t] ?? 0), 0)
  if (c.risk === 'medium') base += att.medium_risk_penalty
  if (p !== null && p < w.content.balance.choice_ai.low_success_p) base += att.low_success_penalty
  const trait = traitBonus(w, rule, c).total
  return { id: c.id, base, trait, score: base + trait, p, allowed: riskAllowed(w, c.risk) }
}

// 가장 높은 점수, 같으면 사건 정의에 먼저 적힌 선택지
function best(list: readonly ChoiceScore[], key: 'score' | 'base'): ChoiceScore | undefined {
  return list.reduce<ChoiceScore | undefined>((a, b) => (!a || b[key] > a[key] ? b : a), undefined)
}

// visible = 보이는 선택지(requires 참, 제외 목록 밖), 사건 정의 순서
export function autoChoose(w: EventWorld, rule: RuleContext, visible: readonly Choice[], scope: EventScope): AutoChoice {
  if (!visible.length) throw new Error('자동 선택: 보이는 선택지가 없다')
  const ai = w.content.balance.choice_ai
  const att = w.content.get('attitude', w.state.policies.attitude)
  const scores = visible.map((c) => scoreChoice(w, rule, c, scope))
  const allowed = scores.filter((s) => s.allowed)
  const byId = (id: string) => visible.find((c) => c.id === id)!
  let chosen: ChoiceScore
  let kind: ReasonKind
  const vals: Record<string, string | number> = { attitude: att.reason_label }
  if (!allowed.length) {
    // 모두 빠지면 가장 위험이 낮은 선택지
    chosen = scores.reduce((a, b) => (CHOICE_RISKS.indexOf(byId(b.id).risk) < CHOICE_RISKS.indexOf(byId(a.id).risk) ? b : a))
    kind = 'no_option'
  } else {
    chosen = best(allowed, 'score')!
    const noTrait = best(allowed, 'base')!
    // 기여가 가장 큰 특성(선택지 하나에 대해)
    const topTrait = (id: string) =>
      traitBonus(w, rule, byId(id)).by.reduce<[string, number] | undefined>((a, b) => (!a || Math.abs(b[1]) > Math.abs(a[1]) ? b : a), undefined)
    const tb = traitBonus(w, rule, byId(chosen.id))
    const top = topTrait(chosen.id)
    if (best(scores, 'score')!.id !== chosen.id) kind = 'risk_blocked'
    else if (noTrait.id !== chosen.id) {
      // 고른 쪽을 올렸거나, 특성 없이 1순위였던 쪽을 내린 특성
      const t = (top ?? topTrait(noTrait.id))![0]
      kind = 'trait_changed'
      vals.trait_reason = w.content.get('trait', t).reason_phrase ?? w.content.get('trait', t).name
    } else if (top && tb.total >= ai.trait_confirm_min_bonus) {
      kind = 'trait_confirmed'
      vals.trait_name = w.content.get('trait', top[0]).name
    } else kind = 'attitude'
  }
  vals.choice_short = byId(chosen.id).short ?? byId(chosen.id).label
  return { choiceId: chosen.id, reasonKind: kind, reason: render(ai.reason_lines[kind], vals), scores }
}
