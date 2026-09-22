// 사건 선택기(10 §3~§4): 판단 지점별 검사 → 후보 필터 → 처리 순서(운명 → 연속 → 생활) → 가중 선택.
// 확정(resolve)은 난수만 쓰고, 적용(apply)이 상태를 바꾼다(13 §8.3 행동 골격과 같은 규약).
import { chainDoneKey, type Event, type EVENT_TRIGGERS } from '../schema/index'
import { characterOf, type ConditionTest } from '../rules/context'
import { effectiveStat } from '../rules/derived'
import { modFlag } from '../rules/modifiers'
import { weightedPick } from '../rules/random'
import { ageAt, lifeStageAt, seasonAt } from '../time/index'
import { applyChainResume, chainResumes, type ChainResume } from './chains'
import { activeTraitIds, makeConditionTest, stageBoundaries, TOWN_RETURN_AGE_KEY } from './conditions'
import { deferRankKey } from './effects'
import { applyOccurrence, prepareOccurrence, type EventOccurrence, type EventResult } from './occur'
import type { EventPorts } from './ports'
import { emptyScope, eventPlaceMatch, render, ruleContext, textValues, type EventWorld } from './scope'

export type JudgmentTrigger = Exclude<(typeof EVENT_TRIGGERS)[number], 'system'>

export interface JudgmentPoint {
  trigger: JudgmentTrigger
  place: string
  encounter?: number // 이번 출정에서 끝난 조우 번호(첫 출정 보장 10 §3.4)
}

// 확정 결과: 상태를 바꾸지 않고 담아 둔다(저장 가능한 값만)
export interface JudgmentResolution {
  point: JudgmentPoint
  occurrence: EventOccurrence | null
  fate: boolean // 운명 사건 등장(출정당 1회)
  pity: Record<string, number> // 사건별 연속 미등장 횟수(0이면 지움)
  exclusive: string | null // "그룹=사건 id"(이번 출정 동안 그 그룹은 이 사건만)
  resumes: ChainResume[]
}

const empty = (point: JudgmentPoint): JudgmentResolution =>
  ({ point, occurrence: null, fate: false, pity: {}, exclusive: null, resumes: [] })

// 특성·발견 지점의 사건 가중 배수(10 §4.2, CONTENT_SCHEMA §5.10)
function eventMult(w: EventWorld, eventId: string): number {
  const ch = characterOf(ruleContext(w, () => false))
  let mult = 1
  for (const id of activeTraitIds(ch)) {
    mult *= (w.content.get('trait', id).ai_hooks?.event_weight_mult as Record<string, number> | undefined)?.[eventId] ?? 1
  }
  for (const r of w.content.list('region')) {
    if (r.kind !== 'adventure_route') continue
    for (const d of r.discoveries) if (ch.discoveries.includes(d.id)) mult *= d.event_weight_mult?.[eventId] ?? 1
  }
  return mult
}

// 후보가 된 뒤의 등장 확률(운명 사건과 check_override 사건). 시스템 사건 확률(S02 8%)도 이 값을 쓴다
export function eventAppearChance(w: EventWorld, ev: Event, test: ConditionTest): number {
  if (ev.check_override !== undefined) return ev.check_override
  if (ev.appear_chance === undefined) return 1
  const b = w.content.balance
  let p = ev.appear_chance
  if (ev.luck_scaled) p *= 1 + b.stats.luck.fortune_per_point * effectiveStat(ruleContext(w, test), 'luk')
  return Math.min(b.events.fortune_cap, p * eventMult(w, ev.id))
}

// 판단 지점 검사 확률(10 §3.1). 사냥 조우 뒤는 사냥터별 event_check
function triggerChance(w: EventWorld, point: JudgmentPoint): number {
  const r = w.content.get('region', point.place)
  if (point.trigger === 'after_encounter') return r.kind === 'hunting_ground' ? r.event_check : 0
  return w.content.balance.events.trigger_chance[point.trigger] ?? 0
}

