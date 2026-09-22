// 미룬 처리: 예약 사건(schedule_event)과 마을 도착 효과(on_town_return).
import type { Effect } from '../schema/index'
import { addJournal } from '../journal/index'
import { characterOf } from '../rules/context'
import { makeConditionTest } from './conditions'
import { newEffectOutput, runEffects, type EffectOutput, type EffectRun } from './effects'
import { runEvent, type EventResult } from './occur'
import type { EventPorts } from './ports'
import { render, ruleContext, textValues, type EventScope, type EventWorld } from './scope'

// 예약된 사건을 발화한다(발화 때 condition만 본다). at eff_min은 시각이 지난 것만
export function fireScheduledEvents(
  w: EventWorld,
  at: 'next_town_return' | 'next_camp' | 'eff_min',
  place: string,
  ports: EventPorts,
): EventResult[] {
  const ch = characterOf(ruleContext(w, () => false))
  const due = ch.scheduled_events.filter((s) => s.at === at && (at !== 'eff_min' || (s.due_eff_min ?? 0) <= ch.eff_min))
  if (!due.length) return []
  ch.scheduled_events = ch.scheduled_events.filter((s) => !due.includes(s))
  const out: EventResult[] = []
  for (const s of due) {
    const r = runEvent(w, s.event_id, { place }, ports)
    if (r) out.push(r)
  }
  return out
}

// 마을에 도착했을 때 밀린 효과를 적용한다. 효과는 사건이 일어난 장소·변수 문맥으로 적용한다
export function runTownReturnEffects(w: EventWorld, ports: EventPorts): EffectOutput {
  const ca = w.state.current_activity
  const queued = ca.pending_town_effects
  ca.pending_town_effects = []
  const out = newEffectOutput()
  for (const q of queued as unknown as { effects: Effect[]; line?: string; place: string | null; vars: Record<string, string>; event_id: string | null }[]) {
    const scope: EventScope = { place: q.place, vars: q.vars ?? {}, ...(q.event_id ? { eventId: q.event_id } : {}) }
    const test = makeConditionTest(w, scope)
    const run: EffectRun = { w, ports, scope, test, rule: ruleContext(w, test), pre: { dice: {}, chance: {} }, rewardMult: 1, out }
    runEffects(run, q.effects, `${q.event_id ?? 'town'}/on_town_return`)
    if (q.line) addJournal(w, { tag: 'town', line: render(q.line, textValues(w, scope)), refs: q.event_id ? { event_id: q.event_id } : {} })
  }
  for (const d of out.journal) addJournal(w, d)
  out.journal = []
  return out
}
