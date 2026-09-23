// 생애 루프 통합(17 §4 단계 2·4): 한 생애 완주, 3세대 연속, 치명 허용 끔, 같은 시드 재현.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ageAt, pendingSuccession, succeed } from '../../src/index'
import { baseContent, journalHash, makeGame, run } from './life-fixture'

const seedOf = (n: number) => (0x2000 + n).toString(16).padStart(16, '0')
const time = () => baseContent().balance.time

describe('한 생애 완주(18 → 68세)', () => {
  it('자동 계승이 꺼져 있으면 계승 대기에서 멈추고, 예외 0·멈춤 0이다', () => {
    for (let i = 0; i < 5; i++) {
      const world = makeGame({ seed: seedOf(i) })
      const r = run(world)
      const ch = world.state.character!
      assert.equal(r.stalls, 0, `#${i} 멈춤 ${r.stalls}`)
      assert.equal(world.state.current_activity.state, 'awaiting_succession', `#${i} 상태`)
      assert.ok(r.waits > 0, `#${i} 계승 대기에서 멈추지 않았다`)
      assert.ok(ageAt(ch.eff_min, time()) >= ch.retire_age, `#${i} 나이 ${ageAt(ch.eff_min, time())}`)
      // 계승 1~2단계가 끝나 연대기와 계승 계획이 남는다
      assert.equal(world.state.family.chronicle.length, 1)
      const rec = world.state.family.chronicle[0]!
      assert.equal(rec.end_kind, 'retired')
      assert.equal(rec.end_age, 68)
      assert.ok(rec.retire_role !== null, '은퇴 역할이 없다')
      assert.equal(world.state.family.retirees.length, 1)
      assert.ok(pendingSuccession(world) !== null)
      assert.equal(world.clockRunning, false)
    }
  })

  it('수동 계승: succeed를 부르면 2대가 18세·레벨 1로 출발한다', () => {
    const world = makeGame()
    run(world)
    assert.equal(world.state.current_activity.state, 'awaiting_succession')
    const parent = world.state.character!.uid
    const heir = succeed(world)
    assert.equal(heir.generation, 2)
    assert.equal(heir.level, 1)
    assert.equal(heir.eff_min, 0)
    assert.equal(heir.parent_uid, parent)
    assert.equal(world.state.current_activity.state, 'town_idle')
    assert.equal(pendingSuccession(world), null)
    assert.equal(world.clockRunning, true)
    // 새 인물도 그대로 이어서 돈다
    const r = run(world, { steps: 60 })
    assert.equal(r.stalls, 0)
    assert.ok(world.state.character!.eff_min > 0)
  })
})

describe('3세대 연속 진행(자동 계승 켬)', () => {
  it('멈춤 없이 3대까지 이어진다', () => {
    const world = makeGame({ autoSuccession: true })
    const r = run(world, { steps: 2600, until: (w) => w.state.family.generation >= 3 })
    assert.ok(r.generations >= 3, `세대 ${r.generations}`)
    assert.equal(r.stalls, 0)
    assert.equal(world.state.family.chronicle.length, 2)
    assert.equal(world.state.character!.generation, 3)
    // 세대마다 인물이 바뀌고 연대기가 쌓인다
    const gens = world.state.family.chronicle.map((x) => x.gen)
    assert.deepEqual(gens, [1, 2])
    for (const rec of world.state.family.chronicle) assert.ok(rec.end_age >= 18)
    // 계승 대기에 머무르지 않는다(자동 계승은 3~5단계까지 이어 간다)
    assert.notEqual(world.state.current_activity.state, 'awaiting_succession')
  })
})

describe('치명 위험 허용 끔(09 §5)', () => {
  it('사망이 0이고 연대기는 모두 은퇴로 끝난다', () => {
    for (const attitude of ['stable', 'challenging']) {
      for (let i = 0; i < 3; i++) {
        const world = makeGame({ seed: seedOf(100 + i), attitude, autoSuccession: true, lethal: false })
        run(world, { steps: 1400, until: (w) => w.state.family.generation >= 2 })
        for (const rec of world.state.family.chronicle) {
          assert.notEqual(rec.end_kind, 'died', `${attitude} #${i} 사망 발생`)
          assert.equal(rec.cause, null)
        }
        assert.ok(world.state.character!.hp > 0, `${attitude} #${i} 체력 0`)
      }
    }
  })
})

describe('치명 위험 허용 켬: 사망 → 계승(04 §2.2, 09 §5)', () => {
  it('최후 판정에 지면 귀환하지 않고 연대기에 원인이 남은 채 다음 세대로 이어진다', () => {
    // 시드는 "치명 관문에서 최후 판정에 진다"를 재현하는 값이다. 행동 길이·판단 순서가 바뀌면 다시 고른다
    const world = makeGame({ seed: '0000000000005061', attitude: 'challenging', lethal: true })
    const r = run(world, { steps: 1400 })
    assert.equal(r.stalls, 0)
    assert.equal(world.state.current_activity.state, 'awaiting_succession')
    // 사망은 그 자리에서 끝난다: 출정이 남지 않는다
    assert.equal(world.state.current_activity.sortie, null)
    const rec = world.state.family.chronicle.find((x) => x.end_kind === 'died')
    assert.ok(rec, '사망 기록이 없다')
    // 09 §5.4 원인 세 줄의 재료가 모두 남는다
    assert.ok(rec.cause !== null)
    assert.equal(rec.cause.location, 'D3')
    assert.ok(rec.cause.lethal_source !== null)
    assert.ok(rec.cause.decisive_check !== null)
    assert.ok(rec.cause.decisive_check.total < rec.cause.decisive_check.dc, '최후 판정에 진 기록이 아니다')
    // 사망 기록 한 줄(09 §5.2)과 S04
    assert.ok(world.state.journal.some((e) => e.tag === 'death'))
    // 사망 세대는 은퇴 인물로 남지 않는다(09 §4.2)
    assert.equal(world.state.family.retirees.length, 0)
    // 다음 인물은 마을에서 출발한다(현장에서 죽어도 던전에서 시작하지 않는다)
    const heir = succeed(world)
    assert.equal(heir.generation, 2)
    assert.equal(world.content.get('region', heir.location).kind, 'town')
    assert.equal(run(world, { steps: 60 }).stalls, 0)
  })
})

describe('결정성(13 §8.3)', () => {
  it('같은 시드를 두 번 돌리면 일지 해시와 저장이 같다', () => {
    const a = makeGame({ autoSuccession: true })
    const b = makeGame({ autoSuccession: true })
    const ra = run(a, { steps: 1400 })
    const rb = run(b, { steps: 1400 })
    assert.deepEqual(ra, rb)
    assert.equal(journalHash(a), journalHash(b))
    assert.deepEqual(a.snapshot(), b.snapshot())
  })

  it('다른 시드면 일지 해시가 다르다', () => {
    const a = makeGame({ seed: seedOf(7), autoSuccession: true })
    const b = makeGame({ seed: seedOf(8), autoSuccession: true })
    run(a, { steps: 700 })
    run(b, { steps: 700 })
    assert.notEqual(journalHash(a), journalHash(b))
  })
})
