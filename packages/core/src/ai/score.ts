// 활동 가중치(04 §5), 장소 점수(04 §6.1), 던전 목표 층(04 §6.2), 임무(04 §3.3·§5.4).
import { characterOf, type RuleContext } from '../rules/context'
import { modValue } from '../rules/modifiers'
import { weightedPick, type Rng } from '../rules/random'
import { ACTIVITIES, chainStageKey } from '../schema/index'
import { ageAt, lifeStageAt } from '../time/index'
import { filterPlaces, passesFilters, type Candidate, type FilterOptions } from './candidates'
import { hookSum } from './hooks'
import { activityOf, gateRiskDiff, riskCap, riskRank, type Activity } from './risk'

// 생애 단계 경계(balance.aging.life_stages)
export function lifeStage(ctx: RuleContext): string {
  const st = ctx.content.balance.aging.life_stages
  const from = (id: string): number => st.find((s) => s.id === id)!.from_age
  const ch = characterOf(ctx)
  return lifeStageAt(ageAt(ch.eff_min, ctx.content.balance.time), [from('prime'), from('veteran'), from('elder')])
}

// 이동 시간(초): 장소 이동 + 층 하강에 travel_time_mult(하한 travel_time_floor)를 곱한다
export function travelSec(ctx: RuleContext, regionId: string): number {
  const r = ctx.content.get('region', regionId)
  if (r.kind === 'town') return 0
  const floor = ctx.content.balance.activity_ai.travel_time_floor
  const mult = Math.max(floor, modValue(ctx, 'travel_time_mult', 1))
  return Math.max(0, Math.round((r.travel_sec + (r.descend_sec ?? 0)) * mult))
}

// ── 임무(04 §3.3) ──

export interface Mission {
  kind: 'chain' | 'quest'
  key: string // 줄기 id 또는 의뢰 사건 id
  location_id: string
  activity: Activity
}

function missionAt(ctx: RuleContext, kind: Mission['kind'], key: string, place: string): Mission | null {
  if (!ctx.content.has('region', place)) return null
  const r = ctx.content.get('region', place)
  if (r.kind === 'town') return null
  return { kind, key, location_id: place, activity: activityOf(r.kind) }
}

// 진행 중인 줄기의 다음 단계가 열리는 장소(그 단계 사건 정의의 locations 첫 값)
export function chainMissions(ctx: RuleContext): Mission[] {
  const { content } = ctx
  const ch = characterOf(ctx)
  const out: Mission[] = []
  for (const chain of content.list('chain')) {
    const stage = ch.flags[chainStageKey(chain.id)]
    if (typeof stage !== 'number' || stage < 1 || stage >= chain.stages) continue
    const ev = content.list('event').find((e) => e.chain?.id === chain.id && e.chain.stage === stage + 1)
    const place = ev?.locations?.[0]
    const m = place === undefined ? null : missionAt(ctx, 'chain', chain.id, place)
    if (m) out.push(m)
  }
  return out
}

export function questMission(ctx: RuleContext): Mission | null {
  const q = characterOf(ctx).quest
  return q ? missionAt(ctx, 'quest', q.event_id, q.location_id) : null
}

export function allMissions(ctx: RuleContext): Mission[] {
  const q = questMission(ctx)
  return q ? [q, ...chainMissions(ctx)] : chainMissions(ctx)
}

// 임무 보너스 = min(cap, (base + 보류 경과 가산) × 노년 배수)(04 §5.4)
export function missionBonus(ctx: RuleContext, m: Mission): number {
  const cfg = ctx.content.balance.activity_ai.mission
  const ch = characterOf(ctx)
  const since = m.kind === 'chain' ? ch.chain_mission[m.key]?.pending_since_eff_min : ch.quest?.accepted_eff_min
  const overdue = since !== null && since !== undefined && ch.eff_min - since >= cfg.overdue_min
  const elder = lifeStage(ctx) === 'elder' ? cfg.elder_mult : 1
  return Math.min(cfg.cap, (cfg.base + (overdue ? cfg.overdue_add : 0)) * elder)
}

// 우선 처리할 임무: 장소가 필터를 통과하고 연속 출정 한도 안이면 그 장소로 바로 간다
export function priorityMission(ctx: RuleContext, cands: readonly Candidate[]): Mission | null {
  const cfg = ctx.content.balance.activity_ai.mission
  const ch = characterOf(ctx)
  for (const m of allMissions(ctx)) {
    if (!cands.some((c) => c.id === m.location_id)) continue
    if (m.kind === 'chain' && (ch.chain_mission[m.key]?.priority_sorties ?? 0) >= cfg.priority_sorties) continue
    return m
  }
  return null
}

// ── 장소 점수(04 §6.1) ──

// 아직 남은 발견 지점이 있는 모험 경로인가
export function hasDiscoveryLeft(ctx: RuleContext, place: string): boolean {
  const r = ctx.content.get('region', place)
  if (r.kind !== 'adventure_route') return false
  const found = characterOf(ctx).discoveries
  return r.discoveries.some((d) => !found.includes(d.id) && ctx.test(d.condition))
}

