// 무정지 순환과 결정성(17 §4 단계 2), 은퇴 경계(04 §11).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { loadActivityWorld } from '../../src/activity/index'
import { ageAt } from '../../src/time/index'
import { baseContent, makeSim, runMinutes } from './fixture'

const ATTITUDES = ['stable', 'adventurous', 'challenging']

describe('무정지 순환', () => {
  for (const attitude of ATTITUDES) {
    it(`${attitude} 10생애 × 600분에서 멈춤 0·예외 0`, () => {
      for (let i = 0; i < 10; i++) {
        const world = makeSim({ attitude, seed: (0x1000 + i).toString(16).padStart(16, '0') })
        const r = runMinutes(world, 600)
        assert.equal(r.stalls, 0, `${attitude} #${i} 멈춤 ${r.stalls}`)
        assert.ok(r.minutes > 0)
      }
    })
  }

  it('같은 시드 → 같은 일지', () => {
    const a = makeSim()
    const b = makeSim()
    runMinutes(a, 120)
    runMinutes(b, 120)
    assert.deepEqual(a.snapshot(), b.snapshot())
  })

  it('저장을 복제해 이어 가도 결과가 같다(13 §8.3)', () => {
    const a = makeSim({ attitude: 'challenging' })
    runMinutes(a, 40)
    const saved = a.snapshot()
    const b = loadActivityWorld(baseContent(), JSON.parse(JSON.stringify(saved)) as typeof saved, {
      onLifeEnd: (w) => {
        w.state.current_activity.state = 'awaiting_succession'
      },
    })
    runMinutes(a, 60)
    runMinutes(b, 60)
    assert.deepEqual(a.snapshot(), b.snapshot())
  })
})

describe('은퇴 경계(04 §11, 09 §2)', () => {
  it('은퇴 나이에 닿으면 새 출정을 잡지 않고 생애 종료를 알린다', () => {
    const world = makeSim()
    const ch = world.state.character!
    const time = baseContent().balance.time
    // 은퇴 한 해 전으로 보낸다
    ch.eff_min = (ch.retire_age - time.start_age - 1) * time.min_per_year
    const r = runMinutes(world, 60)
    const ended = world.state.current_activity.state
    assert.ok(r.ended || ended === 'awaiting_succession', `상태 ${ended}`)
    assert.ok(ageAt(world.state.character!.eff_min, time) >= world.state.character!.retire_age)
    assert.equal(world.state.current_activity.sortie, null, '은퇴 뒤에 새 출정을 잡았다')
  })
})
