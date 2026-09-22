// 시뮬레이션 세계: 콘텐츠 + 저장 상태 + 난수 흐름 5개. 행동 골격(13 §8.1·§8.3):
// 행동을 시작할 때 필요한 난수를 모두 굴려 current_activity.resolved_action에 저장하고,
// 유효 진행 시간이 그 행동의 길이만큼 흐르면 결과를 적용한다. 저장을 복제해 이어 가도 다시 굴리지 않는다.
// 행동 시작·적용 직후 난수 상태를 state.rng_state에 맞춰 두므로 그 시점의 state를 그대로 저장해도 된다.
import type { Content } from '../content/index'
import { addJournal } from '../journal/index'
import { Pcg32, RNG_STREAMS, type RngStream } from '../rng/index'
import type { ActionKind, ResolvedAction } from '../state/activity'
import type { SaveBody } from '../state/save'
import { ageAt } from '../time/index'
import { characterOf, constantConditionTest, type ConditionTest, type RuleContext } from '../rules/context'
import { applyAging, type AgingChange } from '../rules/growth'
import type { EventPorts, EventWorld } from '../events/index'
import { createNewFamilyState, rngStates, type NewFamilyInput } from './create'
import { createServices, type SimServices } from './services'

// 해석기가 행동 시작 때 확정하는 부분(seq·kind·시작 시점·applied는 World가 채운다)
export type ResolvedDraft = Omit<ResolvedAction, 'seq' | 'kind' | 'started_eff_min' | 'applied'>

// 행동 종류별 해석기. resolve는 난수를 굴려 결과만 만들고 상태를 바꾸지 않는다. apply가 상태를 바꾼다
export interface ActionResolver {
  resolve(world: World): ResolvedDraft
  apply(world: World, action: ResolvedAction): void
}

// 기본 등록부. 실제 행동(사냥·던전·모험·마을 등)은 T5·T8이 등록한다
export const ACTION_RESOLVERS: Partial<Record<ActionKind, ActionResolver>> = {}

export function registerActionResolver(kind: ActionKind, resolver: ActionResolver): void {
  if (ACTION_RESOLVERS[kind]) throw new Error(`행동 해석기 중복: ${kind}`)
  ACTION_RESOLVERS[kind] = resolver
}

export interface WorldOptions {
  test?: ConditionTest // 조건 평가기(makeConditionTest). 사건 포트는 제 scope로 다시 만들어 쓴다
  ports?: Partial<EventPorts> // 사건 포트 교체(출정 진행·계승이 제 구현을 넣는다)
  resolvers?: Partial<Record<ActionKind, ActionResolver>> // 없으면 ACTION_RESOLVERS
  // 다음 행동(04 행동 결정). 행동과 행동 사이에만 부른다. 할 일이 없을 때의 대기도 길이가 정해진 행동이다
  decide?: (world: World) => ActionKind
  // 나이가 바뀐 직후(노화 이정표 적용 뒤). 나이 기록·은퇴 나이·생애 단계 경계를 여기서 받는다. 인물을 없애지 않는다
  onAge?: (world: World, fromAge: number, toAge: number, changes: AgingChange[]) => void
}

// 유효 진행 시계가 멈추는 상태
const STOPPED_STATES = ['awaiting_choice', 'awaiting_succession', 'paused'] as const

// 한 advance 안에서 0초 행동이 이만큼 이어지면 결정기·해석기 오류로 본다(시간이 흐르지 않는 무한 반복 방지)
const MAX_ZERO_ACTIONS = 1000

// 분 ↔ 밀리초. 시계를 정수 밀리초로 계산해 나눠 흘려도 한 번에 흘린 것과 같은 값이 되게 한다
const toMs = (min: number) => Math.round(min * 60000)
const toMin = (ms: number) => ms / 60000

export class World implements RuleContext, EventWorld {
  readonly rng: Record<RngStream, Pcg32>
  readonly test: ConditionTest
  // 사건 엔진이 쓰는 포트 묶음(전투·장비·경제·회복). 적용 단계에서만 상태를 바꾼다
  readonly services: SimServices
  private readonly resolvers: Partial<Record<ActionKind, ActionResolver>>
  private readonly decide: (world: World) => ActionKind
  private readonly onAge: WorldOptions['onAge']