const hasChainStage = (ctx: RuleContext, place: string): boolean => chainMissions(ctx).some((m) => m.location_id === place)

export function locationScore(ctx: RuleContext, c: Candidate): number {
  const cfg = ctx.content.balance.activity_ai.location_score
  const ch = characterOf(ctx)
  const att = ctx.content.get('attitude', ctx.state.policies.attitude)
  let score = cfg.base - cfg.risk_diff_mult * Math.abs(c.diff - att.location_target_risk)
  if (hasChainStage(ctx, c.id)) score += cfg.chain_stage
  if (!ch.visited.includes(c.id)) score += cfg.unvisited
  if (hasDiscoveryLeft(ctx, c.id)) score += cfg.discovery_left
  score -= travelSec(ctx, c.id) / cfg.travel_div
  // 특성 가산(06 표). 장소당 합계는 trait_cap으로 자른다
  const raw = hookSum(ctx, 'location_score_add', (v) =>
    (v as { when: never; value: number }[]).filter((x) => ctx.test(x.when)).reduce((s, x) => s + x.value, 0))
  return score + Math.max(cfg.trait_cap[0], Math.min(cfg.trait_cap[1], raw))
}

// 장소 점수 내림차순. 동점이면 권장 레벨 중앙값이 높은 곳, 그래도 같으면 id 순(04 §6.1)
export function sortByScore(ctx: RuleContext, cands: readonly Candidate[]): Candidate[] {
  const mid = (id: string): number => {
    const r = ctx.content.get('region', id)
    return r.kind === 'town' ? 0 : r.level_mid
  }
  return cands
    .map((c) => ({ c, s: locationScore(ctx, c) }))
    .sort((a, b) => b.s - a.s || mid(b.c.id) - mid(a.c.id) || (a.c.id < b.c.id ? -1 : 1))
    .map((x) => x.c)
}

// 점수 상위 두 곳을 pick_weights로 고른다
export function pickLocation(ctx: RuleContext, rng: Rng, cands: readonly Candidate[]): string {
  if (cands.length === 1) return cands[0]!.id
  const weights = ctx.content.balance.activity_ai.location_score.pick_weights
  const top = sortByScore(ctx, cands).slice(0, weights.length)
  return top[weightedPick(rng, weights.slice(0, top.length))]!.id
}

// ── 던전 목표 층(04 §6.2) ──

function dungeonOf(ctx: RuleContext, id: string): { group: string; depth: number } | null {
  const r = ctx.content.get('region', id)
  return r.kind === 'dungeon_floor' ? r.dungeon : null
}

// 그 층의 관문을 이번 생애에 격파했는가(07 §4.5 생애 단위)
export function gateCleared(ctx: RuleContext, id: string): boolean {
  const r = ctx.content.get('region', id)
  return r.kind === 'dungeon_floor' && characterOf(ctx).defeated.includes(r.gate.enemy_id)
}

// 관문 위험 조건(07 §5.6). 체력 조건은 관문 앞에서 따로 본다
export function gateRiskOk(ctx: RuleContext, id: string, night: boolean): boolean {
  const r = ctx.content.get('region', id)
  if (r.kind !== 'dungeon_floor') return false
  const att = ctx.content.get('attitude', ctx.state.policies.attitude)
  const pol = ctx.state.policies
  const diff = gateRiskDiff(ctx, r.gate.enemy_id, night)
  if (r.gate.lethal) {
    if (!pol.lethal_allowed || !pol.lethal_scope.gate_battles) return false
    return diff <= att.lethal_gate_risk_limit
  }
  return diff <= att.gate_risk_limit
}

// 목표 층이 F6·F7에서 떨어지면 한 층 얕은 층을 쓴다. 그것도 없으면 null
function narrow(ctx: RuleContext, inGroup: readonly Candidate[], target: Candidate, night: boolean): Candidate | null {
  for (let i = inGroup.indexOf(target); i >= 0; i--) {
    const c = inGroup[i]!
    if (passesFilters(ctx, ctx.content.get('region', c.id), c.grade, { night })) return c
  }
  return null
}

// 묶음 하나의 목표 층. 입장 가능 층은 F1·F2·F3·F4·F5·F8을 통과한 층이다
export function targetFloor(ctx: RuleContext, group: string, night: boolean, opts: FilterOptions): Candidate | null {
  const { content } = ctx
  const ch = characterOf(ctx)
  const att = content.get('attitude', ctx.state.policies.attitude)
  const inGroup = filterPlaces(ctx, { ...opts, night, skipRiskFilters: true })
    .filter((c) => dungeonOf(ctx, c.id)?.group === group)
    .sort((a, b) => (dungeonOf(ctx, a.id)!.depth - dungeonOf(ctx, b.id)!.depth))
  if (!inGroup.length) return null

  // 1 관문 미격파 층 우선(깊은 층부터, D19)
  for (const c of [...inGroup].reverse()) if (!gateCleared(ctx, c.id) && gateRiskOk(ctx, c.id, night)) return narrow(ctx, inGroup, c, night)
  // 2 새 층 적응(얕은 층부터): 무사 귀환이 모자라고 태도 최대 위험 안이면 그 층
  const need = content.balance.activity_ai.adaptation_returns
  for (const c of inGroup) {
    // 위험 상한은 방침이 태도 기본을 덮어쓸 수 있다(04 §10.1)
    if ((ch.counters_at.safe_returns?.[c.id] ?? 0) < need && riskRank(c.grade) <= riskRank(riskCap(ctx, 'dungeon'))) return narrow(ctx, inGroup, c, night)
  }
  // 3 적정 층: 위험 차가 상한 안인 가장 깊은 층, 없으면 가장 얕은 층. 안정적은 한 층 얕게
  const cap = content.balance.activity_ai.dungeon_fit_max_risk_diff
  const fit = [...inGroup].reverse().find((c) => c.diff <= cap) ?? inGroup[0]!
  const idx = Math.max(0, inGroup.indexOf(fit) + att.dungeon_depth_offset)
  return narrow(ctx, inGroup, inGroup[Math.min(idx, inGroup.length - 1)]!, night)
}

