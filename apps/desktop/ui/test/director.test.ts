import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { direct, dropShown, type ActView } from '../src/director'
import { DICE_FACE_MS, DICE_ROLL_MS, DiceTracker, diceCell, diceWorthy } from '../src/props'

const view = (v: Partial<ActView>): ActView => ({
  state: 'town_idle', seq: 1, kind: null, part: null, progress: 0.5, outcome: null, enemyFamily: null, endKind: null, drop: null, ...v,
})

describe('행동 상태 → 동작(03 §15)', () => {
  it('이동은 오른쪽을 보고 걸으며 배경이 왼쪽으로 흐르고, 귀환은 반대다', () => {
    assert.deepEqual(direct(view({ state: 'travel', kind: 'travel' }), 0), { hero: 'walk', flip: false, enemy: null, scroll: 1 })
    assert.deepEqual(direct(view({ state: 'return', kind: 'travel' }), 0), { hero: 'walk', flip: true, enemy: null, scroll: -1 })
  })

  it('마을·정비·야영·치료·대기 상태', () => {
    assert.equal(direct(view({ state: 'town_idle', kind: 'town' }), 5000).hero, 'idle')
    assert.equal(direct(view({ state: 'town_idle', kind: 'town' }), 12000).hero, 'discover') // 가끔 게시판
    assert.equal(direct(view({ state: 'town_idle', kind: 'inn' }), 0).hero, 'sleep')
    assert.equal(direct(view({ state: 'town_prep', kind: 'town' }), 0).hero, 'interact')
    assert.equal(direct(view({ state: 'camp', progress: 0.2 }), 0).hero, 'sit_eat')
    assert.equal(direct(view({ state: 'camp', progress: 0.8 }), 0).hero, 'sleep')
    assert.equal(direct(view({ state: 'treatment' }), 0).hero, 'sleep')
    assert.equal(direct(view({ state: 'awaiting_choice' }), 0).hero, 'wait_book')
    assert.equal(direct(view({ state: 'awaiting_succession', endKind: 'retired' }), 0).hero, 'sit_eat')
    assert.equal(direct(view({ state: 'awaiting_succession', endKind: 'died' }), 0).hero, null) // 사망은 캐릭터 없음
  })

  it('활동 안 결과 조각', () => {
    assert.deepEqual(direct(view({ state: 'hunt', kind: 'travel' }), 0).scroll, 1)
    assert.equal(direct(view({ state: 'adventure', kind: 'scene', part: 'discovery' }), 0).hero, 'discover')
    assert.equal(direct(view({ state: 'adventure', kind: 'scene', part: 'path' }), 0).hero, 'walk')
    assert.equal(direct(view({ state: 'dungeon', kind: 'room', part: 'treasure' }), 0).hero, 'interact')
    assert.equal(direct(view({ state: 'dungeon', kind: 'room', part: 'rest' }), 0).hero, 'sit_eat')
  })

  it('조우: 적이 걸어 들어오고, 공격·피격을 주고받고, 이기면 적이 달아나고 전리품을 줍는다', () => {
    const fight = (progress: number, t: number, outcome = 'win') =>
      direct(view({ state: 'hunt', kind: 'encounter', part: 'encounter', enemyFamily: 'wolf', progress, outcome, seq: 7 }), t)
    assert.deepEqual(fight(0.05, 0).enemy, { family: 'wolf', motion: 'move', key: 7 })
    assert.equal(fight(0.5, 0).hero, 'attack')
    assert.equal(fight(0.5, 500).enemy?.motion, 'hit')
    assert.equal(fight(0.5, 1500).hero, 'hit')
    assert.equal(fight(0.5, 1500).enemy?.motion, 'attack')
    assert.equal(fight(0.9, 0).hero, 'interact')
    assert.equal(fight(0.9, 0).enemy?.motion, 'exit')
    assert.equal(fight(0.9, 0, 'defeat').hero, 'collapse')
  })
})

describe('소품 연출(03 §15, D76)', () => {
  it('꾸러미는 이긴 전투의 결말에 장비가 떨어졌을 때만', () => {
    const fight = { state: 'hunting', enemyFamily: 'rat', outcome: 'win', progress: 0.9 }
    assert.equal(dropShown(view({ ...fight, drop: 'common' })), true)
    assert.equal(dropShown(view({ ...fight, drop: null })), false)
    assert.equal(dropShown(view({ ...fight, drop: 'rare', progress: 0.5 })), false, '싸우는 중에는 없다')
    assert.equal(dropShown(view({ ...fight, drop: 'rare', outcome: 'fled' })), false)
  })
  it('주사위는 최후 판정·운명·연속 사건 판정에서만, 굴림 0.72초 → 결과 면 1.3초 → 사라짐', () => {
    const chk = (result: string) => ({ dice: 12, parts: [], total: 14, dc: 12, result }) as never
    assert.equal(diceWorthy({ check: chk('success'), sub: 'final_check' }), true)
    assert.equal(diceWorthy({ check: chk('success'), refs: { event_id: 'F02' } }), true)
    assert.equal(diceWorthy({ check: chk('success'), refs: { event_id: 'C01-2' } }), true)
    assert.equal(diceWorthy({ check: chk('success'), refs: { event_id: 'L01' } }), false, '일상 판정은 아니다')
    assert.equal(diceWorthy({ sub: 'final_check' }), false)
    assert.equal(diceCell(0, true), 0)
    assert.equal(diceCell(95, true), 1)
    assert.equal(diceCell(DICE_ROLL_MS, true), 2)
    assert.equal(diceCell(DICE_ROLL_MS, false), 3, '실패는 금 간 면')
    assert.equal(diceCell(10, false, true), 3, '움직임 줄이기면 결과 면만')
    assert.equal(diceCell(DICE_ROLL_MS + DICE_FACE_MS, true), null)
    const t = new DiceTracker()
    t.push({ check: chk('partial'), refs: { event_id: 'F01' } }, 1000)
    assert.equal(t.cell(1000 + DICE_ROLL_MS + 10), 2, '부분 성공은 밝은 면')
    assert.equal(t.cell(1000 + DICE_ROLL_MS + DICE_FACE_MS), null)
  })
})
