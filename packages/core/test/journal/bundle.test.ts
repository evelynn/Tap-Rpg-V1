// 일지 묶음(14 §4)과 "동전 0개" 문형, 보물 상자 획득 나이. 묶음은 출정 칸(C32)에 두었다가 닫힐 때 기록 1개가 된다.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  addJournal, addToBundle, closeBundle, COUNTERS, encounterJournal, loadGameWorld, loadSave, makeSaveRoot, roomResolver,
  serializeSave, startSortie, TOWN_STEPS, type EncounterOutcome, type EncounterSpec, type SaveBody, type World,
} from '../../src/index'
import { makeGame } from '../integration/life-fixture'

function sortieAt(world: World, kind: 'hunting_ground' | 'dungeon_floor'): string {
  const place = world.content.list('region').find((r) => r.kind === kind)!.id
  startSortie(world, {
    activity: kind === 'dungeon_floor' ? 'dungeon' : 'hunt', location_id: place, time_of_day: 'day', weather: 'clear',
    source: 'weighted', forced_nearby: false, low_cap_only: false,
  })
  return place
}

const win = (n: number, coins = 5) => ({ tag: 'hunt' as const, single: { tag: 'hunt' as const, line: `들쥐를 쫓아냈다 ${n}` }, coins, depth: 0, row: `여울 들쥐 · ${n}라운드` })
const room = (depth: number) => ({ tag: 'dungeon' as const, single: { tag: 'dungeon' as const, line: `${depth}번째 방의 문을 열었다` }, coins: 0, depth, row: `코볼트 · ${depth}라운드` })
const fresh = (world: World, from: number) => world.state.journal.slice(from)

