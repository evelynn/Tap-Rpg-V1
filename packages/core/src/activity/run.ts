// 상태 기계와 행동 해석기 등록(04 §2). 결정기는 행동과 행동 사이(판단 지점)에서만 불린다.
import { decideSortie } from '../ai/index'
import { autoChoose, emptyScope, makeConditionTest, submitChoice, type EventPorts, type EventResult, type SortiePort } from '../events/index'
import { characterOf, type ConditionTest } from '../rules/context'
import type { Modifier } from '../schema/index'
import type { ActionKind } from '../state/activity'
import type { SaveBody } from '../state/save'
import { registerActionResolver, World, type WorldOptions } from '../sim/world'
import type { NewFamilyInput } from '../sim/create'
import type { Content } from '../content/index'
import { sceneResolver } from './adventure'
import { gateResolver, roomResolver } from './dungeon'
import { lifeEndDue } from '../life/index'
import { encounterResolver } from './hunt'
import { configureActivity, runtimeOf, type ActivityRuntime } from './runtime'
import { COUNTERS, currentSortie, startSortie } from './sortie'
import { campResolver, innResolver, needsRest, needsSeriousTreatment, townResolver, travelResolver, treatmentResolver, TOWN_STEPS } from './town'

let registered = false

// 행동 해석기 등록(ARCHITECTURE §3 확장 지점). 한 과정에서 한 번만 등록한다
export function registerActivityResolvers(): void {
  if (registered) return
  registered = true
  registerActionResolver('encounter', encounterResolver)
  registerActionResolver('room', roomResolver)
  registerActionResolver('gate', gateResolver)
  registerActionResolver('scene', sceneResolver)
  registerActionResolver('travel', travelResolver)
  registerActionResolver('camp', campResolver)
  registerActionResolver('inn', innResolver)
  registerActionResolver('treatment', treatmentResolver)
  registerActionResolver('town', townResolver)
}
registerActivityResolvers()

// 마을 루틴 단계를 진행해 다음 행동을 고른다(04 §8)
function townDecide(world: World): ActionKind {
  const ch = characterOf(world)
  for (;;) {
    const step = ch.counters[COUNTERS.townStep] ?? TOWN_STEPS.done
    if (step === TOWN_STEPS.arrive || step === TOWN_STEPS.prep || step === TOWN_STEPS.family) return 'town'
    if (step === TOWN_STEPS.treatment) {
      if (needsSeriousTreatment(world)) {
        world.state.current_activity.state = 'treatment'
        return 'treatment'
      }
      ch.counters[COUNTERS.townStep] = TOWN_STEPS.rest
      continue
    }
    if (step === TOWN_STEPS.rest) {
      if (needsRest(world)) return 'inn'
      ch.counters[COUNTERS.townStep] = TOWN_STEPS.prep
      continue
    }
    // 루틴 완료: 생애 종료 대상이면 생애·계승(T10)에 넘기고, 아니면 다음 출정을 잡는다
    const rt = runtimeOf(world)
    const due = lifeEndDue(world)
    if (due) {
      if (!rt.lifeEnded && rt.onLifeEnd) {
        rt.lifeEnded = true
        rt.onLifeEnd(world, due.kind)
      }
      return 'town' // 대기
    }
    startSortie(world, decideSortie(world))
    return 'travel'
  }
}

// 상태 → 다음 행동(04 §2.2 전이표)
export function activityDecide(world: World): ActionKind {
  const ca = world.state.current_activity
  switch (ca.state) {
    case 'travel':
    case 'return':
      return 'travel'
    case 'camp':
      return 'camp'
    case 'treatment':
      return 'treatment'
    case 'hunt':
      return 'encounter'
    case 'adventure':
      return 'scene'
    case 'dungeon': {
      const s = currentSortie(world)
      return 'rooms' in s.plan && s.progress < s.plan.rooms.length ? 'room' : 'gate'
    }
    case 'town_prep':
    case 'town_idle':
      return townDecide(world)
    default:
      throw new Error(`행동을 고를 수 없는 상태: ${ca.state}`)
  }
}

