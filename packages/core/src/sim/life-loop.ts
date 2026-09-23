// 한 생애를 끝에서 끝까지 잇는다: 판단 지점(04 §2.3)의 생애 훅과 계승 5단계(12 §1.1)를 World에 붙인다.
//
// 판단 지점 순서는 04 §2.3(D39) 그대로다. 행동 해석기 안에서 `숨 고르기 → 사건 검사·적용 → 현장 판단`이
// 끝난 뒤, World가 행동을 적용한 직후에 이 파일의 생애 훅이 온다:
//   나이 알림(09 §2.1) → 사망 검사(04 §2.2) → 생애 종료 사건 + 계승 1~2단계 → (자동 계승이면) 3~5단계.
// 생애 종료·계승은 상태를 `계승 대기`로 옮겨 유효 진행 시계를 멈추므로(04 §2.1) 자동 계승이 꺼져 있으면
// `succeed(world)`를 부를 때까지 시간이 흐르지 않는다.
import type { Content } from '../content/index'
import type { EventPorts } from '../events/index'
import { addJournal } from '../journal/index'
import { characterOf } from '../rules/context'
import { emptyLifeLoop, type LifeLoopState, type ResolvedAction } from '../state/activity'
import type { Character } from '../state/character'
import type { LifeRecord } from '../state/family'
import type { SaveBody } from '../state/save'
import { ageAt } from '../time/index'
import type { DeathRecord } from '../combat/defeat'
import {
  activityWorldOptions, configureActivity, runtimeOf, townId, COUNTERS, TOWN_STEPS, type ActivityOptions,
} from '../activity/index'
import {
  ageNotices, ageTick, causeLines, deathNotice, familyChoice, fireLifeEnd, fireSystemEvent, letterChoice, letterState,
  longSleepDue, pickRetireRole, registerRetiree, retireeHeirEvents, systemEvents, type SystemPhase,
} from '../life/index'
import { endLife, startHeir, successionPorts, type HeirChoice, type SuccessionPlan } from '../succession/index'
import type { NewFamilyInput } from './create'
import { World, type WorldOptions } from './world'

type EndKind = SuccessionPlan['record']['end_kind']

interface PendingEnd {
  kind: EndKind
  death: DeathRecord | null
}

// 생애 진행 상태는 저장 본문(current_activity.life_loop, CONTENT_SCHEMA §6 C31)에 둔다.
// 행동 도중(13 §8.1 주기 저장·종료 저장)이나 계승 대기 중에 저장해도 나이 알림·끝낼 생애·계승 계획을 잃지 않는다:
//   age_ticks    다음 판단 지점에서 알릴 나이 변화(09 §2.1)
//   pending_end  이번 판단 지점에서 끝낼 생애
//   succession   계승 1~2단계 결과. 3~5단계를 기다린다
export function lifeLoopOf(world: World): LifeLoopState {
  return (world.state.current_activity.life_loop ??= emptyLifeLoop())
}

// 사망 기록은 저장 스키마가 뼈대(final_check)만 본다. 저장 ↔ 코어 타입 사이는 모양이 같아 형만 바꾼다
type SavedDeath = NonNullable<LifeLoopState['pending_end']>['death']
const pendingOf = (st: LifeLoopState): PendingEnd | null =>
  st.pending_end && { kind: st.pending_end.kind, death: st.pending_end.death as unknown as DeathRecord | null }

// ── 사망 검사 ──

// 최후 판정에 진 기록(DeathRecord)을 방금 적용한 확정 결과에서 찾는다.
// 패배 결과는 행동 종류마다 다른 자리에 담겨 있어(조우·방·관문) 모양으로 찾는다(I51)
function findDeath(value: unknown, depth = 0): DeathRecord | null {
  if (depth > 4 || typeof value !== 'object' || value === null) return null
  const rec = value as Record<string, unknown>
  const death = rec.death
  if (rec.outcome === 'died' && typeof death === 'object' && death !== null && 'final_check' in death) return death as DeathRecord
  for (const v of Object.values(rec)) {
    const hit = findDeath(v, depth + 1)
    if (hit) return hit
  }
  return null
}

function deathIn(action: ResolvedAction | null): DeathRecord | null {
  if (!action) return null
  for (const e of action.effects) {
    const hit = findDeath(e)
    if (hit) return hit
  }
  return null
}

