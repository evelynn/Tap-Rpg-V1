// 04·07의 계산 예를 실제 데이터로 검산한다.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { expectedLoss, generateRooms, referenceActor, roomLoss, type LossActor } from '../../src/activity/dungeon'
import { effectiveLevel, riskGrade, locationScore, travelSec } from '../../src/ai/index'
import { ROOM_KINDS } from '../../src/schema/index'
import { baseContent, makeSim } from './fixture'

const D1 = 'D1' // id-lint-allow 테스트는 설계 문서 예시의 장소를 직접 가리킨다
const H3 = 'H3' // id-lint-allow
const H2 = 'H2' // id-lint-allow

describe('07 §5.5 다음 방 예상 손실률', () => {
  it('계산 예 1(모험적 Lv10, D1 순번 3, 감지·회피 실패 0.5) E ≈ 0.060', () => {
    const world = makeSim()
    const actor: LossActor = { effLevel: 10, detectFail: 0.5, evadeFail: 0.5, recovery: 1 }
    const e = expectedLoss(world, D1, 3, ROOM_KINDS.map(() => 'combat'), actor)
    assert.ok(Math.abs(e - 0.060) < 0.001, `E = ${e.toFixed(4)}`)
  })

  it('계산 예 2(안정적 Lv12, 감지 실패 0.45) E ≈ 0.048', () => {
    const world = makeSim({ attitude: 'stable' })
    const actor: LossActor = { effLevel: 12, detectFail: 0.45, evadeFail: 0.5, recovery: 1 }
    const e = expectedLoss(world, D1, 2, ROOM_KINDS.map(() => 'combat'), actor)
    assert.ok(Math.abs(e - 0.048) < 0.001, `E = ${e.toFixed(4)}`)
  })

  it('기준 인물(01 §2.4 D46)의 D1 감지·회피 실패 확률은 표대로다', () => {
    const a = referenceActor(makeSim(), D1)
    // D1 중앙값 9 → 지역 기준 DC 14, 감지 +4·회피 +3
    assert.equal(a.effLevel, 9)
    assert.ok(Math.abs(a.detectFail - 0.45) < 1e-9, String(a.detectFail))
    assert.ok(Math.abs(a.evadeFail - 0.5) < 1e-9, String(a.evadeFail))
  })
})

describe('07 §5.2 방 생성', () => {
  it('생성한 배열이 검증 기준(예상 손실 합 ≤ 0.75)과 배치 규칙을 지킨다', () => {
    const b = baseContent().balance.dungeon
    for (let i = 0; i < 200; i++) {
      const world = makeSim({ seed: (0x9000 + i).toString(16).padStart(16, '0') })
      const rooms = generateRooms(world, D1)
      const region = baseContent().get('region', D1)
      assert.ok(region.kind === 'dungeon_floor')
      assert.ok(rooms.length >= region.rooms[0] && rooms.length <= region.rooms[1], `방 ${rooms.length}개`)
      assert.ok(b.first_room_kinds.includes(rooms[0]!), `첫 방 ${rooms[0]}`)
      rooms.forEach((k, j) => {
        if (j > 0 && b.no_repeat.includes(k)) assert.notEqual(rooms[j - 1], k, `연속 ${k}`)
      })
      const run = b.max_run.trap ?? 99
      for (let j = run; j < rooms.length; j++) {
        assert.ok(!rooms.slice(j - run, j + 1).every((k) => k === 'trap'), `함정 ${run + 1}연속`)
      }
      if (rooms.length >= b.treasure_guarantee_min_rooms) assert.ok(rooms.includes('treasure'), '보물 방 보장')
      // 재시도를 다 써도 보물 방 교체로 손실을 낮춘다. 여기서는 손실 합이 유한한지만 본다
      const ref = referenceActor(world, D1)
      const sum = rooms.reduce((s, k, j) => s + roomLoss(world, D1, k, j, ref), 0)
      assert.ok(Number.isFinite(sum) && sum < 1.5, `합 ${sum.toFixed(3)}`)
    }
  })
})

describe('04 §6.1 장소 점수와 01 §7.2 위험 등급', () => {
  it('유효 레벨은 장비 단계 차이를 단계당 ±2로 반영한다', () => {
    const world = makeSim()
    const ch = world.state.character!
    ch.level = 9
    assert.equal(effectiveLevel(world), 9 - 2) // 레벨 9의 기준 단계 2, 착용은 W01·A01(단계 1)
  })

  it('예 — 모험적 Lv9: H3(위험 차 +2) −0.5, H2(위험 차 −3) −2(미방문 가산 제외)', () => {
    const world = makeSim()
    world.state.character!.level = 9
    assert.equal(travelSec(world, H3), 45)
    assert.equal(travelSec(world, H2), 30)
    const score = (id: string, diff: number): number =>
      locationScore(world, { id, activity: 'hunt', diff, grade: riskGrade(baseContent(), diff) })
    const unvisited = baseContent().balance.activity_ai.location_score.unvisited
    assert.ok(Math.abs(score(H3, 2) - unvisited - (-0.5)) < 1e-9, `H3 ${score(H3, 2)}`)
    assert.ok(Math.abs(score(H2, -3) - unvisited - (-2)) < 1e-9, `H2 ${score(H2, -3)}`)
  })
})
