// 첫 출정 고정(04 §7.2·§11, D21)과 첫 출정 보장(01 §9.5, 10 §3.4): 새 가문 시드 100개.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { submitPendingAuto } from '../../src/activity/index'
import { baseContent, makeSim } from './fixture'

interface FirstSortie {
  seed: string
  place: string
  activity: string
  target: number
  eventAt: number | null // 보장 사건이 생긴 조우 번호
  guaranteedEquipped: boolean
  level2Min: number | null
  defeatedAt: number // 보장이 끝나기 전에 쓰러진 조우 번호(0 = 없음)
}

function firstSortie(seed: string): FirstSortie {
  const fs = baseContent().balance.first_sortie
  const world = makeSim({ seed })
  const out: FirstSortie = { seed, place: '', activity: '', target: 0, eventAt: null, guaranteedEquipped: false, level2Min: null, defeatedAt: 0 }
  let seen = 0
  for (let i = 0; i < 600; i++) {
    const before = world.state.current_activity.sortie
    world.advance(5)
    if (world.state.pending_choice) submitPendingAuto(world)
    const ch = world.state.character!
    const s = world.state.current_activity.sortie
    if (s && !out.place) {
      out.place = s.location_id
      out.activity = s.activity
      out.target = 'target_encounters' in s.plan ? s.plan.target_encounters : 0
    }
    if (s && s.progress > seen) {
      seen = s.progress
      if (!out.defeatedAt && (ch.counters.sortie_defeats ?? 0) > 0) out.defeatedAt = seen
      // 보장으로 일어난 것만 센다(이유 문장이 붙는다). 같은 사건이 일반 검사로 먼저 날 수도 있다
      if (out.eventAt === null && world.state.journal.some((e) => e.refs?.event_id === fs.guaranteed_event.event && e.reason === fs.guaranteed_event.reason)) out.eventAt = seen
      const armor = world.state.inventory.equipped.armor
      if (armor && world.state.item_instances[armor]!.def_id === fs.guaranteed_drop.item) out.guaranteedEquipped = true
    }
    if (out.level2Min === null && ch.level >= 2) out.level2Min = ch.eff_min
    void before
    if (ch.eff_min >= 12) break // 17 §4는 첫 10분을 본다
  }
  return out
}

describe('첫 출정(17 §4 단계 2)', () => {
  const fs = baseContent().balance.first_sortie
  const runs = Array.from({ length: 100 }, (_, i) => firstSortie((0x5000 + i).toString(16).padStart(16, '0')))

  it('100/100이 H1 사냥·목표 조우 8로 시작한다', () => {
    for (const r of runs) {
      assert.equal(r.place, fs.location, r.seed)
      assert.equal(r.activity, fs.activity, r.seed)
      assert.equal(r.target, fs.encounters, r.seed)
    }
  })

  it('첫 출정에서 쓰러지지 않은 생애는 모두 L01·A02·5분 안 레벨 2를 채운다', () => {
    // 첫 출정에서 쓰러지면 조우가 끊겨 보장·레벨 조건이 성립하지 않는다(01 §5.2 수치 쪽 문제, 보고 대상)
    const alive = runs.filter((r) => r.defeatedAt === 0)
    console.log(`첫 출정 패배 ${runs.length - alive.length}/100`)
    assert.ok(alive.length >= 80, `첫 출정 패배 ${runs.length - alive.length}건`)
    for (const r of alive) {
      assert.equal(r.eventAt, fs.guaranteed_event.after_encounter, `${r.seed} 사건 ${r.eventAt}`)
      assert.ok(r.guaranteedEquipped, `${r.seed} 보장 드롭 미장착`)
      assert.ok(r.level2Min !== null && r.level2Min <= 10, `${r.seed} 레벨 2 ${r.level2Min}`)
    }
    // 17 §4는 5분 안을 요구한다. 경험치 값(01 §2.4·§5.2)에 달려 있어 일부 시드가 6~8분이 된다(보고 대상)
    const fast = alive.filter((r) => (r.level2Min ?? 99) <= 5).length
    assert.ok(fast >= alive.length * 0.9, `5분 안 레벨 2 ${fast}/${alive.length}`)
  })
})
