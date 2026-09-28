// 통합: 기반 팩 번들로 만든 World의 사건 포트가 실제 전투·장비·경제 구현을 부른다(sim/services.ts).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createItemInstance, equipItem, maxHp, runEvent, STATS, submitChoice } from '../../src/index'
import { makeWorld, type TestWorld } from '../events/fixture'

const SEED = 'a1b2c3d4e5f60718'

// 장소를 옮기고(조건 평가 문맥까지) 레벨을 맞춘 인물
function at(tw: TestWorld, place: string, level: number) {
  const ch = tw.w.state.character!
  tw.scope.place = place
  ch.location = place
  ch.level = level
  ch.hp = maxHp(tw.w)
  return ch
}

// 보류 중인 선택 창의 상태(선택을 넣기 전에 찍어 둔다)
const heldState = (tw: TestWorld) => ({
  kind: tw.w.state.pending_choice?.kind ?? null,
  choices: tw.w.state.pending_choice?.choices_visible ?? [], // 고를 수 있는 선택지(별빛 길은 비추기 전에는 없다, D78)
  activity: tw.w.state.current_activity.state,
  clockRunning: tw.w.clockRunning,
})

// 그 단계 장비를 입히고 능력치를 맞춘다(시작 지급 장비로는 전투가 라운드 상한에 걸린다)
function arm(tw: TestWorld, gear: readonly [string, 'rare'][]): void {
  const ch = tw.w.state.character!
  for (const st of STATS) ch.stats[st] = 14
  for (const [id, grade] of gear) {
    const inst = createItemInstance(tw.w.content, tw.w.state, id, grade, {
      gen: ch.generation, char_uid: ch.uid, age: 20, location: ch.location, source: 'test',
    })
    equipItem(tw.w, inst.uid)
  }
  ch.hp = maxHp(tw.w)
}

// (a) 선택지 전투: L07 `먼저 가서 쫓아낸다` — by_location 적 + 공포 사전 판정 + 보상 ×1.5
function driveOffWolves(seed = SEED) {
  const tw = makeWorld(seed)
  const ch = at(tw, 'H2', 12)
  arm(tw, [['W06', 'rare'], ['A05', 'rare']])
  const before = { coins: ch.coins, hp: ch.hp, combatRng: tw.w.rng.combat.toState() }
  const res = runEvent(tw.w, 'L07', { place: 'H2', choiceId: 'drive_off', force: true }, tw.w.ports)
  return { tw, ch, res, before }
}

// (a2) 효과 안의 전투: C02-2 `불을 피워 신호한다` 실패 → start_combat
function whistleFire(seed = SEED) {
  const tw = makeWorld(seed)
  const ch = at(tw, 'H2', 1)
  ch.flags['life.c02_stage'] = 1
  const before = { hp: ch.hp, combatRng: tw.w.rng.combat.toState() }
  const res = runEvent(tw.w, 'C02-2', { place: 'H2', choiceId: 'fire', force: true }, tw.w.ports)
  return { tw, ch, res, before }
}

// (b) 장비·경제: C02-3 add_item, L02 `부르는 값에 산다` offer_purchase
function townGear(seed = SEED) {
  const tw = makeWorld(seed)
  const ch = at(tw, 'T00', 6)
  ch.flags['life.c02_stage'] = 2
  ch.fatigue = 60
  const gift = runEvent(tw.w, 'C02-3', { place: 'T00' }, tw.w.ports)
  ch.coins = 2000
  const buy = runEvent(tw.w, 'L02', { place: 'T00', choiceId: 'buy' }, tw.w.ports)
  return { tw, ch, gift, buy }
}

// (c) 연속 사건 C01 1 → 2 → 3(중대 분기 보류 → 선택)
function chainC01(seed = SEED) {
  const tw = makeWorld(seed)
  const ch = at(tw, 'D1', 12)
  const s1 = runEvent(tw.w, 'C01-1', { place: 'D1', choiceId: 'keep' }, tw.w.ports)
  const stage1 = ch.flags['life.c01_stage']
  at(tw, 'T00', 12)
  const s2 = runEvent(tw.w, 'C01-2', { place: 'T00', choiceId: 'give_back' }, tw.w.ports)
  const stage2 = ch.flags['life.c01_stage']
  at(tw, 'D2', 12)
  const s3 = runEvent(tw.w, 'C01-3', { place: 'D2' }, tw.w.ports)
  const held = heldState(tw)
  const owned = tw.w.state.inventory.bag.length + tw.w.state.inventory.pending_box.length
  const s4 = submitChoice(tw.w, 'treasure', tw.w.ports)
  return { tw, ch, s1, s2, s3, s4, stage1, stage2, held, owned }
}

// (d) 운명 사건 F03: 보류 → 선택 → 결과(add_item R04)
function fateF03(seed = SEED) {
  const tw = makeWorld(seed)
  const ch = at(tw, 'A4', 24)
  const res = runEvent(tw.w, 'F03', { place: 'A4', force: true }, tw.w.ports)
  const held = heldState(tw)
  const done = submitChoice(tw.w, 'decline', tw.w.ports)
  return { tw, ch, res, held, done }
}

