// D87: 도감 본 적 있음·12 §7.2 칸, 계승 때 뽑히지 않은 후보, 잠긴 고정 목적지 해제
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pendingSuccession, submitPendingAuto, succeed } from '../../src/index'
import { makeGame } from './life-fixture'

describe('도감·가계도·목적지(D87)', () => {
  it('상점 진열을 보면 본 적 있음, 얻으면 처음 장소, 적·장소·사건은 처음 인물·나이·고른 선택지', () => {
    const w = makeGame()
    for (let i = 0; i < 4000 && w.state.character!.eff_min < 60; i++) {
      if (w.state.pending_choice) submitPendingAuto(w)
      else w.advance(600)
    }
    const cx = w.state.family.codex
    assert.ok(Object.keys(cx.seen).length > 0, '마을 정비에서 진열을 봤다')
    const item = Object.values(cx.items)[0]!
    assert.ok(item.first_place, '처음 얻은 장소')
    const enemy = Object.values(cx.enemies)[0]!
    assert.equal(enemy.first_name, w.state.character!.name)
    const place = Object.values(cx.locations).find((l) => l.first_name)!
    assert.ok(place.first_age! >= 18)
    const chosen = Object.values(cx.events).filter((e) => e.choices?.length)
    assert.ok(chosen.length > 0, '고른 선택지가 남는다')
  })

  it('계승: 뽑히지 않은 후보가 부모 생애 기록에 남고, 잠긴 고정 목적지는 풀리며 한 번 알린다', () => {
    const w = makeGame({ autoSuccession: false })
    for (let i = 0; i < 40000 && w.state.current_activity.state !== 'awaiting_succession'; i++) {
      if (w.state.pending_choice) submitPendingAuto(w)
      else w.advance(600)
    }
    const plan = pendingSuccession(w)!
    // 새 인물(길드 첫 등급)은 들어갈 수 없는 곳을 고정해 둔다
    const locked = w.content.list('region').find((r) => r.guild_rank_req && r.guild_rank_req !== w.content.list('guild_rank').sort((a, b) => a.order - b.order)[0]!.id)!
    w.state.policies.destination = locked.id
    const parentUid = w.state.character!.uid
    succeed(w)
    const rec = w.state.family.chronicle.find((r) => r.char_uid === parentUid)!
    assert.equal(rec.candidates_passed.length, plan.candidates.length - 1)
    assert.equal(w.state.policies.destination, 'auto')
    assert.equal(w.state.journal.filter((e) => e.line === w.content.balance.activity_ai.lines.lost_destination).length, 1)
  })
})
