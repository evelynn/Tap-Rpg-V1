// 사건 1회: 확정(선택지·미리 굴림) → 적용(판정 → 보상·손실 → 특성 → 플래그 → 기록 → 연출, 10 §9.1).
// 보류 대상이면 pending_choice를 만들고 시계를 멈춘다(10 §8). 확정 단계는 난수만 쓰고 상태를 바꾸지 않는다.
import { OUTCOME_KEYS, type Choice, type Effect, type Event, type Modifier } from '../schema/index'
import type { PendingChoice } from '../state/activity'
import type { CheckRecord } from '../state/journal'
import { addJournal } from '../journal/index'
import { miracleReroll, recordCheckUse } from '../rules/check'
import { consumeArmed, miracleJournal } from '../blessing/index'
import { characterOf, type ConditionTest } from '../rules/context'
import type { LevelUp } from '../rules/growth'
import { autoChoose } from './choice'
import { rollEventCheck } from './check'
import { makeConditionTest } from './conditions'
import { EVENT_TEXT, newEffectOutput, resultValues, runEffects, type EffectOutput, type EffectRun } from './effects'
import type { EventPorts } from './ports'
import { render, ruleContext, textValues, type EventScope, type EventWorld } from './scope'
import { fillContextVars } from './selectors'

const U32 = 0x100000000

// 확정된 사건 1회(저장 가능한 값만). choice_id null = 선택 대기
export interface EventOccurrence {
  event_id: string
  place: string
  vars: Record<string, string>
  choice_id: string | null
  reason: string | null
  by_policy: boolean
  dice: Record<string, number> // 선택지 id(판정) 또는 effect_path(roll_check) → d20
  chance: Record<string, number> // effect_path(chance) → 0~1
}

export interface EventResult {
  event_id: string
  choice_id: string | null // null = 선택 대기(시계 정지)
  outcome: string | null
  check: CheckRecord | null
  reason: string | null
  held: boolean
  addSec: number
  endSortie: string | null
  animations: EffectOutput['animations']
  levelUps: LevelUp[]
}

const isEffectArray = (v: unknown): v is Effect[] =>
  Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'object' && x !== null && typeof (x as Effect).type === 'string')

// 결과 키를 도는 순서는 record 삽입 순서가 아니라 등록 순서로 고정한다(미리 굴림 소비 순서를 저장이 재현한다)
const outcomesInOrder = (c: Choice): [string, Choice['outcomes'][keyof Choice['outcomes']]][] =>
  OUTCOME_KEYS.filter((k) => c.outcomes[k]).map((k) => [k, c.outcomes[k]])

// 효과 트리에 그 종류가 있는지
function hasEffectType(list: readonly Effect[], type: string): boolean {
  return list.some((e) => e.type === type || Object.values(e).some((v) => isEffectArray(v) && hasEffectType(v, type)))
}

const choiceHasEffect = (c: Choice, type: string) => outcomesInOrder(c).some(([, o]) => hasEffectType(o!.effects, type))

// 선택지 아래 미리 굴릴 효과(chance·roll_check)의 경로. runEffects와 같은 경로 형식(§4.7)
function rollPaths(c: Choice): { path: string; type: string }[] {
  const out: { path: string; type: string }[] = []
  const walk = (list: readonly Effect[], base: string) => list.forEach((e, i) => {
    const path = `${base}/${i}`
    if (e.type === 'chance' || e.type === 'roll_check') out.push({ path, type: e.type })
    for (const [k, v] of Object.entries(e)) if (isEffectArray(v)) walk(v, `${path}.${k}`)
  })
  for (const [key, o] of outcomesInOrder(c)) walk(o!.effects, `${c.id}/${key}`)
  return out
}

function scopeOf(w: EventWorld, occ: Pick<EventOccurrence, 'event_id' | 'place' | 'vars'>): EventScope {
  return { place: occ.place, vars: occ.vars, eventId: occ.event_id }
}

const visibleChoices = (ev: Event, test: ConditionTest, excluded: readonly string[] = []) =>
  ev.choices.filter((c) => !c.starlight && !excluded.includes(c.id) && (c.requires === undefined || test(c.requires)))