const ownedDefs = (tw: TestWorld) =>
  [...tw.w.state.inventory.bag, ...tw.w.state.inventory.pending_box].map((u) => tw.w.state.item_instances[u]!.def_id)

describe('사건 포트 통합(기반 팩)', () => {
  it('(a) 선택지 전투가 실제 전투로 치러진다 — 적 보상·성장·판정', () => {
    const { tw, ch, res, before } = driveOffWolves()
    assert.equal(res?.outcome, 'win')
    // 전투가 실제로 돌았다: combat 흐름이 소비됐다(공포 사전 판정 + 라운드 주사위)
    assert.notDeepEqual(tw.w.rng.combat.toState(), before.combatRng)
    assert.ok(ch.hp <= before.hp && ch.hp > 0, '전투 뒤 체력이 반영된다')
    assert.equal(ch.counters.wins, 1)
    assert.deepEqual(ch.defeated, ['EN03'])
    // 적 보상은 사건 전투가 준다. reward_mult 1.5가 걸린다
    assert.equal(ch.coins - before.coins, Math.floor(tw.w.content.get('enemy', 'EN03').coins * 1.5))
    assert.ok(ch.xp > 0, '적 경험치를 받는다')
    // 판정·공격이 성장 누적을 남긴다(05 §4.1·§5.1)
    assert.ok(Object.values(ch.stat_use_points).some((v) => v > 0))
  })

  it('(a2) start_combat 효과도 같은 포트로 전투를 치른다', () => {
    const { tw, ch, res, before } = whistleFire()
    assert.equal(res?.outcome, 'failure')
    assert.notDeepEqual(tw.w.rng.combat.toState(), before.combatRng, '실패 갈래의 start_combat이 전투를 돌린다')
    assert.ok(ch.hp < before.hp, '늑대에게 맞았다')
    assert.equal(ch.flags['life.c02_stage'], 2)
  })

  it('(b) add_item·offer_purchase가 가방·장착·소지금을 바꾼다', () => {
    const { tw, ch, gift, buy } = townGear()
    assert.equal(gift?.outcome, 'always')
    assert.ok(ownedDefs(tw).includes('J01'), 'C02-3이 J01을 준다')
    assert.equal(ch.fatigue, 0, 'add_fatigue −100은 초기화다')
    assert.equal(tw.w.state.family.flags['fam.c02_done'], true)

    assert.ok(buy)
    assert.ok(ch.coins < 2000, '특가 구매로 동전이 줄었다')
    const equipped = Object.values(tw.w.state.inventory.equipped).filter((u): u is string => u !== null)
    assert.ok(equipped.some((u) => tw.w.state.item_instances[u]!.acquired.source === 'shop'), '산 장비를 바로 장착한다')
  })

  it('(c) 연속 사건 C01 1→2→3: 단계 플래그 → 중대 분기 보류 → end_chain', () => {
    const { tw, ch, s1, s2, s3, s4, stage1, stage2, held, owned } = chainC01()
    assert.equal(s1?.outcome, 'always')
    assert.equal(stage1, 1)
    assert.equal(s2?.outcome, 'always')
    assert.equal(stage2, 2)
    // 중대 분기(hold branch)는 선택 대기로 넘어가고 시계가 멈춘다
    assert.equal(s3?.held, true)
    assert.equal(s3?.choice_id, null)
    assert.equal(held.kind, 'branch')
    assert.equal(held.activity, 'awaiting_choice')
    assert.equal(held.clockRunning, false)
    assert.deepEqual(held.choices, ['rescue', 'treasure', 'guild'])
    // 선택 뒤: 줄기 완료 플래그 + add_random_item 1개
    assert.equal(s4.choice_id, 'treasure')
    assert.equal(tw.w.state.pending_choice, null)
    assert.equal(ch.flags['life.c01_stage'], tw.w.content.get('chain', 'C01').stages)
    assert.equal(tw.w.state.family.flags['fam.c01_done'], true)
    assert.equal(tw.w.state.family.flags['fam.c01_treasure'], true)
    assert.equal(tw.w.state.inventory.bag.length + tw.w.state.inventory.pending_box.length, owned + 1)
    assert.equal(tw.w.clockRunning, true)
  })

  it('(d) 운명 사건 F03: 보류 중 시계 정지 → 거절 → R04 획득', () => {
    const { tw, ch, res, held, done } = fateF03()
    assert.equal(res?.held, true)
    assert.equal(held.kind, 'fate')
    assert.equal(held.clockRunning, false)
    assert.deepEqual(held.choices, ['accept', 'decline', 'ask'])

    assert.equal(done.choice_id, 'decline')
    assert.equal(tw.w.state.pending_choice, null)
    assert.ok(ownedDefs(tw).includes('R04'), '거절하면 성주가 잔을 두고 간다')
    assert.equal(tw.w.state.family.flags['fam.f03_refused'], true)
    assert.equal(ch.mutation, null, '거절은 변이를 일으키지 않는다')
  })

  it('같은 시드면 모든 갈래가 같은 결과다', () => {
    for (const run of [driveOffWolves, whistleFire, townGear, chainC01, fateF03]) {
      assert.deepEqual(run(SEED).tw.w.snapshot(), run(SEED).tw.w.snapshot(), run.name)
    }
  })
})