// 변이가 판단 지점을 통째로 막는가(흡혈귀 낮 야영 등, 5.6 blocked_triggers)
function blockedTrigger(w: EventWorld, point: JudgmentPoint, test: ConditionTest): boolean {
  const ch = characterOf(ruleContext(w, test))
  if (!ch.mutation) return false
  const m = w.content.get('trait', ch.mutation.trait_id).mutation
  return (m?.blocked_triggers ?? []).some((b) => b.trigger === point.trigger && test(b.when))
}

// 후보 필터(10 §4.1)
function eligible(w: EventWorld, ev: Event, point: JudgmentPoint, test: ConditionTest): boolean {
  const { content, state } = w
  const b = content.balance
  const rule = ruleContext(w, test)
  const ch = characterOf(rule)
  const sortie = state.current_activity.sortie
  if (eventPlaceMatch(content, ev, point.place) === false) return false
  const age = ageAt(ch.eff_min, b.time)
  if (ev.life_stages && !ev.life_stages.includes(lifeStageAt(age, stageBoundaries({ w })))) return false
  if (ev.seasons && !ev.seasons.includes(seasonAt(ch.eff_min, ch.birth_season, b.time))) return false
  if (ev.time_of_day && (sortie?.time_of_day ?? ch.last_trip_time) !== ev.time_of_day) return false
  if (!ev.allow_serious_injury && ch.injuries.some((i) => i.grade === 'serious')) return false
  if (ev.blocked_during_aid && ch.guild_aid.active) return false
  if (point.trigger === 'camp' && ev.tags?.includes('raid') && modFlag(rule, 'camp_raid_immunity')) return false
  const count = ch.event_counts[ev.id] ?? 0
  if (ev.max_per_life !== undefined && count >= ev.max_per_life) return false
  if (ev.max_per_family !== undefined && (state.family.event_counts[ev.id] ?? 0) >= ev.max_per_family) return false
  const last = ch.event_last_min[ev.id]
  if (last !== undefined) {
    if (ev.cooldown_min !== undefined && ch.eff_min - last < ev.cooldown_min) return false
    if (ev.cooldown_per_season && Math.floor(last / b.time.season_min) === Math.floor(ch.eff_min / b.time.season_min)) return false
  }
  if (ev.chain) {
    const chain = content.get('chain', ev.chain.id)
    if (chain.family_once && state.family.flags[chainDoneKey(chain.id)]) return false
    // 노년기에는 새 줄기를 시작하지 않는다(09 §1.2, balance.life_stage_rules)
    const stageRule = b.life_stage_rules[lifeStageAt(age, stageBoundaries({ w }))]
    if (ev.chain.stage === 1 && stageRule?.chain_start === false) return false
  }
  const ph = ev.policy_hooks
  if (ph?.max_presentations !== undefined && count >= ph.max_presentations) return false
  // 거절 뒤 재제시: 레벨 +N 또는 지정 숙련의 새 단계(05 §8.3)
  if (ph?.represent_after && count > 0) {
    const ra = ph.represent_after
    const grown = ch.spec_deferred_until_level !== null && ch.level >= ch.spec_deferred_until_level
    const ranked = ra.skill_rank_up.some((s) => ch.skills[s].rank > (ch.counters[deferRankKey(s)] ?? 0))
    if (!grown && !ranked) return false
  }
  return test(ev.condition)
}

// 생활 사건의 가중치(10 §4.2)
function lifeWeight(w: EventWorld, ev: Event, point: JudgmentPoint, test: ConditionTest, samePlaceHeavy: boolean): number {
  const b = w.content.balance
  const ch = characterOf(ruleContext(w, test))
  let weight = ev.weight ?? 1
  for (const m of ev.weight_mods ?? []) if (test(m.when)) weight *= m.mult
  weight *= eventMult(w, ev.id)
  const stageRule = b.life_stage_rules[lifeStageAt(ageAt(ch.eff_min, b.time), stageBoundaries({ w }))]
  weight *= stageRule?.event_journal_tag_mult?.[ev.intro.tag] ?? 1
  if (samePlaceHeavy && eventPlaceMatch(w.content, ev, point.place) === true) weight *= b.events.diversity.same_place_mult
  return weight
}