// 사전 방침(10 §8.4): 자동 전문화가 거절보다 우선. 중대 분기(branch)에는 방침을 적용하지 않는다
function policyChoice(w: EventWorld, ev: Event): string | null {
  const ph = ev.policy_hooks
  if (ev.hold !== 'fate' || !ph) return null
  const pol = w.state.policies
  if (ph.auto_specialization_map && pol.auto_specialization !== 'none') {
    let key: string = pol.auto_specialization
    if (key === 'higher_skill') {
      // 근접·탐색 단계 → 누적 사용 횟수 → 같으면 전투형(05 §8.4)
      const s = characterOf(ruleContext(w, () => false)).skills
      const d = s.melee.rank - s.search.rank || s.melee.uses - s.search.uses
      key = d >= 0 ? 'combat_first' : 'search_first'
    }
    const id = ph.auto_specialization_map[key]
    if (id) return id
  }
  return pol.fate_handling === 'decline_and_continue' && ph.decline_choice ? ph.decline_choice : null
}

export interface PrepareOptions {
  choiceId?: string // 선택지 고정(첫 출정 보장·시스템 사건 변형)
  reason?: string
}

// 확정: 변수 선택 → 선택지(방침·자동) → 판정 주사위·chance 미리 굴림(event 흐름). 상태는 바꾸지 않는다
export function prepareOccurrence(w: EventWorld, eventId: string, place: string, ports: EventPorts, opts: PrepareOptions = {}): EventOccurrence {
  const ev = w.content.get('event', eventId)
  const vars = fillContextVars(w, ev.context_vars ?? [], ports, makeConditionTest(w, { place, vars: {}, eventId }), place)
  const scope: EventScope = { place, vars, eventId }
  const test = makeConditionTest(w, scope)
  const visible = visibleChoices(ev, test)
  let choiceId: string | null = opts.choiceId ?? null
  let reason = opts.reason ?? null
  let byPolicy = false
  if (choiceId === null) {
    if (ev.hold !== 'none') {
      choiceId = policyChoice(w, ev)
      byPolicy = choiceId !== null
    } else if (ev.category === 'system') {
      if (visible.length !== 1) throw new Error(`시스템 사건 ${ev.id}: 열린 선택지가 ${visible.length}개다. choiceId로 변형을 고른다`)
      choiceId = visible[0]!.id
    } else {
      const auto = autoChoose(w, ruleContext(w, test), visible, scope)
      choiceId = auto.choiceId
      reason = auto.reason
    }
  }
  // 미리 굴릴 대상(13 §8.3 "행동 시작 때 결과를 확정한다"). 고른 선택지가 reopen_choices를 남기면
  // 다시 열릴 선택지도 적용 단계에서 굴리게 되므로 열린 선택지 전부를 여기서 굴린다
  const chosen = choiceId === null ? null : ev.choices.find((c) => c.id === choiceId)!
  const targets = chosen === null ? visible
    : choiceHasEffect(chosen, 'reopen_choices') ? [chosen, ...visible.filter((c) => c.id !== chosen.id)]
    : [chosen]
  const dice: Record<string, number> = {}
  const chance: Record<string, number> = {}
  for (const c of targets) if (c.check) dice[c.id] = w.rng.event.d20()
  for (const c of targets) {
    for (const p of rollPaths(c)) {
      if (p.type === 'roll_check') dice[p.path] = w.rng.event.d20()
      else chance[p.path] = w.rng.event.nextU32() / U32
    }
  }
  return { event_id: ev.id, place, vars, choice_id: choiceId, reason, by_policy: byPolicy, dice, chance }
}

function result(occ: EventOccurrence, over: Partial<EventResult>): EventResult {
  return {
    event_id: occ.event_id, choice_id: occ.choice_id, outcome: null, check: null, reason: occ.reason, held: false,
    addSec: 0, endSortie: null, animations: [], levelUps: [], ...over,
  }
}

