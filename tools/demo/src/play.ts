// 재생 루프: 유효 진행 시간을 흘리며 새 기록을 한 줄씩 내보내고, 선택 대기·생애 종료·계승을 다룬다.
// 입출력은 모두 deps로 받아 테스트에서는 화면 없이 돌린다.
import {
  ageAt, maxHp, pendingSuccession, seasonAt, submitChoice, submitPendingAuto, succeed,
  type JournalEntry, type SuccessionPlan, type World,
} from '@tap/core'
import type { DemoArgs } from './args'
import {
  renderChoice, renderEntry, renderHeir, renderLife, renderStatus,
  type ChoiceView, type HeirView, type LifeView, type StatusView,
} from './render'

export interface PlayDeps {
  write(text: string): void // 기록·요약 한 덩어리 출력
  status(view: StatusView): void // 상태 표시줄 갱신
  sleep(ms: number): Promise<void>
  ask?(view: ChoiceView): Promise<number> // 1~N 번호. 없으면 자동 선택
  stopped?(): boolean // Ctrl+C 같은 중단 신호
}

export interface PlayResult {
  lines: string[] // 저장용 기록 전문
  minutes: number // 흐른 유효 진행 분
  lives: number // 끝까지 본 생애 수
}

const TICK_SEC = 0.1 // 실시간 재생 한 걸음
const CHUNK_SEC = 60 // advance 한 번에 흘리는 최대 유효 진행 초

function statusOf(world: World): StatusView {
  const ch = world.state.character
  const time = world.content.balance.time
  if (!ch) return { gen: world.state.family.generation, name: '—', age: 0, season: 'spring', level: 0, hp: 0, maxHp: 0, coins: 0, place: '—', state: world.state.current_activity.state }
  return {
    gen: ch.generation,
    name: ch.name,
    age: ageAt(ch.eff_min, time),
    season: seasonAt(ch.eff_min, ch.birth_season, time),
    level: ch.level,
    hp: Math.round(ch.hp),
    maxHp: Math.round(maxHp(world)),
    coins: ch.coins,
    place: world.content.get('region', world.state.current_activity.sortie?.location_id ?? ch.location).name,
    state: world.state.current_activity.state,
  }
}

function choiceViewOf(world: World): ChoiceView {
  const p = world.state.pending_choice!
  const rendered = p.preview_rendered as { body?: string; note?: string; choices?: Record<string, { label: string; benefit?: string; cost?: string }> }
  const ids = p.choices_visible.filter((id) => !p.excluded.includes(id))
  return {
    kind: p.kind,
    title: world.content.get('event', p.event_id).name,
    body: rendered.body ?? '',
    ...(rendered.note !== undefined ? { note: rendered.note } : {}),
    options: ids.map((id) => {
      const c = rendered.choices?.[id]
      return { id, label: c?.label ?? id, ...(c?.benefit ? { benefit: c.benefit } : {}), ...(c?.cost ? { cost: c.cost } : {}) }
    }),
  }
}

function itemNames(world: World, uids: readonly string[]): string[] {
  return uids.map((u) => {
    const inst = world.state.item_instances[u]
    return inst ? world.content.get('item', inst.def_id).name : u
  })
}

function lifeViewOf(world: World, plan: SuccessionPlan): LifeView {
  const r = plan.record
  const byId = new Map(world.state.journal.map((e) => [e.id, e]))
  const cause = r.cause
  return {
    gen: r.gen,
    name: r.name,
    epithet: r.epithet,
    endAge: r.end_age,
    endKind: r.end_kind,
    roleName: r.retire_role ? world.content.get('retire_role', r.retire_role).name : null,
    causeText: cause ? `${world.content.get('region', cause.location).name} · ${cause.lethal_source ?? '알 수 없는 일격'}` : null,
    peakLevel: r.peak_level,
    summary: r.summary,
    relicNames: itemNames(world, r.relics_passed),
    majorLines: r.major_entry_ids.map((id) => byId.get(id)?.line).filter((l): l is string => l !== undefined).slice(-5),
  }
}

function heirViewOf(world: World, plan: SuccessionPlan, relicNames: string[]): HeirView {
  const ch = world.state.character!
  return {
    gen: ch.generation,
    name: ch.name,
    relation: ch.family_role,
    parentCall: ch.parent_call,
    traitNames: ch.traits.map((t) => world.content.get('trait', t.id).name),
    relicNames,
    coins: plan.settlement.transferred,
    capped: plan.settlement.capped,
  }
}

// 시계가 멈추면(선택 대기·계승 대기) 그 자리에서 끝낸다. 한 번에 CHUNK_SEC 씩 나눠 흘린다
function advanceBy(world: World, sec: number): void {
  let left = sec
  while (left > 0 && world.clockRunning) {
    const step = Math.min(CHUNK_SEC, left)
    const moved = world.advance(step)
    left -= step
    if (moved < step) return
  }
}

export async function play(world: World, args: DemoArgs, deps: PlayDeps): Promise<PlayResult> {
  const result: PlayResult = { lines: [], minutes: 0, lives: 0 }
  const color = !args.plain
  let lastId = 0

  const emit = (text: string): void => {
    result.lines.push(text)
    deps.write(text)
  }
  // 새 기록(id는 가문 전체 일련번호라 커지기만 한다)
  const flush = (): void => {
    const fresh = world.state.journal.filter((e: JournalEntry) => e.id > lastId).sort((a, b) => a.id - b.id)
    for (const e of fresh) {
      lastId = e.id
      emit(renderEntry(e, color))
    }
  }

  const budgetSec = args.minutes * 60
  let playedSec = 0
  while (playedSec < budgetSec && result.lives < args.gen && !deps.stopped?.()) {
    // 1. 선택 대기: 사전 방침이거나 물어볼 곳이 없으면 자동 선택
    if (world.state.pending_choice) {
      if (args.auto || !deps.ask) submitPendingAuto(world)
      else {
        const view = choiceViewOf(world)
        emit(renderChoice(view))
        const pick = await deps.ask(view)
        const chosen = view.options[pick - 1]
        if (chosen) submitChoice(world, chosen.id, world.ports)
        else submitPendingAuto(world)
      }
      flush()
      continue
    }
    // 2. 계승 대기: 생애 요약 → (남은 세대가 있으면) 계승 결과
    if (world.state.current_activity.state === 'awaiting_succession') {
      const plan = pendingSuccession(world)
      if (!plan) break
      flush()
      emit(renderLife(lifeViewOf(world, plan)))
      result.lives += 1
      if (result.lives >= args.gen) break
      const relicNames = itemNames(world, plan.relicUids)
      succeed(world)
      emit(renderHeir(heirViewOf(world, plan, relicNames)))
      flush()
      continue
    }
    // 3. 그 밖의 이유로 시계가 멈췄으면(인물 없음·멈춤) 더 볼 것이 없다
    if (!world.clockRunning) break
    // 4. 시간 흘리기
    const before = world.state.character?.eff_min ?? 0
    advanceBy(world, args.fast ? CHUNK_SEC : Math.max(1, args.speed * TICK_SEC))
    playedSec += Math.max(0, (world.state.character?.eff_min ?? before) - before) * 60
    flush()
    deps.status(statusOf(world))
    if (!args.fast) await deps.sleep(TICK_SEC * 1000)
  }
  result.minutes = playedSec / 60
  return result
}