describe('사냥 조우 묶음(14 §4: 같은 사냥터 연속 10회 또는 출정 종료)', () => {
  it('10회가 차면 기록 1개(묶음 문형 + 펼침 10줄)로 닫는다', () => {
    const w = makeGame()
    const place = sortieAt(w, 'hunting_ground')
    const from = w.state.journal.length
    for (let i = 1; i <= 9; i++) addToBundle(w, win(i, i))
    assert.equal(fresh(w, from).length, 0, '9회까지는 아직 남기지 않는다')
    addToBundle(w, win(10, 10))
    const got = fresh(w, from)
    assert.equal(got.length, 1)
    assert.equal(got[0]!.bundle_count, 10)
    assert.equal(got[0]!.line, '10번 싸워 동전 55개를 모았다')
    const detail = got[0]!.detail!.split('\n')
    assert.equal(detail[0], `${w.content.get('region', place).name}에서 10번 싸웠다. 동전 55개를 모았다.`)
    assert.equal(detail.length, 11, '문장 + 개별 내역 10줄')
    assert.equal(got[0]!.importance, 'daily', '묶음은 첫 기록으로 올리지 않는다')
    assert.equal(w.state.current_activity.sortie!.journal_bundle, undefined)
  })

  it('중요도 B 이상 기록이 오면 그때까지를 먼저 닫고, C 기록은 묶음을 닫지 않는다', () => {
    const w = makeGame()
    sortieAt(w, 'hunting_ground')
    const from = w.state.journal.length
    addToBundle(w, win(1))
    addToBundle(w, win(2))
    addJournal(w, { tag: 'check', line: '풀숲에서 약초를 찾았다' }) // C
    addToBundle(w, win(3))
    addJournal(w, { tag: 'gear', line: '짧은 검을 손에 넣었다' }) // B
    addToBundle(w, win(4))
    addJournal(w, { tag: 'growth', line: '몸이 가벼워졌다. 레벨 3이 되었다' }) // B
    assert.deepEqual(fresh(w, from).map((e) => [e.tag, e.line, e.bundle_count]), [
      ['check', '풀숲에서 약초를 찾았다', undefined],
      ['hunt', '3번 싸워 동전 15개를 모았다', 3],
      ['gear', '짧은 검을 손에 넣었다', undefined],
      ['hunt', '들쥐를 쫓아냈다 4', undefined], // 1회로 닫히면 개별 기록 그대로
      ['growth', '몸이 가벼워졌다. 레벨 3이 되었다', undefined],
    ])
  })

  it('동전을 하나도 얻지 못한 묶음은 "동전 0개"를 쓰지 않는다', () => {
    const w = makeGame()
    sortieAt(w, 'hunting_ground')
    const from = w.state.journal.length
    addToBundle(w, win(1, 0))
    addToBundle(w, win(2, 0))
    closeBundle(w)
    const [e] = fresh(w, from)
    assert.equal(e!.line, '2번 싸웠지만 동전은 줍지 못했다')
    assert.doesNotMatch(e!.detail!, /동전 0개/)
  })

  it('귀환(출정 종료)하면 열린 묶음을 마을 기록보다 먼저 남긴다', () => {
    const w = makeGame()
    sortieAt(w, 'hunting_ground')
    w.state.current_activity.state = 'return'
    addToBundle(w, win(1))
    addToBundle(w, win(2))
    const from = w.state.journal.length
    w.applyAction(w.startAction('travel'))
    const got = fresh(w, from)
    assert.equal(got[0]!.bundle_count, 2, got.map((e) => e.line).join(' / '))
    assert.equal(w.state.current_activity.sortie?.journal_bundle, undefined)
  })

  it('열린 묶음은 저장·불러오기 뒤에도 이어진다(C32)', () => {
    const w = makeGame()
    sortieAt(w, 'hunting_ground')
    addToBundle(w, win(1))
    addToBundle(w, win(2))
    const root = makeSaveRoot(w.snapshot(), { app_version: '0.1.0', saved_at_utc: 1_790_000_000_000, content_packs: [], content_hash: 'x' })
    const loaded = loadSave(serializeSave(root), w.content)
    assert.ok(loaded.ok, loaded.ok ? '' : `${loaded.code} ${loaded.message}`)
    const back = loadGameWorld(w.content, JSON.parse(JSON.stringify(loaded.root.body)) as SaveBody)
    assert.equal(back.state.current_activity.sortie!.journal_bundle!.count, 2)
    const from = back.state.journal.length
    closeBundle(back)
    assert.equal(fresh(back, from)[0]!.bundle_count, 2)
  })

  it('실제 사냥 출정에서 같은 승리 문장이 연달아 나오지 않고, 묶음은 10회를 넘지 않는다', () => {
    const w = makeGame()
    sortieAt(w, 'hunting_ground')
    w.state.current_activity.state = 'hunt'
    for (let i = 0; i < 400 && w.state.current_activity.sortie; i++) {
      if (w.state.pending_choice) break
      w.advance(60)
    }
    const hunt = w.state.journal.filter((e) => e.tag === 'hunt')
    assert.ok(hunt.some((e) => (e.bundle_count ?? 0) >= 2), '묶음 기록이 있다')
    assert.ok(hunt.every((e) => (e.bundle_count ?? 1) <= 10))
    const all = w.state.journal
    for (let i = 1; i < all.length; i++) {
      if (all[i]!.tag !== 'hunt' || all[i - 1]!.tag !== 'hunt' || all[i]!.bundle_count) continue
      assert.notEqual(all[i]!.line, all[i - 1]!.line, `연속 같은 한 줄: ${all[i]!.line}`)
    }
  })
})

describe('던전 전투 방 묶음(14 §4: 연속 전투 방 3개까지)', () => {
  it('전투 방 3개면 "3개의 방을 지나 더 내려갔다", 비전투 방 기록([던전])이 오면 연속이 끊긴다', () => {
    const w = makeGame()
    sortieAt(w, 'dungeon_floor')
    const from = w.state.journal.length
    addToBundle(w, room(1))
    addToBundle(w, room(2))
    addToBundle(w, room(3))
    addToBundle(w, room(4))
    addToBundle(w, room(5))
    addJournal(w, { tag: 'dungeon', line: '6번째 방의 문을 열었다' })
    addToBundle(w, room(7))
    addJournal(w, { tag: 'dungeon', line: '관문 앞에서 발길을 돌렸다.' })
    assert.deepEqual(fresh(w, from).map((e) => [e.line, e.bundle_count]), [
      ['3개의 방을 지나 더 내려갔다', 3],
      ['2개의 방을 지나 더 내려갔다', 2],
      ['6번째 방의 문을 열었다', undefined],
      ['7번째 방의 문을 열었다', undefined],
      ['관문 앞에서 발길을 돌렸다.', undefined],
    ])
    assert.equal(fresh(w, from)[0]!.detail!.split('\n')[0], '모라는 3개의 방을 지나 3번째 방에 닿았다.')
  })
})