  constructor(
    readonly content: Content,
    public state: SaveBody,
    opts: WorldOptions = {},
  ) {
    this.rng = Object.fromEntries(RNG_STREAMS.map((s) => [s, Pcg32.fromState(state.rng_state.streams[s])])) as Record<RngStream, Pcg32>
    this.test = opts.test ?? constantConditionTest
    this.resolvers = opts.resolvers ?? ACTION_RESOLVERS
    this.decide = opts.decide ?? (() => {
      throw new Error('행동 결정기가 없다(WorldOptions.decide)')
    })
    this.onAge = opts.onAge
    this.services = createServices(this, { ...(opts.ports ? { ports: opts.ports } : {}) })
  }

  get ports(): EventPorts {
    return this.services.ports
  }

  static create(content: Content, input: NewFamilyInput, opts: WorldOptions = {}): World {
    return new World(content, createNewFamilyState(content, input, opts.test), opts)
  }

  // 난수 상태를 저장 본문에 옮기고 깊은 사본을 돌려준다(저장·복제용)
  snapshot(): SaveBody {
    this.syncRng()
    return JSON.parse(JSON.stringify(this.state)) as SaveBody
  }

  get clockRunning(): boolean {
    return this.state.character !== null && !(STOPPED_STATES as readonly string[]).includes(this.state.current_activity.state)
  }

  pause(): void {
    const ca = this.state.current_activity
    if (ca.state === 'paused') return
    ca.paused_from = ca.state
    ca.state = 'paused'
  }

  resume(): void {
    const ca = this.state.current_activity
    if (ca.state !== 'paused') return
    ca.state = ca.paused_from ?? 'town_idle'
    ca.paused_from = null
  }

  // 행동 시작: 해석기가 결과를 확정하고 resolved_action에 저장한다. 적용 전 결과가 있으면 다시 굴리지 않는다(13 §8.3)
  startAction(kind: ActionKind): ResolvedAction {
    const prev = this.state.current_activity.resolved_action
    if (prev && !prev.applied) throw new Error(`적용하지 않은 확정 결과가 있다(${prev.kind} #${prev.seq})`)
    const resolver = this.resolvers[kind]
    if (!resolver) throw new Error(`행동 해석기가 없다: ${kind}`)
    const ch = characterOf(this)
    const draft = resolver.resolve(this)
    const action: ResolvedAction = { seq: (prev?.seq ?? 0) + 1, kind, started_eff_min: ch.eff_min, ...draft, applied: false }
    this.state.current_activity.resolved_action = action
    this.syncRng()
    return action
  }

  // sec초만큼 유효 진행 시간을 흘린다. 멈춤 상태가 되면 그 자리에서 끝낸다. 흘린 초를 돌려준다
  advance(sec: number): number {
    let budget = Math.round(sec * 1000)
    const start = budget
    let zeroRun = 0
    while (budget > 0 && this.clockRunning) {
      let action = this.state.current_activity.resolved_action
      if (!action || action.applied) action = this.startAction(this.decide(this))
      const end = toMs(action.started_eff_min) + action.duration_sec * 1000
      const step = Math.max(0, Math.min(budget, end - toMs(characterOf(this).eff_min)))
      zeroRun = step === 0 ? zeroRun + 1 : 0
      if (zeroRun > MAX_ZERO_ACTIONS) throw new Error(`0초 행동이 ${MAX_ZERO_ACTIONS}번 넘게 이어진다(${action.kind})`)
      this.moveClock(step)
      budget -= step
      if (toMs(characterOf(this).eff_min) >= end) this.applyAction(action)
    }
    return (start - budget) / 1000
  }

  // 확정 결과 적용: 기록(id·시점은 지금, 적용 전 인물) → 해석기 apply → applied.
  // 기록을 먼저 남겨야 apply가 인물을 없애거나(사망·은퇴) 바꿔도 그 행동의 기록이 원래 인물에 붙는다
  applyAction(action: ResolvedAction): void {
    if (action.applied) return
    const resolver = this.resolvers[action.kind]
    if (!resolver) throw new Error(`행동 해석기가 없다: ${action.kind}`)
    for (const draft of action.journal) addJournal(this, draft)
    resolver.apply(this, action)
    action.applied = true
    this.syncRng()
  }

  private syncRng(): void {
    this.state.rng_state.streams = rngStates(this.rng)
  }

  // 인물의 유효 진행 분을 옮기고, 나이가 바뀌면 노화 이정표를 적용한다
  private moveClock(ms: number): void {
    if (ms <= 0) return
    const ch = characterOf(this)
    const time = this.content.balance.time
    const fromAge = ageAt(ch.eff_min, time)
    ch.eff_min = toMin(toMs(ch.eff_min) + ms)
    const toAge = ageAt(ch.eff_min, time)
    if (toAge > fromAge) {
      const changes = applyAging(this, fromAge, toAge)
      this.onAge?.(this, fromAge, toAge, changes)
    }
  }
}
