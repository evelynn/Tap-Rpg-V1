// 시스템 사건(S01~S08) 발화. 원문과 변형은 11이 소유하고(콘텐츠), 여기서는 언제·어느 변형을 쓸지만 정한다.
// 코어는 사건 ID를 문자열로 쓰지 않는다(I04): 단계(system.phase)와 조건으로 찾고, 변형은 데이터로 고른다.
import type { Condition, Event } from '../schema/index'
import { makeConditionTest } from '../events/conditions'
import { applyOccurrence, prepareOccurrence, type EventResult } from '../events/occur'
import type { EventPorts } from '../events/ports'
import { ruleContext, type EventScope, type EventWorld } from '../events/scope'
import { characterOf } from '../rules/context'
import { ageAt } from '../time/index'
import { pickRetireRole } from './retire'
import { atThirstLimit, type LongSleepCause } from './vampire'
import type { EndKind } from './retire'

export type SystemPhase = 'judgment' | 'town_routine_family' | 'life_end' | 'succession'

const scopeOf = (place: string, lifeEnd?: EventScope['lifeEnd']): EventScope =>
  ({ place, vars: {}, ...(lifeEnd ? { lifeEnd } : {}) })

// 같은 단계의 시스템 사건을 system.order 순으로, condition이 참인 것만(10 §3.3).
// select.ts의 systemEventCandidates와 달리 생애 종료 문맥(life_end_kind·died_at)을 넘길 수 있다
export function systemEvents(w: EventWorld, phase: SystemPhase, place: string, lifeEnd?: EventScope['lifeEnd']): Event[] {
  const test = makeConditionTest(w, scopeOf(place, lifeEnd))
  return w.content
    .list('event')
    .filter((e) => e.category === 'system' && e.system?.phase === phase && test(e.condition))
    .sort((a, b) => a.system!.order - b.system!.order)
}

export function visibleChoiceIds(ev: Event, test: (c: Condition) => boolean): string[] {
  return ev.choices.filter((c) => c.requires === undefined || test(c.requires)).map((c) => c.id)
}

export interface FireOptions {
  choiceId?: string
  vars?: Record<string, string> // 사건 문장이 쓰는 변수(사망 원인 줄, 후계자 이름 등)
  lifeEnd?: EventScope['lifeEnd']
  reason?: string
}

// 시스템 사건 1회를 발화한다. condition은 부르는 쪽이 이미 봤다고 보고 force로 넘긴다
export function fireSystemEvent(w: EventWorld, eventId: string, place: string, ports: EventPorts, opts: FireOptions = {}): EventResult {
  const occ = prepareOccurrence(w, eventId, place, ports, {
    ...(opts.choiceId !== undefined ? { choiceId: opts.choiceId } : {}),
    ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
  })
  const vars = { ...occ.vars, ...(opts.vars ?? {}) }
  return applyOccurrence(w, { ...occ, vars }, ports)
}

// ── 생애 종료 사건(S03 은퇴 / S04 사망 / S08 긴 잠) ──

export interface LifeEndFire {
  kind: EndKind
  place: string
  cause?: 'age' | LongSleepCause
  roleId?: string // 은퇴 역할(S03 변형)
  vars?: Record<string, string>
}

// 생애 종료 단계 사건 1개를 고른다. 종류별로 조건이 갈라져 후보는 하나다
export function lifeEndEvent(w: EventWorld, f: LifeEndFire): Event | null {
  const lifeEnd = { kind: f.kind, place: f.place }
  return systemEvents(w, 'life_end', f.place, lifeEnd)[0] ?? null
}

