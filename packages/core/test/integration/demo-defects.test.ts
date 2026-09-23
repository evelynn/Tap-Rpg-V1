// 데모 검증(600분·3000분 2세대 실행)에서 나온 결함의 회귀 테스트:
// 생애 요약 카운터(12 §7.1), 가문 수첩의 발견(07 §6.5), 중상 치료 기록(14 §5.1), 계승 대기·나이 알림 저장(C31).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  COUNTERS, loadGameWorld, makeSaveRoot, pendingSuccession, sceneResolver, serializeSave, startSortie, succeed, TOWN_STEPS,
  loadSave, type ResolvedAction, type SaveBody, type World,
} from '../../src/index'
import { rollCheck } from '../../src/rules/check'
import { treatmentCost } from '../../src/economy/index'
import { baseContent, makeGame, run } from './life-fixture'

const seedOf = (n: number) => (0x7100 + n).toString(16).padStart(16, '0')

function reload(world: World): World {
  const root = makeSaveRoot(world.snapshot(), {
    app_version: '0.1.0', saved_at_utc: 1_790_000_000_000, content_packs: [], content_hash: 'x',
  })
  const loaded = loadSave(serializeSave(root), world.content)
  assert.ok(loaded.ok, loaded.ok ? '' : `${loaded.code} ${loaded.message}`)
  return loadGameWorld(world.content, JSON.parse(JSON.stringify(loaded.root.body)) as SaveBody)
}

describe('생애 요약 카운터(12 §7.1 summary.encounters·coins_earned)', () => {
  it('출정을 돌면 조우 수와 번 동전이 쌓인다', () => {
    const world = makeGame({ seed: seedOf(1) })
    run(world, { steps: 40 })
    const c = world.state.character!.counters
    assert.ok((c.encounters ?? 0) > 0, `조우 ${c.encounters}`)
    assert.ok((c.encounters ?? 0) >= (c.wins ?? 0), '조우 수는 승리 수 이상이다')
    assert.ok((c.coins_earned ?? 0) > 0, `번 동전 ${c.coins_earned}`)
  })
})

describe('가문 수첩의 발견 지점(07 §6.5, 12 §7.4)', () => {
  function discover(world: World, id: string): string {
    startSortie(world, {
      activity: 'adventure', location_id: 'A1', time_of_day: 'day', weather: 'clear', source: 'weighted', forced_nearby: false, low_cap_only: false,
    })
    world.state.current_activity.state = 'adventure'
    const route = world.content.get('region', 'A1')
    assert.equal(route.kind, 'adventure_route')
    const d = (route as { discoveries: { id: string; check: string }[] }).discoveries.find((x) => x.id === id)!
    const check = rollCheck(world, world.rng.world, { kinds: [d.check], dc: -100 })
    const action: ResolvedAction = {
      seq: 1, kind: 'scene', started_eff_min: world.state.character!.eff_min, duration_sec: 40, outcome: 'discovery',
      effects: [{ kind: 'discovery', discovery: id, ok: true, check } as unknown as { type: string }], journal: [], applied: false,
    }
    const before = world.state.journal.length
    sceneResolver.apply(world, action)
    const entry = world.state.journal.slice(before).find((e) => e.tag === 'discovery')
    assert.ok(entry, '발견 기록이 없다')
    return entry.detail ?? ''
  }

  it('처음 찾으면 가문 최초, 후손이 수첩에 적힌 지점을 다시 찾으면 가문 최초가 아니다', () => {
    const world = makeGame({ seed: seedOf(2) })
    assert.match(discover(world, 'A1-1'), /가문 최초/)
    assert.deepEqual(world.state.family.discovery_points, ['A1-1'])
    // 후손: 인물의 발견은 생애 단위(C17)라 비어 있고, 가문 수첩에는 남아 있다
    world.state.character!.discoveries = []
    const again = discover(world, 'A1-1')
    assert.doesNotMatch(again, /가문 최초/)
    assert.match(again, /수첩에 적힌/)
    assert.deepEqual(world.state.family.discovery_points, ['A1-1'])
  })
})

describe('중상 치료 기록(14 §5.1 [마을])', () => {
  function treat(world: World): { line: string; detail: string } {
    const ch = world.state.character!
    ch.injuries = [{ grade: 'serious', stat: 'str', remaining_min: 0, source: 'test' }]
    world.state.current_activity.state = 'town_idle'
    const before = world.state.journal.length
    const action = world.startAction('treatment')
    world.applyAction(action)
    const e = world.state.journal.slice(before).find((x) => x.tag === 'town')
    assert.ok(e, '치료 기록이 없다')
    return { line: e.line, detail: e.detail ?? '' }
  }

  it('유료 입원은 치료비를, 무료 치료는 무료 치료 문장을 남긴다', () => {
    const paid = makeGame({ seed: seedOf(3) })
    paid.state.character!.coins = 10_000
    const cost = treatmentCost(paid, 'serious')
    const p = treat(paid)
    assert.match(p.detail, new RegExp(`치료비로 동전 ${cost}개`))

    const free = makeGame({ seed: seedOf(3) })
    free.state.character!.coins = 0
    const f = treat(free)
    assert.notEqual(f.line, p.line)
    assert.match(f.detail, /무료 치료/)
  })
})