// 선택 대기로 넘긴다: pending_choice(미리 굴린 값 포함) + 상태 awaiting_choice(시계 정지) + 대기 기록
function hold(w: EventWorld, occ: EventOccurrence): EventResult {
  const ev = w.content.get('event', occ.event_id)
  const b = w.content.balance
  const scope = scopeOf(w, occ)
  const test = makeConditionTest(w, scope)
  const vals = textValues(w, scope, holdValues(w, ev))
  const ca = w.state.current_activity
  const body = previewBody(ev, test, vals)
  const choices = visibleChoices(ev, test)
  const renderPreview = (p: NonNullable<Choice['preview']>) =>
    Object.fromEntries(Object.entries(p).map(([k, v]) => [k, typeof v === 'string' ? render(v, vals) : v]))
  w.state.pending_choice = {
    kind: ev.hold as PendingChoice['kind'],
    event_id: ev.id,
    presented_eff_min: characterOf(ruleContext(w, test)).eff_min,
    location: occ.place,
    choices_visible: choices.map((c) => c.id),
    excluded: [],
    pre_rolled: occ.dice,
    pre_chance: occ.chance,
    context: { vars: occ.vars, resume_state: ca.state },
    preview_rendered: {
      body,
      ...(ev.preview?.note !== undefined ? { note: render(ev.preview.note, vals) } : {}),
      // 별빛 길(10 §8.3)은 비추기 전에는 고를 수 없지만, 비춘 뒤 창에 보일 문구를 함께 만들어 둔다
      choices: Object.fromEntries([...choices, ...ev.choices.filter((c) => c.starlight && (c.requires === undefined || test(c.requires)))]
        .map((c) => [c.id, { label: render(c.label, vals), ...(c.preview ? renderPreview(c.preview) : {}) }])),
    },
  }
  ca.state = 'awaiting_choice'
  addJournal(w, {
    tag: 'important',
    line: render(ev.hold_line ?? b.events.default_hold_line, vals),
    ...(ev.intro.detail !== undefined ? { detail: render(ev.intro.detail, vals) } : {}),
    refs: { event_id: ev.id, location_id: occ.place },
  })
  const anim = ev.hold_animation ?? b.events.default_hold_animation
  return result(occ, { held: true, animations: [{ action: anim.action, ...(anim.props ? { props: anim.props } : {}) }] })
}

// 선택 창 문맥 값(16 §1.4.3): 전문화 창의 숙련 단계 {n}·{m}(05 §8.4 근접·탐색, policyChoice와 같은 두 숙련),
// 사건 효과를 적용한 뒤의 값 {luck_after}(life_stat_add 행운)·{sleep_age}(mutate, 아직 변이 전일 때)
function holdValues(w: EventWorld, ev: Event): Record<string, number> {
  const ch = characterOf(ruleContext(w, () => false))
  const out: Record<string, number> = {}
  if (ev.policy_hooks?.auto_specialization_map) {
    out.n = ch.skills.melee.rank
    out.m = ch.skills.search.rank
  }
  const effects: Effect[] = []
  const walk = (list: readonly Effect[]) => list.forEach((e) => {
    effects.push(e)
    for (const v of Object.values(e)) if (isEffectArray(v)) walk(v)
  })
  for (const c of ev.choices) for (const [, o] of outcomesInOrder(c)) walk(o!.effects)
  const luck = effects.find((e) => e.type === 'life_stat_add' && e.stat === 'luk') as { value: number; floor?: number } | undefined
  if (luck) out.luck_after = Math.max(luck.floor ?? 0, ch.stats.luk + luck.value)
  const mut = effects.find((e) => e.type === 'mutate') as { trait_id: string } | undefined
  const sleep = mut && w.content.get('trait', mut.trait_id).mutation?.sleep
  if (sleep && !ch.mutation) out.sleep_age = Math.min(sleep.cap, ch.retire_age + sleep.add_years)
  return out
}

// 선택 창 본문: 조건이 참인 변형을 after_paragraph번째 문단 뒤(없으면 끝)에 넣는다
function previewBody(ev: Event, test: ConditionTest, vals: Record<string, string | number>): string {
  const paras = render(ev.preview?.body ?? '', vals).split('\n\n')
  for (const v of ev.preview?.variants ?? []) {
    if (!test(v.when)) continue
    const at = Math.min(v.after_paragraph ?? paras.length, paras.length)
    paras.splice(at, 0, render(v.text, vals))
  }
  return paras.join('\n\n')
}


interface ResolveOpts {
  fromPending: boolean
  excluded: string[]
  situational: Modifier[]
}

