// 오프라인 정산(13 §2·§3)과 17 §4 단계 6 합격 기준.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { measureAbsence, pendingSuccession, runOffline, settleOffline, submitPendingAuto, succeed, type World } from '../../src/index'
import { boundariesOf, makeGame, seedOf, warm } from './fixture'

const HOUR = 3600
const CAP_SEC = 8 * HOUR

describe('부재 시간 측정(13 §2.1)', () => {
  it('최고 관측 시각을 기준으로 재고, 상한 8시간·최소 60초를 지킨다', () => {
    const world = makeGame()
    const off = world.state.offline_state
    off.high_water_utc = 1_000_000_000_000
    const saved = off.high_water_utc

    const a = measureAbsence(world.content, world.state, { now_utc: saved + 10 * HOUR * 1000, saved_at_utc: saved })
    assert.equal(a.absent_sec, 10 * HOUR)
    assert.equal(a.settleable_sec, CAP_SEC)
    assert.equal(a.skip, null)
    assert.equal(off.high_water_utc, saved + 10 * HOUR * 1000)

    // 같은 구간을 두 번 정산하지 않는다: 최고 관측 시각이 이미 올라갔다
    const again = measureAbsence(world.content, world.state, { now_utc: saved + 10 * HOUR * 1000, saved_at_utc: saved })
    assert.equal(again.absent_sec, 0)
    assert.equal(again.skip, 'too_short')
  })

  it('5분 이내 역행은 무시하고, 그보다 크면 시계 역행으로 기록한 뒤 정산하지 않는다', () => {
    const world = makeGame()
    const off = world.state.offline_state
    off.high_water_utc = 1_000_000_000_000
    const hw = off.high_water_utc

    const small = measureAbsence(world.content, world.state, { now_utc: hw - 60_000, saved_at_utc: hw })
    assert.equal(small.absent_sec, 0)
    assert.equal(small.skip, 'too_short')
    assert.equal(off.clock_anomalies.length, 0)
    assert.equal(off.high_water_utc, hw, '5분 이내 오차로 최고 관측 시각을 내리지 않는다')

    const big = measureAbsence(world.content, world.state, { now_utc: hw - 10 * 60_000, saved_at_utc: hw })
    assert.equal(big.skip, 'clock_backward')
    assert.equal(off.clock_anomalies.length, 1)
    assert.equal(off.clock_anomalies[0]!.kind, 'backward')
    assert.equal(off.high_water_utc, hw)
  })

  it('저장 시각이 현재보다 늦어도 부재 시간은 음수가 되지 않는다', () => {
    const world = makeGame()
    const off = world.state.offline_state
    off.high_water_utc = 1000
    const a = measureAbsence(world.content, world.state, { now_utc: 2000, saved_at_utc: 9_000_000 })
    assert.equal(a.absent_sec, 0)
    assert.equal(a.settleable_sec, 0)
    assert.equal(a.skip, 'too_short')
  })

  it('48시간을 넘는 부재는 미래 점프로 기록하되 상한까지만 정산한다', () => {
    const world = makeGame()
    const off = world.state.offline_state
    off.high_water_utc = 1_000_000_000_000
    const a = measureAbsence(world.content, world.state, { now_utc: off.high_water_utc + 72 * HOUR * 1000, saved_at_utc: 0 })
    assert.equal(a.settleable_sec, CAP_SEC)
    assert.equal(off.clock_anomalies.at(-1)!.kind, 'forward_jump')
  })

  it('오프라인 진행 방침이 꺼져 있거나 일시정지 상태면 정산하지 않는다', () => {
    const now = 1_000_000_000_000 + 10 * HOUR * 1000
    const off = makeGame()
    off.state.offline_state.high_water_utc = 1_000_000_000_000
    off.state.policies.offline_progress = false
    assert.equal(measureAbsence(off.content, off.state, { now_utc: now, saved_at_utc: 0 }).skip, 'policy_off')

    const paused = makeGame()
    paused.state.offline_state.high_water_utc = 1_000_000_000_000
    paused.pause()
    assert.equal(measureAbsence(paused.content, paused.state, { now_utc: now, saved_at_utc: 0 }).skip, 'paused')
  })
})