// 09 §5.4 원인 기록을 연대기 항목(16 §5.3 cause)으로 옮긴다. 부상은 등급·능력치 키로 남기고 문장은 화면이 만든다
function causeOf(d: DeathRecord): LifeRecord['cause'] {
  return {
    location: d.location,
    risk: d.risk.grade,
    lethal_source: d.lethal_source,
    injuries_at_end: d.injuries.map((i) => `${i.grade}:${i.stat}`),
    decisive_check: { dice: d.final_check.dice, total: d.final_check.total, dc: d.final_check.dc },
  }
}

// ── 생애 종료(계승 1~2단계) ──

// 생애 종료 사건(S03·S04·S08)을 먼저 발화하고 endLife로 넘긴다. 인물이 아직 있어야 기록이 그 인물에 붙는다
function runLifeEnd(world: World, end: PendingEnd): void {
  const ch = characterOf(world)
  const st = lifeLoopOf(world)
  if (end.kind === 'died') {
    const d = end.death
    const place = d?.location ?? ch.location
    const lines = d ? causeLines(world, d) : null
    if (d && lines) addJournal(world, deathNotice(d, lines))
    fireLifeEnd(world, { kind: 'died', place, ...(lines ? { vars: { ...lines } } : {}) }, world.ports)
    st.succession = endLife(world, { kind: 'died', place, ...(d ? { cause: causeOf(d) } : {}) })
    return
  }
  if (end.kind === 'retired') {
    const role = pickRetireRole(world)
    fireLifeEnd(world, { kind: 'retired', place: ch.location, roleId: role.id }, world.ports)
    registerRetiree(world, role.id)
    st.succession = endLife(world, { kind: 'retired', place: ch.location, roleId: role.id })
    return
  }
  const cause = longSleepDue(world) ?? 'age'
  fireLifeEnd(world, { kind: 'long_sleep', place: ch.location, cause }, world.ports)
  st.succession = endLife(world, {
    kind: 'long_sleep',
    place: ch.location,
    longSleep: { cause, sleep_age: ageAt(ch.eff_min, world.content.balance.time) },
  })
}

// ── 계승 3~5단계 ──

// 계승 대기에서 후계자를 확정하고 새 인물을 출발시킨다(12 §1.1 3~5단계). 자동 계승이 켜져 있으면 훅이 부른다
export function succeed(world: World, choice: HeirChoice = {}): Character {
  const st = lifeLoopOf(world)
  const plan = st.succession
  if (!plan) throw new Error('계승을 기다리는 생애 기록이 없다')
  const heir = startHeir(world, plan, choice, world.ports)
  st.succession = null
  st.age_ticks.length = 0
  // 이전 인물의 확정 결과는 남기지 않는다(새 인물의 유효 진행은 0분부터다)
  world.state.current_activity.resolved_action = null
  const rt = runtimeOf(world)
  rt.lifeEnded = false
  // 새 인물은 마을에서 출발한다(12 §1.1 5단계). startHeir는 이전 인물이 있던 곳을 물려주므로
  // 현장에서 죽은 세대 다음에는 던전에서 시작해 버린다(I52)
  heir.location = townId(world)
  heir.counters[COUNTERS.townStep] = TOWN_STEPS.done
  return heir
}

// 계승 대기 중인 생애 기록(없으면 null). 계승 화면이 후보·유품·정산을 읽는다
export function pendingSuccession(world: World): SuccessionPlan | null {
  return lifeLoopOf(world).succession
}

// ── 시스템 사건 발화(10 §3.3) ──

// 사건 정의가 가진 확률·간격·횟수를 지킨다. 조건은 systemEvents가 이미 봤다
function systemDue(world: World, ev: { id: string; max_per_life?: number; cooldown_min?: number; check_override?: number; allow_serious_injury: boolean }): boolean {
  const ch = characterOf(world)
  const count = ch.event_counts[ev.id] ?? 0
  if (ev.max_per_life !== undefined && count >= ev.max_per_life) return false
  const last = ch.event_last_min[ev.id]
  if (last !== undefined && ev.cooldown_min !== undefined && ch.eff_min - last < ev.cooldown_min) return false
  if (!ev.allow_serious_injury && ch.injuries.some((i) => i.grade === 'serious')) return false
  return world.rng.event.chance(ev.check_override ?? 1)
}