// 선택지 1개를 판정·적용한다. 다시 열기(reopen_choices)면 보류 중에는 대기를 이어 가고, 자동이면 다시 고른다
function resolveChoice(w: EventWorld, occ: EventOccurrence, choiceId: string, ports: EventPorts, opts: ResolveOpts): EventResult {
  const { content } = w
  const b = content.balance
  const ev = content.get('event', occ.event_id)
  const scope = scopeOf(w, occ)
  const test = makeConditionTest(w, scope)
  const rule = ruleContext(w, test)
  const ch = characterOf(rule)
  const choice = ev.choices.find((c) => c.id === choiceId)
  if (!choice) throw new Error(`사건 ${ev.id}에 선택지 ${choiceId}가 없다`)

  // 1 판정 확정(미리 굴린 주사위)
  let key = 'always'
  let check: CheckRecord | null = null
  let rewardMult = 1
  const extra: Effect[] = []
  const o = choice.outcomes
  if (choice.check) {
    const spec = opts.situational.length ? { ...choice.check, situational: [...(choice.check.situational ?? []), ...opts.situational] } : choice.check
    let roll = rollEventCheck(w, rule, spec, scope, occ.dice[choice.id] ?? w.rng.event.d20())
    // 기적의 주사위(04 §10.3 6번): 연속·운명 사건 판정만
    if (b.blessing.miracle_event_categories.includes(ev.category)) {
      roll = miracleReroll(rule, w.rng.event, roll, roll.record.result === 'partial')
      if (roll.record.reroll && consumeArmed(rule, 'miracle')) addJournal(w, miracleJournal(rule, roll.record.reroll.first, roll.record.reroll.second))
    }
    recordCheckUse(rule, roll, { event: true }) // 판정 있는 선택지는 결과와 무관하게 숙련 사용(10 §6.2)
    check = roll.record
    const r = roll.result
    key = r === 'crit_success' ? (o.crit_success ? r : 'success')
      : r === 'crit_failure' ? (o.crit_failure ? r : 'failure')
      : r === 'partial' ? (o.partial ? r : 'failure')
      : r
    if (r === 'crit_success' && !o.crit_success) rewardMult = b.events.reward.crit_bonus_mult
    if (r === 'crit_failure' && !o.crit_failure) extra.push({ type: 'add_fatigue', value: b.events.reward.fumble_fatigue })
    if ((r === 'success' || r === 'crit_success') && !hasEffectType(o[key as 'success']!.effects, 'add_xp')) {
      extra.push({ type: 'add_xp', units: b.events.reward.check_success_xp_units })
    }
  } else if (choice.combat) {
    const res = ports.combat.fight(w, choice.combat, scope)
    key = o[res] ? res : 'defeat'
  }
  const outcome = o[key as 'always']!

  // 2~4 보상·손실 → 특성 → 플래그 (효과 목록 안에서 단계 순서)
  const run: EffectRun = { w, ports, scope, test, rule, pre: { dice: occ.dice, chance: occ.chance }, rewardMult, out: newEffectOutput() }
  runEffects(run, extra, `${choice.id}/${key}/+`)
  runEffects(run, outcome.effects, `${choice.id}/${key}`)

  // 5 기록: 상세(도입·변형·이유·결과) → 한 줄. 효과가 남긴 기록은 뒤에.
  // 특가 구매가 불발이면 결과 한 줄 대신 구매 불발 문장(11 L02: 자동 구매 조건을 넘지 못하면 그것으로 끝난다)
  const vals = textValues(w, scope, resultValues(w, run.out))
  const introIdx = ((ch.line_variant_last[ev.id] ?? -1) + 1) % ev.intro.lines.length
  ch.line_variant_last[ev.id] = introIdx
  const missed = run.out.offerMissed && !run.out.lastItemName
  const lines = missed ? content.get('text', EVENT_TEXT.noOffer).variants
    : outcome.line !== undefined ? [outcome.line, ...(outcome.line_variants ?? [])] : [ev.intro.lines[introIdx]!]
  const detail = [
    ev.intro.detail,
    ...(ev.intro.family_variants ?? []).filter((v) => test(v.when)).map((v) => v.detail_append),
  ].filter((x): x is string => !!x).map((t) => render(t, vals))
  if (occ.reason) detail.push(occ.reason)
  if (outcome.detail) detail.push(render(outcome.detail, vals))
  addJournal(w, {
    tag: outcome.tag ?? ev.intro.tag,
    line: render(lines[(ch.event_counts[ev.id] ?? 0) % lines.length]!, vals),
    ...(detail.length ? { detail: detail.join(' ') } : {}),
    ...(check ? { check } : {}),
    ...(occ.reason ? { reason: occ.reason } : {}),
    ...(choice.starlight ? { sub: 'blessing' as const } : {}), // 별빛 길의 결과(14 §5.1 가호 기록)
    refs: { event_id: ev.id, location_id: occ.place, ...(occ.by_policy ? { by_policy: true } : {}) },
  })
  for (const d of run.out.journal) addJournal(w, d)

  const out = result(occ, {
    choice_id: choice.id, outcome: key, check, addSec: run.out.addSec, endSortie: run.out.endSortie,
    animations: run.out.animations, levelUps: run.out.levelUps,
  })

  // 같은 창을 다시 연다(F03 사연 묻기)
  const reopen = run.out.reopen
  if (reopen) {
    const excluded = [...opts.excluded, ...reopen.exclude]
    const situational = [...opts.situational, ...reopen.situational]
    if (opts.fromPending) {
      const p = w.state.pending_choice!
      p.excluded = excluded
      p.context = { ...p.context, situational }
      return { ...out, held: true }
    }
    const rest = visibleChoices(ev, test, excluded)
    const auto = autoChoose(w, rule, rest, scope)
    const next = resolveChoice(w, { ...occ, reason: auto.reason }, auto.choiceId, ports, { fromPending: false, excluded, situational })
    return { ...next, addSec: next.addSec + out.addSec, endSortie: next.endSortie ?? out.endSortie, animations: [...out.animations, ...next.animations] }
  }

  finishEvent(w, ev, opts.fromPending)
  return out
}