describe('정산 상한과 버린 시간(13 §3.2)', () => {
  it('정지 지점이 없으면 상한만큼 정산하고 나이가 오른다', () => {
    const world = makeGame({ seed: seedOf(1) })
    world.state.policies.stage_boundary_stop = false
    const s = settleOffline(world, CAP_SEC)
    assert.ok(s.settled_sec > 0)
    assert.ok(s.to_age > s.from_age, `나이 ${s.from_age} → ${s.to_age}`)
    assert.equal(s.settled_min, s.settled_sec / 60)
    assert.ok(s.journal_ids.length > 0, '정산 구간 기록이 없다')
    // 이 구간 기록은 오프라인 기록으로 표시한다(16 §5.6)
    const offline = world.state.journal.filter((e) => s.journal_ids.includes(e.id))
    assert.ok(offline.every((e) => e.offline), '오프라인 표시가 빠진 기록이 있다')
  })

  it('멈추면 남은 정산 가능 시간을 버린다(정산 + 버림 = 상한)', () => {
    for (const i of [2, 3, 4]) {
      const world = makeGame({ seed: seedOf(i) })
      const s = settleOffline(world, CAP_SEC)
      assert.ok(s.discarded_sec >= 0)
      assert.equal(Math.round(s.settled_sec + s.discarded_sec), CAP_SEC, `#${i}`)
    }
  })

  it('480분 정산 계산 시간이 2초 이하다(13 §2.3)', () => {
    const world = makeGame({ seed: seedOf(5) })
    world.state.policies.stage_boundary_stop = false
    warm(world, 300) // 일지가 쌓인 뒤가 가장 느리다
    // 벽시계가 아니라 이 프로세스의 CPU 시간을 잰다. 테스트를 병렬로 돌리면 벽시계가 2~5배 늘어 흔들렸다
    const t0 = process.cpuUsage()
    settleOffline(world, CAP_SEC)
    const used = process.cpuUsage(t0)
    const ms = Math.round((used.user + used.system) / 1000)
    assert.ok(ms <= 2000, `480분 정산 CPU ${ms}ms`)
  })
})

describe('정산 1,000회 불변식(17 §4 단계 6)', () => {
  it('경계 정지 켬에서 경계 넘김 0, 한 정산이 생애 종료를 두 번 넘긴 경우 0', () => {
    const rounds = 1000
    const reasons = new Map<string, number>()
    let seed = 0
    let world: World = makeGame({ seed: seedOf(seed) })
    for (let n = 0; n < rounds; n++) {
      world.state.policies.stage_boundary_stop = true
      world.state.policies.auto_succession = n % 3 === 0
      const before = world.state.family.chronicle.length
      const s = settleOffline(world, CAP_SEC)
      reasons.set(s.stop_reason, (reasons.get(s.stop_reason) ?? 0) + 1)

      const ended = world.state.family.chronicle.length - before
      assert.ok(ended <= 1, `#${n} 한 정산에서 생애 ${ended}번 종료`)
      for (const b of boundariesOf(world)) {
        assert.ok(!(s.from_age < b && s.to_age > b), `#${n} 경계 ${b}를 넘었다(${s.from_age} → ${s.to_age})`)
      }

      if (ended === 1) {
        // 생애가 끝나면 새 가문으로 바꿔 일지가 무한히 쌓이지 않게 한다
        seed += 1
        world = makeGame({ seed: seedOf(seed) })
        continue
      }
      if (world.state.pending_choice) submitPendingAuto(world)
      else if (pendingSuccession(world)) succeed(world)
    }
    // 정지 지점이 실제로 나와야 시험이 빈 것이 아니다(상한 도달은 경계 정지를 끈 위 시험이 본다)
    for (const r of ['stage_boundary', 'fate_pending']) {
      assert.ok((reasons.get(r) ?? 0) > 0, `정지 지점 ${r}가 한 번도 나오지 않았다`)
    }
    assert.ok((reasons.get('life_end_retired') ?? 0) + (reasons.get('heir_ready') ?? 0) > 0, '생애 종료 정지가 없다')
  })
})

