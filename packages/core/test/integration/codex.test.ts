// 가문 도감(12 §7.2)이 생애 동안 채워지는가: 만난 적·처치 수, 가진 장비·등급, 가 본 장소.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { submitPendingAuto } from '../../src/index'
import { makeGame } from './life-fixture'

describe('가문 도감 기록(12 §7.2)', () => {
  it('출정 몇 시간이면 적·장비·장소 도감이 차고, 처치 수는 인물의 처치 목록과 맞는다', () => {
    const w = makeGame()
    for (let i = 0; i < 60; i++) {
      if (w.state.pending_choice) submitPendingAuto(w)
      else w.advance(600)
    }
    const { codex } = w.state.family
    const ch = w.state.character!
    const enemies = Object.entries(codex.enemies)
    assert.ok(enemies.length > 0, '만난 적')
    for (const id of ch.defeated) assert.ok(codex.enemies[id]!.defeats > 0, `${id} 처치 수`)
    assert.ok(enemies.every(([, e]) => e.first_gen === 1))
    // 시작 장비도 가진 적 있는 장비다
    for (const uid of Object.values(w.state.inventory.equipped)) {
      if (!uid) continue
      const inst = w.state.item_instances[uid]!
      assert.ok(codex.items[inst.def_id]!.grades_seen.includes(inst.grade), inst.def_id)
    }
    for (const id of ch.visited) assert.ok(codex.locations[id], `장소 ${id}`)
  })
})