// 출정 진행 포트(events/ports SortiePort). 사건이 이번 출정을 바꾼다
export function sortiePort(): SortiePort {
  return {
    sortieMod(w, p) {
      const s = w.state.current_activity.sortie
      if (!s) return
      const e = p as {
        remaining_add?: { encounters?: number; scenes?: number }
        return_travel_sec_add?: number
        camp?: { hp_mult?: number; fatigue_add?: number }
      }
      if (e.remaining_add) {
        if ('target_encounters' in s.plan && e.remaining_add.encounters !== undefined) {
          s.plan.target_encounters = Math.max(1, s.plan.target_encounters + e.remaining_add.encounters)
        }
        if ('scenes' in s.plan && e.remaining_add.scenes !== undefined) s.plan.scenes = Math.max(1, s.plan.scenes + e.remaining_add.scenes)
      }
      const add = (modifier: Modifier): void => void s.temp_mods.push({ modifier, scope: 'sortie', remaining: null, expires_eff_min: null, source_event: null })
      if (e.return_travel_sec_add !== undefined) add({ target: 'return_travel_sec_add', op: 'add', value: e.return_travel_sec_add })
      if (e.camp?.hp_mult !== undefined) add({ target: 'camp_hp_mult', op: 'mul', value: e.camp.hp_mult })
      if (e.camp?.fatigue_add !== undefined) add({ target: 'camp_fatigue_add', op: 'add', value: e.camp.fatigue_add })
    },
  }
}

// 선택 대기를 자동 선택 규칙(10 §5)으로 해소한다. 사용자 결정이 없는 헤드리스 진행용
export function submitPendingAuto(world: World): EventResult | null {
  const p = world.state.pending_choice
  if (!p) return null
  const scope = { place: p.location, vars: (p.context.vars ?? {}) as Record<string, string>, eventId: p.event_id }
  const test = makeConditionTest(world, scope)
  const ev = world.content.get('event', p.event_id)
  const visible = ev.choices.filter((c) => p.choices_visible.includes(c.id) && !p.excluded.includes(c.id))
  const auto = autoChoose(world, { content: world.content, state: world.state, test }, visible, scope)
  return submitChoice(world, auto.choiceId, world.ports)
}

export interface ActivityOptions extends Partial<ActivityRuntime> {
  ports?: Partial<EventPorts>
}

// 세계 옵션: 조건 평가기 + 결정기 + 출정 포트
export function activityWorldOptions(get: () => World | null, opts: ActivityOptions = {}): WorldOptions {
  const test: ConditionTest = (cond) => {
    const w = get()
    // 세계가 아직 없으면(가문 생성 중) 단말 조건은 거짓으로 본다
    if (!w?.state.character) return typeof cond === 'boolean' ? cond : false
    const place = w.state.current_activity.sortie?.location_id ?? w.state.character.location
    return makeConditionTest(w, emptyScope(place))(cond)
  }
  return { test, decide: activityDecide, ports: { sortie: sortiePort(), ...opts.ports } }
}

// 새 가문으로 활동 세계를 만든다
export function createActivityWorld(content: Content, input: NewFamilyInput, opts: ActivityOptions = {}): World {
  let world: World | null = null
  const w = World.create(content, input, activityWorldOptions(() => world, opts))
  world = w
  configureActivity(w, opts)
  w.state.character!.counters[COUNTERS.townStep] = TOWN_STEPS.done
  return w
}

// 저장에서 이어 간다
export function loadActivityWorld(content: Content, state: SaveBody, opts: ActivityOptions = {}): World {
  let world: World | null = null
  const w = new World(content, state, activityWorldOptions(() => world, opts))
  world = w
  configureActivity(w, opts)
  return w
}