// 변형(선택지) 고르기.
// - 은퇴: retire_role id가 곧 선택지 id다(S03 계약). 서술만 바꾸는 fallback은 fallback_name이 이름인 선택지
// - 사망: died_at 조건이 갈라 하나만 보인다
// - 긴 잠: 갈증 한계면 조건이 갈라 하나, 그 밖에는 자발적 은둔이 마지막 변형이다(09 §7.6, 데이터에 가르는 조건 없음)
export function lifeEndChoice(w: EventWorld, ev: Event, f: LifeEndFire): string {
  const test = makeConditionTest(w, scopeOf(f.place, { kind: f.kind, place: f.place }))
  const visible = visibleChoiceIds(ev, test)
  if (f.kind === 'retired') {
    const pick = f.roleId !== undefined
      ? { id: f.roleId, name: w.content.get('retire_role', f.roleId).name, fallback: false }
      : pickRetireRole(ruleContext(w, test))
    if (!('fallback' in pick) || !pick.fallback) return pick.id
    const def = w.content.get('retire_role', pick.id)
    return ev.choices.find((c) => c.label === def.fallback_name)?.id ?? pick.id
  }
  if (visible.length === 1) return visible[0]!
  if (f.kind === 'long_sleep') {
    if (atThirstLimit(ruleContext(w, test))) return visible[0]!
    return f.cause === 'voluntary' ? visible.at(-1)! : visible[0]!
  }
  if (!visible.length) throw new Error(`생애 종료 사건 ${ev.id}에 보이는 변형이 없다`)
  return visible[0]!
}

// 생애 종료 사건을 발화한다. 인물이 아직 있어야 한다(기록이 그 인물에 붙는다)
export function fireLifeEnd(w: EventWorld, f: LifeEndFire, ports: EventPorts): EventResult | null {
  const ev = lifeEndEvent(w, f)
  if (!ev) return null
  return fireSystemEvent(w, ev.id, f.place, ports, {
    choiceId: lifeEndChoice(w, ev, f),
    lifeEnd: { kind: f.kind, place: f.place },
    ...(f.vars ? { vars: f.vars } : {}),
  })
}

// ── 마을 귀환 가족 사건(S01·S02·S07)과 계승 사건(S05) ──

// 12 §2.1 서술 형태 추첨(배우자 50 / 동반자 30 / 공동 양육 20). 형태 키가 곧 선택지 id다
export function pickFamilyForm(w: EventWorld): string {
  const forms = w.content.balance.inheritance.family_forms
  const keys = Object.keys(forms).sort()
  const i = w.rng.life.weightedIndex(keys.map((k) => forms[k as 'spouse']))
  return keys[i]!
}

// 가족 사건 변형: 형태 추첨이 필요한 사건(S01)만 값을 돌려주고, 나머지는 보이는 선택지 하나를 쓴다
export function familyChoice(w: EventWorld, ev: Event, place: string): string {
  const test = makeConditionTest(w, scopeOf(place))
  const visible = visibleChoiceIds(ev, test)
  if (visible.length === 1) return visible[0]!
  const form = pickFamilyForm(w)
  if (visible.includes(form)) return form
  return visible[0]!
}

// S07 편지 변형: 마무리 편지는 final로 시작하는 변형, 일반 편지는 그 밖에서 life 흐름으로 고른다.
// 변형 id에 가르는 조건이 없어 이름으로 나눈다(11 S07 _note가 "엔진이 고른다"로 남긴 자리)
const FINAL_PREFIX = 'final'

export function letterChoice(w: EventWorld, ev: Event, place: string, kind: 'regular' | 'final'): string | null {
  const test = makeConditionTest(w, scopeOf(place))
  const visible = visibleChoiceIds(ev, test)
  const finals = visible.filter((id) => id.startsWith(FINAL_PREFIX))
  const pool = kind === 'final' ? finals : visible.filter((id) => !finals.includes(id))
  if (!pool.length) return null
  return pool[w.rng.life.bounded(pool.length)]!
}

// 계승 5단계 출발 사건(S05). 후계자가 이미 현재 인물이어야 한다
export function fireSuccession(w: EventWorld, place: string, ports: EventPorts, vars: Record<string, string>): EventResult | null {
  const ev = systemEvents(w, 'succession', place)[0]
  if (!ev) return null
  const test = makeConditionTest(w, scopeOf(place))
  const visible = visibleChoiceIds(ev, test)
  return fireSystemEvent(w, ev.id, place, ports, { ...(visible[0] !== undefined ? { choiceId: visible[0] } : {}), vars })
}

// 인물의 나이(사건 조건이 쓰는 값과 같은 계산)
export function ageOf(w: EventWorld): number {
  return ageAt(characterOf(ruleContext(w, () => false)).eff_min, w.content.balance.time)
}