// 판단 지점 1회를 확정한다. 상태는 바꾸지 않는다(난수만 쓴다)
export function resolveJudgment(w: EventWorld, point: JudgmentPoint, ports: EventPorts): JudgmentResolution {
  const { content, state } = w
  const b = content.balance
  const res = empty(point)
  if (state.pending_choice) return res // 선택 대기 중에는 아무 사건도 검사하지 않는다(10 §8.2)
  const scope = emptyScope(point.place)
  const test = makeConditionTest(w, scope)
  const ch = characterOf(ruleContext(w, test))
  const sortie = state.current_activity.sortie
  res.resumes = chainResumes(w, test)

  // 첫 출정 보장(10 §3.4): 검사 확률·계절·밀도 제한을 무시한다
  const g = b.first_sortie.guaranteed_event
  if (point.trigger === 'after_encounter' && point.encounter === g.after_encounter && test(g.when)) {
    res.occurrence = prepareOccurrence(w, g.event, point.place, ports, {
      choiceId: g.choice,
      reason: render(g.reason, textValues(w, scope)),
    })
    return res
  }
  if (blockedTrigger(w, point, test)) return res

  const cands = content.list('event').filter((e) => e.category !== 'system' && e.triggers.includes(point.trigger) && eligible(w, e, point, test))
  const pick = (ev: Event) => {
    res.occurrence = prepareOccurrence(w, ev.id, point.place, ports)
  }

  // 1 운명 사건: 출정당 1회, 배타 그룹은 1:1 추첨으로 하나만 남긴다(10 §4.3)
  let fates = sortie?.fate_offered ? [] : cands.filter((e) => e.category === 'fate')
  for (const group of new Set(fates.map((e) => e.exclusive_group).filter((g2): g2 is string => !!g2))) {
    const members = fates.filter((e) => e.exclusive_group === group)
    const locked = sortie?.exclusive_used.find((x) => x.startsWith(`${group}=`))?.slice(group.length + 1)
    let keep = locked ? members.find((m) => m.id === locked) : undefined
    if (!locked && members.length > 1) {
      keep = members[weightedPick(w.rng.event, members.map((m) => m.weight ?? 1))]!
      res.exclusive = `${group}=${keep.id}`
    }
    if (members.length > 1 || locked) fates = fates.filter((e) => e.exclusive_group !== group || e.id === keep?.id)
  }
  for (const ev of fates) {
    const pity = (ch.event_pity[ev.id] ?? 0) + 1
    const forced = ev.pity_after !== undefined && pity >= ev.pity_after
    const hit = w.rng.event.chance(eventAppearChance(w, ev, test))
    if (forced || hit) {
      res.fate = true
      res.pity[ev.id] = 0
      pick(ev)
      return res
    }
    if (ev.pity_after !== undefined) res.pity[ev.id] = pity
  }

  // 2 연속 사건 우선 검사(10 §3.1 D41). 실패한 줄기는 이번 판단 지점의 후보에서 빠진다
  for (const ev of cands.filter((e) => e.category === 'chain')) {
    const p = point.trigger === 'town_return' ? b.events.chain_town_stage_chance : b.events.chain_priority_chance
    if (w.rng.event.chance(p)) {
      pick(ev)
      return res
    }
  }

  // 3 생활 사건: 밀도 제한(10 §3.2) → 다양성 → 검사 확률 → 가중 선택
  const lastLife = ch.recent_life_events.at(-1)
  const lastMin = lastLife !== undefined ? ch.event_last_min[lastLife] : undefined
  if (lastMin !== undefined && (ch.eff_min - lastMin) * 60 < b.events.min_gap_sec) return res
  if (sortie && sortie.events_this_sortie >= b.events.max_life_per_sortie) return res
  const recent = ch.recent_life_events.slice(-b.events.diversity.recent_window)
  const life = cands.filter((e) => e.category === 'life' && !recent.includes(e.id))
  const samePlaceHeavy = recent.filter((id) => content.has('event', id) && eventPlaceMatch(content, content.get('event', id), point.place) === true)
    .length >= b.events.diversity.same_place_threshold

  // 제 확률을 가진 사건(check_override·pity)을 먼저 본다
  for (const ev of life.filter((e) => e.check_override !== undefined || e.pity_after !== undefined)) {
    const pity = (ch.event_pity[ev.id] ?? 0) + 1
    const forced = ev.pity_after !== undefined && pity >= ev.pity_after
    const hit = w.rng.event.chance(eventAppearChance(w, ev, test))
    if (forced || hit) {
      res.pity[ev.id] = 0
      pick(ev)
      return res
    }
    if (ev.pity_after !== undefined) res.pity[ev.id] = pity
  }
  const rest = life.filter((e) => e.check_override === undefined && e.pity_after === undefined)
  if (!rest.length) return res
  if (!w.rng.event.chance(triggerChance(w, point))) return res
  const weights = rest.map((e) => lifeWeight(w, e, point, test, samePlaceHeavy))
  if (weights.every((x) => x <= 0)) return res
  pick(rest[weightedPick(w.rng.event, weights)]!)
  return res
}