describe('연속 휴식 묶음(14 §4: 첫 휴식 문장만)', () => {
  it('같은 장소의 휴식이 이어지면 첫 기록 하나에 합치고, 장소가 다르거나 사이에 기록이 있으면 따로 남긴다', () => {
    const w = makeGame()
    const town = w.state.character!.location
    const from = w.state.journal.length
    addJournal(w, { tag: 'rest', line: '여관 창가 자리에서 푹 쉬었다', refs: { location_id: town } })
    addJournal(w, { tag: 'rest', line: '따뜻한 수프를 먹고 일찍 잤다', refs: { location_id: town } })
    let got = fresh(w, from)
    assert.equal(got.length, 1)
    assert.equal(got[0]!.line, '여관 창가 자리에서 푹 쉬었다')
    assert.equal(got[0]!.bundle_count, 2)
    assert.equal(got[0]!.detail, `${w.content.get('region', town).name}에서 쉬었다. 기운이 돌아왔다.`)
    addJournal(w, { tag: 'town', line: '정비를 마쳤다. 동전은 쓰지 않았다' })
    addJournal(w, { tag: 'rest', line: '여관 이불을 덮고 곯아떨어졌다', refs: { location_id: town } })
    got = fresh(w, from)
    assert.equal(got.length, 3)
    // 첫 휴식이 묶음이 되었어도 다음 휴식을 또 첫 기록으로 올리지 않는다(14 §2)
    assert.equal(got[2]!.importance, 'daily')
  })
})

describe('동전 0개 문형(14 §4·§5.1)', () => {
  it('동전 없이 이긴 조우의 상세는 동전 구절을 뺀다', () => {
    const w = makeGame()
    const place = sortieAt(w, 'hunting_ground')
    const r = w.content.get('region', place)
    const enemy = r.kind === 'hunting_ground' ? r.encounters[0]!.enemy_id : ''
    const spec: EncounterSpec = { place, enemies: [{ id: enemy }], activity: 'hunt', dropTable: 'hunt' }
    const out = { combat: { outcome: 'win', rewards: [{ coins: 0 }] } } as unknown as EncounterOutcome
    const [d] = encounterJournal(w, spec, out)
    assert.doesNotMatch(d!.detail!, /동전/)
    assert.match(d!.detail!, /쫓아냈다\.$/)
  })

  it('정비에서 쓴 동전이 없으면 "동전은 쓰지 않았다"', () => {
    const w = makeGame()
    const ch = w.state.character!
    ch.coins = 0
    w.state.current_activity.state = 'town_idle'
    ch.counters[COUNTERS.townStep] = TOWN_STEPS.prep
    const from = w.state.journal.length
    w.applyAction(w.startAction('town'))
    const prep = fresh(w, from).find((e) => e.line.startsWith('정비를 마쳤다'))!
    assert.equal(prep.line, '정비를 마쳤다. 동전은 쓰지 않았다')
  })
})

describe('보물 상자 장비의 획득 나이(16 §5 item.acquired.age)', () => {
  it('상자에서 나온 장비는 지금 나이로 적는다(0이 아니다)', () => {
    const w = makeGame()
    const place = sortieAt(w, 'dungeon_floor')
    const time = w.content.balance.time
    const ch = w.state.character!
    ch.eff_min = 12 * time.min_per_year // 시작 나이 + 12세
    const s = w.state.current_activity.sortie!
    s.plan = { rooms: ['treasure', 'combat'], gate: true }
    w.state.current_activity.state = 'dungeon'
    const item = w.content.list('item').find((i) => !i.unique && !i.cursed)!
    const payload = { kind: 'treasure', vein: false, opened: true, coins: 0, material: null, drop: { def_id: item.id, grade: 'common', effects: [] }, checks: [], effects: [] }
    roomResolver.apply(w, { seq: 1, kind: 'room', started_eff_min: ch.eff_min, duration_sec: 1, outcome: 'treasure', effects: [payload], journal: [], applied: false } as never)
    const uid = s.loot.item_uids[0]!
    assert.equal(w.state.item_instances[uid]!.acquired.age, time.start_age + 12)
    assert.equal(w.state.item_instances[uid]!.acquired.location, place)
  })
})
