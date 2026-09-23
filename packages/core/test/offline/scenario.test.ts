// 17 §4 단계 6의 시나리오 두 가지: v0.1 §14.1 정산 예시와 무작위 시점 강제 종료 100회.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canonicalJson, loadSave, makeSaveRoot, serializeSave, settleOffline, submitPendingAuto, World,
  type ActionResolver, type ResolvedDraft, type World as TWorld,
} from '../../src/index'
import { journalHash } from '../integration/life-fixture'
import { baseContent, makeGame, roundTrip, seedOf } from './fixture'

const MIN = 60
const CAP_SEC = 8 * 3600

// 목표 유효 진행 분까지 60초씩 흘린다. 중간에 멈춰도 저장을 불러 이어 갈 수 있는 몰이다
function runTo(world: TWorld, targetMin: number): void {
  for (;;) {
    const ch = world.state.character
    if (!ch || ch.eff_min >= targetMin) return
    if (world.state.pending_choice) {
      submitPendingAuto(world)
      continue
    }
    if (!world.clockRunning) return
    if (world.advance(Math.min(MIN, (targetMin - ch.eff_min) * MIN)) === 0) return
  }
}

describe('v0.1 §14.1 정산 예시(13 §3.2)', () => {
  it('10시간 부재·3시간 지점 운명 사건 → 정산 180분, 버린 시간 300분, 멈춘 이유 fate_pending', () => {
    const content = baseContent()
    const state = makeGame({ seed: seedOf(21) }).snapshot()
    const eventId = content.list('event')[0]!.id
    const regionId = content.list('region')[0]!.id
    // 34세에 떠난다. 이 구간은 전성기(30~49세) 안이라 생애 단계 경계 정지에 먼저 걸리지 않는다
    const startMin = (34 - content.balance.time.start_age) * content.balance.time.min_per_year
    state.character!.eff_min = startMin
    state.current_activity.resolved_action = null
    state.current_activity.state = 'town_idle'

    // 1분짜리 대기 행동만 도는 세계. 3시간(180분) 지점에서 운명 사건이 사용자 선택을 기다린다
    const resolver: ActionResolver = {
      resolve: (): ResolvedDraft => ({ duration_sec: MIN, outcome: 'wait', effects: [], journal: [] }),
      apply: (w) => {
        const ch = w.state.character!
        if (ch.eff_min < startMin + 180 || w.state.pending_choice) return
        w.state.pending_choice = {
          kind: 'fate',
          event_id: eventId,
          presented_eff_min: ch.eff_min,
          location: regionId,
          choices_visible: [],
          excluded: [],
          pre_rolled: {},
          pre_chance: {},
          context: {},
          preview_rendered: {},
        }
        w.state.current_activity.state = 'awaiting_choice'
      },
    }
    const world = new World(content, state, { decide: () => 'town', resolvers: { town: resolver } })

    const s = settleOffline(world, CAP_SEC, { decide: () => 'town' })
    assert.equal(s.stop_reason, 'fate_pending')
    assert.equal(s.settled_min, 180)
    assert.equal(s.discarded_sec / 60, 300)
    assert.equal(s.from_age, 34)
    assert.equal(s.to_age, 49)
    assert.equal(s.awaiting, 'fate')
  })
})

describe('무작위 시점 강제 종료 100회(17 §4 단계 6)', () => {
  it('저장 손상 0, 확정 결과 재추첨 0, 이어 진행 결과가 중단 없이 진행한 것과 같다', () => {
    const total = 150 // 유효 진행 분
    const content = baseContent()
    let lostAgeNotices = 0
    for (let i = 0; i < 100; i++) {
      const whole = makeGame({ seed: seedOf(i) })
      runTo(whole, total)

      const killed = makeGame({ seed: seedOf(i) })
      runTo(killed, (total * ((i * 37) % 97)) / 100) // 행동 도중일 수 있는 지점에서 강제 종료
      const pre = canonicalJson(killed.state.current_activity.resolved_action)

      const root = makeSaveRoot(killed.snapshot(), {
        app_version: '0.1.0', saved_at_utc: 1_790_000_000_000, content_packs: [], content_hash: 'x',
      })
      const loaded = loadSave(serializeSave(root), content)
      assert.ok(loaded.ok, `#${i} 저장 손상: ${loaded.ok ? '' : `${loaded.code} ${loaded.message}`}`)
      // 정상 저장에는 보정이 걸리지 않는다. 다만 activity/adventure.ts가 세우는 trip.forced_next_scene은
      // 16 §5.2 등록표에 없어 B13 경고만 남는다(보고서 "남은 문제" 2번)
      for (const d of loaded.diagnostics) {
        assert.ok(d.code === 'B13' && d.message.includes('forced_next_scene'), `#${i} 뜻밖의 보정 ${d.code}: ${d.message}`)
      }

      const resumed = roundTrip(killed)
      // 확정 결과 재추첨 0: 종료 전에 기록된 확정 결과가 그대로 살아 있다
      assert.equal(canonicalJson(resumed.state.current_activity.resolved_action), pre, `#${i} 확정 결과가 바뀌었다`)
      runTo(resumed, total)

      if (journalHash(whole) === journalHash(resumed)) continue
      // 판단 지점으로 미뤄 둔 나이 알림(09 §2.1)도 저장 칸(C31 current_activity.life_loop)에 있어 사라지지 않는다
      const key = (w: TWorld): string =>
        w.state.journal.filter((e) => e.sub !== 'age').map((e) => `${e.tag}|${e.line}|${e.detail ?? ''}`).join('\n')
      assert.equal(key(resumed), key(whole), `#${i} 나이 알림 밖의 결과가 달라졌다`)
      lostAgeNotices += 1
    }
    assert.equal(lostAgeNotices, 0, `나이 알림이 사라진 회차 ${lostAgeNotices}/100`)
  })
})