// 사건 횟수·마지막 시점은 결과를 모두 적용한 뒤에 올린다(CONTENT_SCHEMA §5.10)
function finishEvent(w: EventWorld, ev: Event, fromPending: boolean): void {
  const s = w.state
  const ch = characterOf(ruleContext(w, () => false))
  ch.event_counts[ev.id] = (ch.event_counts[ev.id] ?? 0) + 1
  s.family.event_counts[ev.id] = (s.family.event_counts[ev.id] ?? 0) + 1
  ch.event_last_min[ev.id] = ch.eff_min
  s.family.codex.events[ev.id] ??= { first_gen: s.family.generation }
  if (ev.category === 'life') {
    ch.recent_life_events = [...ch.recent_life_events, ev.id].slice(-w.content.balance.events.diversity.recent_window)
    const sortie = s.current_activity.sortie
    if (sortie) sortie.events_this_sortie += 1
  }
  if (fromPending) {
    const resume = s.pending_choice?.context.resume_state
    s.pending_choice = null
    s.current_activity.state = (typeof resume === 'string' ? resume : 'town_idle') as typeof s.current_activity.state
  }
}

// 확정한 사건을 적용한다. 선택지가 정해지지 않았으면 선택 대기로 넘긴다
export function applyOccurrence(w: EventWorld, occ: EventOccurrence, ports: EventPorts): EventResult {
  if (occ.choice_id === null) return hold(w, occ)
  return resolveChoice(w, occ, occ.choice_id, ports, { fromPending: false, excluded: [], situational: [] })
}

// 사용자가 선택 대기 중인 사건의 선택지를 고른다. 미리 굴린 주사위·확률을 쓴다(다시 굴리지 않음)
export function submitChoice(w: EventWorld, choiceId: string, ports: EventPorts): EventResult {
  const p = w.state.pending_choice
  if (!p) throw new Error('선택 대기 중인 사건이 없다')
  if (!p.choices_visible.includes(choiceId) || p.excluded.includes(choiceId)) throw new Error(`고를 수 없는 선택지: ${choiceId}`)
  const vars = (p.context.vars ?? {}) as Record<string, string>
  const occ: EventOccurrence = {
    event_id: p.event_id, place: p.location, vars, choice_id: choiceId, reason: null, by_policy: false, dice: p.pre_rolled, chance: p.pre_chance,
  }
  const situational = (p.context.situational ?? []) as Modifier[]
  return resolveChoice(w, occ, choiceId, ports, { fromPending: true, excluded: [...p.excluded], situational })
}

export interface RunEventOptions extends PrepareOptions {
  place: string
  force?: boolean // condition도 보지 않는다
}

// 판단 지점 밖에서 사건 1회(예약 사건·시스템 사건·후손 반응 장면). 예약 사건은 condition만 본다(CONTENT_SCHEMA §5.10)
export function runEvent(w: EventWorld, eventId: string, opts: RunEventOptions, ports: EventPorts): EventResult | null {
  const ev = w.content.get('event', eventId)
  if (!opts.force && !makeConditionTest(w, { place: opts.place, vars: {}, eventId })(ev.condition)) return null
  return applyOccurrence(w, prepareOccurrence(w, eventId, opts.place, ports, opts), ports)
}