// 마을 루틴 8단계·파산 검사가 부르는 훅(활동 층 ActivityRuntime.onSystemPhase).
// 은퇴 부모가 여는 사건(retire_role.heir_events)은 편지 규칙(09 §4.2)이 종류를 정하고, 나머지는 사건 정의대로 본다
export function fireSystemPhase(world: World, phase: string): void {
  if (!world.state.character) return
  const place = characterOf(world).location
  const letters = new Set(retireeHeirEvents(world))
  for (const ev of systemEvents(world, phase as SystemPhase, place)) {
    if (world.state.pending_choice) return
    if (letters.has(ev.id)) {
      const ls = letterState(world, ev.id)
      if (!ls.kind || !ls.gapOk || !world.rng.event.chance(ls.chance)) continue
      const pick = letterChoice(world, ev, place, ls.kind)
      if (pick === null) continue
      fireSystemEvent(world, ev.id, place, world.ports, { choiceId: pick })
      continue
    }
    if (!systemDue(world, ev)) continue
    fireSystemEvent(world, ev.id, place, world.ports, { choiceId: familyChoice(world, ev, place) })
  }
}

// ── 판단 지점 훅 ──

function onPoint(world: World): void {
  if (!world.state.character) return
  const st = lifeLoopOf(world)
  // 1. 나이 알림: 능력치는 나이가 오르는 순간 적용하고 알림만 여기로 미룬다(09 §2.1)
  for (const tick of st.age_ticks.splice(0)) for (const d of ageNotices(world, tick)) addJournal(world, d)
  // 2. 사망: 치명 활동의 최후 판정에 지면 귀환하지 않고 그 자리에서 끝난다(04 §2.2)
  if (!st.pending_end && !st.succession && characterOf(world).hp <= 0) {
    st.pending_end = { kind: 'died', death: deathIn(world.state.current_activity.resolved_action) as unknown as SavedDeath }
  }
  // 3. 생애 종료 사건 + 계승 1~2단계 → 계승 대기(시계 정지)
  const end = pendingOf(st)
  if (end && !st.succession) {
    st.pending_end = null
    runLifeEnd(world, end)
  }
  // 4. 자동 계승이면 3~5단계까지 이어 간다(12 §1.2)
  if (st.succession && world.state.policies.auto_succession) succeed(world)
}

// 은퇴·긴 잠은 마을 루틴이 끝난 마을 대기에서 알려 온다(04 §2.2, 09 §3.1)
function markLifeEnd(world: World, kind: EndKind): void {
  const st = lifeLoopOf(world)
  if (!st.pending_end && !st.succession) st.pending_end = { kind, death: null }
}

// ── 조립 ──

// 활동 세계 옵션 + 생애 포트 + 판단 지점 훅
export function gameWorldOptions(get: () => World | null, opts: ActivityOptions = {}): WorldOptions {
  const act = activityWorldOptions(get, opts)
  const over = act.ports as Partial<EventPorts>
  return {
    ...act,
    ports: (base) => ({ ...over, ...successionPorts(base) }),
    onAge: (w, from, to, changes) => {
      const tick = ageTick(w.content, from, to, changes)
      lifeLoopOf(w).age_ticks.push({ ...tick, changes: [...tick.changes] })
    },
    onPoint,
  }
}

function configureGame(world: World, opts: ActivityOptions): void {
  configureActivity(world, { onSystemPhase: fireSystemPhase, onLifeEnd: markLifeEnd, ...opts })
}

// 새 가문으로 시작한다(활동 + 생애 + 계승이 모두 붙은 세계)
export function createGameWorld(content: Content, input: NewFamilyInput, opts: ActivityOptions = {}): World {
  let world: World | null = null
  const w = World.create(content, input, gameWorldOptions(() => world, opts))
  world = w
  configureGame(w, opts)
  w.state.character!.counters[COUNTERS.townStep] = TOWN_STEPS.done
  return w
}

// 저장에서 이어 간다
export function loadGameWorld(content: Content, state: SaveBody, opts: ActivityOptions = {}): World {
  let world: World | null = null
  const w = new World(content, state, gameWorldOptions(() => world, opts))
  world = w
  configureGame(w, opts)
  return w
}