// 확정 결과를 적용한다(기록·플래그·사건 결과). 사건이 없어도 집계는 남긴다
export function applyJudgment(w: EventWorld, res: JudgmentResolution, ports: EventPorts): EventResult | null {
  const ch = characterOf(ruleContext(w, () => false))
  for (const r of res.resumes) applyChainResume(w, r)
  for (const [id, n] of Object.entries(res.pity)) {
    if (n === 0) delete ch.event_pity[id]
    else ch.event_pity[id] = n
  }
  const sortie = w.state.current_activity.sortie
  if (res.exclusive && sortie && !sortie.exclusive_used.includes(res.exclusive)) sortie.exclusive_used.push(res.exclusive)
  if (res.fate && sortie) sortie.fate_offered = true
  let out: EventResult | null = null
  if (res.occurrence) {
    const ev = w.content.get('event', res.occurrence.event_id)
    if (ev.policy_hooks?.max_presentations !== undefined) ch.f01_presentations += 1
    out = applyOccurrence(w, res.occurrence, ports)
  }
  // specific_age 기준 나이(직전 마을 귀환)
  if (res.point.trigger === 'town_return') ch.counters[TOWN_RETURN_AGE_KEY] = ageAt(ch.eff_min, w.content.balance.time)
  return out
}

// 판단 지점 1회를 확정하고 바로 적용한다
export function runJudgment(w: EventWorld, point: JudgmentPoint, ports: EventPorts): EventResult | null {
  return applyJudgment(w, resolveJudgment(w, point, ports), ports)
}

// 시스템 사건 판정 순서(10 §3.3): 같은 단계(phase)의 사건을 system.order 순으로, condition이 참인 것만.
// 소유: 아직 부르는 쪽이 없다. 생애 규칙(T10)이 이 목록을 받아 eventAppearChance·runEvent로 발화한다
// (sim/services.ts의 deferred와 같은 취급 — 죽은 코드가 아니라 다음 담당자에게 넘기는 자리다)
export function systemEventCandidates(w: EventWorld, phase: string, place: string): Event[] {
  const test = makeConditionTest(w, emptyScope(place))
  return w.content.list('event')
    .filter((e) => e.category === 'system' && e.system?.phase === phase && test(e.condition))
    .sort((a, b) => (a.system!.order - b.system!.order))
}