describe('마을 정비 묶음 기록(14 §4)', () => {
  it('한 줄은 정비에서 쓴 동전 전부를 적고, 판매·구매 내역은 펼침에 든다', () => {
    const world = makeGame({ seed: seedOf(7) })
    const ch = world.state.character!
    ch.coins = 800
    world.state.inventory.consumables = {}
    world.state.current_activity.state = 'town_idle'
    ch.counters[COUNTERS.townStep] = TOWN_STEPS.prep
    const before = ch.coins
    const start = world.state.journal.length
    world.applyAction(world.startAction('town'))
    const town = world.state.journal.slice(start).filter((e) => e.tag === 'town')
    assert.equal(town.length, 1, town.map((e) => e.line).join(' / '))
    const m = /동전 (\d+)개를 썼다/.exec(town[0]!.line)
    assert.ok(m, town[0]!.line)
    const income = [...(town[0]!.detail ?? '').matchAll(/팔았다\. 동전 (\d+)개/g)].reduce((a, x) => a + Number(x[1]), 0)
    assert.equal(Number(m[1]), before + income - ch.coins)
    assert.match(town[0]!.detail ?? '', /소모품 \d+개를 샀다/)
  })
})

describe('L11 첫눈 오는 날(11 L11, 00 D58)', () => {
  it('던전 층(지하)에서는 나오지 않고, 발자국 실패 줄은 귀환처럼 읽히지 않는다', () => {
    const ev = baseContent().get('event', 'L11')
    assert.ok(!ev.triggers.some((t) => t.startsWith('dungeon_')), ev.triggers.join(','))
    assert.ok(ev.location_match && !(ev.location_match.kinds ?? []).includes('dungeon_floor'))
    const tracks = ev.choices.find((c) => c.id === 'follow_tracks')!
    assert.equal(tracks.outcomes.failure?.line, '발자국을 놓치고 되돌아섰다')
    assert.equal(tracks.outcomes.failure?.tag, 'check')
  })
})

describe('판단 지점으로 미룬 생애 진행의 저장(CONTENT_SCHEMA §6 C31)', () => {
  it('나이 알림이 쌓인 채 저장해도 불러온 세계가 알린다', () => {
    const world = makeGame({ seed: seedOf(4) })
    const ch = world.state.character!
    const mpy = world.content.balance.time.min_per_year
    // 다음 해 직전까지 옮겨 두고 나이가 오르는 순간까지만 흘린다(행동은 아직 끝나지 않는다)
    ch.eff_min = mpy - 0.01
    world.advance(1)
    const pending = world.state.current_activity.life_loop.age_ticks.length
    assert.ok(pending > 0, '나이 알림이 쌓이지 않았다')
    const loaded = reload(world)
    assert.equal(loaded.state.current_activity.life_loop.age_ticks.length, pending)
    // 이어 진행하면 중단 없이 진행한 세계와 같은 나이 기록을 남긴다
    world.advance(120)
    loaded.advance(120)
    assert.equal(loaded.state.current_activity.life_loop.age_ticks.length, 0)
    const ages = (w: World) => w.state.journal.filter((e) => e.sub === 'age').map((e) => e.line)
    assert.deepEqual(ages(loaded), ages(world))
  })

  it('계승 대기로 저장해도 불러온 세계에서 계승할 수 있다', () => {
    const world = makeGame({ seed: seedOf(5) })
    const ch = world.state.character!
    const t = world.content.balance.time
    ch.eff_min = (ch.retire_age - t.start_age) * t.min_per_year - 1
    run(world, { steps: 200 })
    assert.equal(world.state.current_activity.state, 'awaiting_succession')
    assert.ok(pendingSuccession(world))
    const loaded = reload(world)
    assert.ok(pendingSuccession(loaded), '계승 계획이 저장에서 사라졌다')
    const heir = succeed(loaded)
    assert.equal(heir.generation, 2)
    assert.equal(loaded.state.current_activity.state, 'town_idle')
  })

  it('이 칸이 없던 저장도 빈 값으로 읽는다', () => {
    const world = makeGame({ seed: seedOf(6) })
    const body = world.snapshot() as unknown as { current_activity: Record<string, unknown>; family: Record<string, unknown> }
    delete body.current_activity.life_loop
    delete body.family.discovery_points
    const root = makeSaveRoot(body as unknown as SaveBody, {
      app_version: '0.1.0', saved_at_utc: 1_790_000_000_000, content_packs: [], content_hash: 'x',
    })
    const loaded = loadSave(serializeSave(root), baseContent())
    assert.ok(loaded.ok, loaded.ok ? '' : `${loaded.code} ${loaded.message}`)
    assert.deepEqual(loaded.root.body.current_activity.life_loop, { age_ticks: [], pending_end: null, succession: null })
    assert.deepEqual(loaded.root.body.family.discovery_points, [])
  })
})