describe('운명 사건 대기(13 §3.1 2순위)', () => {
  it('선택 대기에서는 정산이 유효 진행을 늘리지 않는다(1시간)', () => {
    const world = makeGame({ seed: seedOf(7) })
    for (let i = 0; i < 4000 && !world.state.pending_choice; i++) {
      if (!world.clockRunning) break
      world.advance(60)
    }
    assert.ok(world.state.pending_choice, '선택 대기가 나오지 않았다')
    const before = world.state.character!.eff_min
    const s = settleOffline(world, HOUR)
    assert.equal(s.settled_sec, 0)
    assert.equal(s.discarded_sec, HOUR)
    assert.equal(world.state.character!.eff_min, before, '선택 대기 중에 시간이 흘렀다')
    assert.ok(s.stop_reason === 'fate_pending' || s.stop_reason === 'chain_branch_pending')
    assert.ok(s.awaiting === 'fate' || s.awaiting === 'branch')
  })
})

describe('runOffline과 last_settlement(16 §5.8)', () => {
  it('정산 결과를 저장 상태에 남긴다', () => {
    const world = makeGame({ seed: seedOf(11) })
    world.state.offline_state.high_water_utc = 1_000_000_000_000
    const now = world.state.offline_state.high_water_utc + 10 * HOUR * 1000
    const r = runOffline(world, { now_utc: now, saved_at_utc: 1_000_000_000_000 })
    assert.equal(r.absence.settleable_sec, CAP_SEC)
    assert.ok(r.summary)
    const last = world.state.offline_state.last_settlement!
    assert.equal(last.absent_sec, 10 * HOUR)
    assert.equal(last.stop_reason, r.summary!.stop_reason)
    assert.equal(last.settled_min, r.summary!.settled_min)
    assert.equal(last.summary.sorties, r.summary!.sorties)
  })

  it('정산을 건너뛰면 요약이 없다', () => {
    const world = makeGame()
    world.state.offline_state.high_water_utc = 1_000_000_000_000
    const r = runOffline(world, { now_utc: world.state.offline_state.high_water_utc + 30_000, saved_at_utc: 0 })
    assert.equal(r.summary, null)
    assert.equal(r.absence.skip, 'too_short')
  })
})

describe('계승 대기에서 이어 가기(13 §3.3)', () => {
  it('계승 대기로 멈춘 뒤 succeed를 부르면 다음 정산이 후계자로 이어진다', () => {
    const world = makeGame({ seed: seedOf(3), autoSuccession: false })
    world.state.policies.stage_boundary_stop = false
    for (let i = 0; i < 40 && world.state.current_activity.state !== 'awaiting_succession'; i++) {
      settleOffline(world, CAP_SEC)
      if (world.state.pending_choice) submitPendingAuto(world)
    }
    assert.equal(world.state.current_activity.state, 'awaiting_succession')
    assert.equal(world.state.family.chronicle.length, 1)
    // 계승 대기 상태에서 다시 정산해도 진행하지 않고 그 자리에서 멈춘다
    const idle = settleOffline(world, CAP_SEC)
    assert.equal(idle.settled_sec, 0)
    assert.equal(idle.stop_reason, 'life_end_retired')
    succeed(world)
    const s = settleOffline(world, HOUR)
    assert.ok(s.settled_sec > 0, '후계자가 진행하지 않았다')
    assert.equal(world.state.character!.generation, 2)
  })
})