// 묶음마다 목표 층 하나
export function dungeonTargets(ctx: RuleContext, night: boolean, opts: FilterOptions): Candidate[] {
  const groups = new Set<string>()
  for (const r of ctx.content.list('region')) if (r.kind === 'dungeon_floor') groups.add(r.dungeon.group)
  const out: Candidate[] = []
  for (const g of [...groups].sort()) {
    const c = targetFloor(ctx, g, night, opts)
    if (c) out.push(c)
  }
  return out
}

// ── 활동 가중치(04 §5) ──

export interface WeightedActivities {
  weights: Record<Activity, number>
  byActivity: Record<Activity, Candidate[]>
}

export function activityWeights(ctx: RuleContext, cands: readonly Candidate[]): WeightedActivities {
  const { content } = ctx
  const b = content.balance
  const cfg = b.activity_ai
  const ch = characterOf(ctx)
  const att = content.get('attitude', ctx.state.policies.attitude)
  const spec = ch.specialization === 'none' ? undefined : b.specializations[ch.specialization]
  const stageAdd = cfg.life_stage_weight[lifeStage(ctx) as 'elder'] ?? {}
  const missions = allMissions(ctx)
  const byActivity: Record<Activity, Candidate[]> = { hunt: [], adventure: [], dungeon: [] }
  for (const c of cands) byActivity[c.activity].push(c)

  const weights: Record<Activity, number> = { hunt: 0, adventure: 0, dungeon: 0 }
  for (const act of ACTIVITIES) {
    const mine = byActivity[act]
    if (!mine.length) continue
    let w = att.activity_weights[act]
    const traitRaw = hookSum(ctx, 'activity_weight_add', (v) => (v as Partial<Record<Activity, number>>)[act])
    w += Math.max(cfg.trait_sum_cap[0], Math.min(cfg.trait_sum_cap[1], traitRaw))
    w += spec?.activity_weight_add[act] ?? 0
    // 임무: 우선 처리하지 못한(보류·한도 초과) 임무의 활동에 보너스.
    // 우선 처리할 임무가 있으면 decideSortie가 이미 그 장소로 빠져나가므로 여기서는 다시 거르지 않는다(04 §5.2)
    for (const m of missions) if (m.activity === act) w += missionBonus(ctx, m)
    if (mine.some((c) => !ch.visited.includes(c.id))) w += cfg.explore.unvisited
    if (act === 'adventure' && mine.some((c) => hasDiscoveryLeft(ctx, c.id))) w += cfg.explore.discovery_left
    w += stageAdd[act] ?? 0
    weights[act] = Math.max(0, w) * repeatCoef(ctx, act) * fitCoef(ctx, act, mine)
  }
  return { weights, byActivity }
}

// 반복 계수: 직전까지 같은 활동을 연속 k회 고르면 max(floor, 1 − step × max(0, k − free))
export function repeatCoef(ctx: RuleContext, act: Activity): number {
  const cfg = ctx.content.balance.activity_ai.repeat
  const streak = characterOf(ctx).activity_streak
  const k = streak && streak.activity === act ? streak.k : 0
  return Math.max(cfg.floor, 1 - cfg.step * Math.max(0, k - cfg.free))
}

// 적정도 계수: 그 활동 후보 중 장소 점수가 가장 높은 곳의 위험 등급 기준(동점 규칙은 pickLocation과 같다)
export function fitCoef(ctx: RuleContext, act: Activity, mine: readonly Candidate[]): number {
  const att = ctx.content.get('attitude', ctx.state.policies.attitude)
  const best = sortByScore(ctx, mine)[0]!
  if (best.grade === 'reckless') return 0
  if (best.grade === 'high' && act === 'adventure' && att.fit_coef.high_adventure !== undefined) return att.fit_coef.high_adventure
  return att.fit_coef[best.grade]
}

// 활동 가중 선택. 가중치 합이 0이면 null
export function pickActivity(rng: Rng, w: Record<Activity, number>): Activity | null {
  const list = ACTIVITIES.map((a) => w[a])
  if (list.every((x) => x <= 0)) return null
  return ACTIVITIES[weightedPick(rng, list)]!
}
