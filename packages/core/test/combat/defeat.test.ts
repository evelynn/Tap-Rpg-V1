// 패배·사망(07 §8, 01 §6.2·§6.3, 09 §5.4). 손실 계산 예와 판정 예를 고정 난수로 확인한다.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { checkDc } from '../../src/index'
import { applyDefeat, defeatLosses, deathSuggestions, resolveDefeat, rollFinalCheck } from '../../src/combat/index'
import { equipDef, fakeRng, fakeWorld, referenceWorld } from './base-content'
import type { World } from '../../src/index'

// 07 §8.1 손실 계산 예: 동전 340, 재료 5개(털갈이 3 · 은빛 돌 2), 장비 2개를 얻고 H3에서 쓰러졌다
function sortieWithLoot(w: World): { items: string[] } {
  const ch = w.state.character!
  const items = ['W06', 'J03'].map((id) => {
    const uid = equipDef(w, id)
    w.state.inventory.equipped[w.content.get('item', id).slot] = null
    w.state.inventory.bag.push(uid)
    return uid
  })
  ch.coins = 400
  w.state.current_activity.sortie = {
    id: 'so_1', activity: 'hunt', location_id: 'H3', time_of_day: 'day', weather: 'clear', started_eff_min: 0,
    plan: { target_encounters: 9, safety_cap: 18 }, progress: 0, trip_flags: {}, temp_mods: [], dungeon_mods: [],
    quest_wins: null, loot: { coins: 340, item_uids: items, materials: { mat_EN03: 3, mat_EN04: 2 } },
    potions_used: 0, events_this_sortie: 0, camps: 0, discovery_attempts: [], exclusive_used: [], fate_offered: false,
  }
  return { items }
}

describe('패배 손실(07 §8.1)', () => {
  it('동전 50% 내림, 재료 절반 올림, 장비 무작위 1개', () => {
    const w = referenceWorld(15)
    const { items } = sortieWithLoot(w)
    const loss = defeatLosses(w, fakeRng())
    assert.equal(loss.coins, 170)
    assert.equal(Object.values(loss.materials).reduce((a, b) => a + b, 0), 3)
    assert.equal(loss.items.length, 1)
    assert.ok(items.includes(loss.items[0]!))
  })

  it('J01 낡은 호각은 동전 손실 20%, 장비는 확률로만 잃는다', () => {
    const w = referenceWorld(15)
    sortieWithLoot(w)
    equipDef(w, 'J01', 'good')
    const loss = defeatLosses(w, fakeRng({ chance: [false] }))
    assert.equal(loss.coins, 68)
    assert.deepEqual(loss.items, [])
  })

  it('고유 장비와 착용 중인 장비는 잃지 않는다', () => {
    const w = referenceWorld(15)
    sortieWithLoot(w)
    const uid = equipDef(w, 'W07', 'rare') // 고유
    w.state.current_activity.sortie!.loot.item_uids = [uid]
    assert.deepEqual(defeatLosses(w, fakeRng()).items, [])
  })
})

describe('일반 패배 처리(07 §8.1)', () => {
  it('구조자를 정하고 부상 판정을 한 뒤 손실과 도착 체력을 낸다', () => {
    const w = referenceWorld(15)
    sortieWithLoot(w)
    // 부상 판정 DC = 12 + ⌊지역 레벨 11 / 3⌋ = 15. 주사위 20이면 대성공 → 경상
    const r = resolveDefeat(fakeWorld(w, fakeRng({ d20: [20] })), { regionId: 'H3' })
    assert.equal(checkDc(w, 'injury', { regionLevel: 11 }), 15)
    assert.equal(r.outcome, 'rescued')
    assert.equal(r.injury?.grade, 'light')
    assert.ok(r.rescuer && ['patrol', 'herbalist', 'river_kids'].includes(r.rescuer.id))
    assert.equal(r.arrive_hp, Math.floor(r.arrive_hp))
    applyDefeat(w, r)
    const ch = w.state.character!
    assert.equal(ch.injuries.length, 1)
    assert.equal(ch.hp, r.arrive_hp)
    assert.equal(ch.coins, 400 - r.losses.coins)
    assert.equal(ch.counters.defeats, 1)
  })

  it('부상 판정 실패는 중상, J01을 차면 구조자가 고정된다', () => {
    const w = referenceWorld(15)
    equipDef(w, 'J01', 'good')
    const r = resolveDefeat(fakeWorld(w, fakeRng({ d20: [2] })), { regionId: 'H3' })
    assert.equal(r.injury?.grade, 'serious')
    assert.equal(r.rescuer?.id, 'whistle_family')
  })

  it('R01 귀환의 방울은 손실 없이 탈출하고 충전을 쓴다(08 R01)', () => {
    const w = referenceWorld(15)
    sortieWithLoot(w)
    const uid = equipDef(w, 'R01', 'rare')
    const r = resolveDefeat(fakeWorld(w, fakeRng({ d20: [20] })), { regionId: 'H3' })
    assert.equal(r.charm_uid, uid)
    assert.deepEqual(r.losses, { coins: 0, materials: {}, items: [] })
    applyDefeat(w, r)
    assert.equal(w.state.item_instances[uid]!.charges?.escape_on_defeat, 0)
  })
})

describe('치명 활동 HP 0(07 §8.2, 09 §5.4)', () => {
  it('최후 판정 주사위 9 + 의지 4 + 행운 1 = 14 / 난이도 15 → 사망', () => {
    const w = referenceWorld(27, { dex: 4 })
    const ch = w.state.character!
    ch.stats.wil = 4
    ch.stats.luk = 2
    const roll = rollFinalCheck(w, fakeRng({ d20: [9] }))
    assert.deepEqual(
      { dice: roll.record.dice, total: roll.record.total, dc: roll.record.dc, result: roll.result },
      { dice: 9, total: 14, dc: 15, result: 'failure' },
    )
  })

  it('실패하면 사망 기록과 다음 세대 제안을 남긴다', () => {
    const w = referenceWorld(27, { dex: 4 })
    const ch = w.state.character!
    ch.stats.wil = 4
    ch.stats.luk = 2
    ch.counters.serious_injuries = 2
    w.state.policies.lethal_allowed = true
    const lethal = {
      source: 'EB03', activity: '던전', step: 'D3 관문', risk_diff: 2, risk_grade: 'normal',
      gate_level: 29, effective_level: 27, potions_at_start: 2, hp_start_ratio: 1,
      injuries_at_start: [], decisive: [],
    }
    const r = resolveDefeat(fakeWorld(w, fakeRng({ d20: [9] })), { regionId: 'D3', lethal })
    assert.equal(r.outcome, 'died')
    const death = r.death!
    assert.equal(death.lethal_source, 'EB03')
    assert.equal(death.final_check.dc, 15)
    assert.equal(death.serious_total, 2)
    // 07 §8.1 표 순서대로 위에서부터 맞는 것 최대 2개(유효 레벨, 중상 누적). 치명 허용 문장은 그 뒤 순위라 잘린다
    assert.deepEqual(death.suggestions, ['조금 더 준비한 뒤 도전할 수 있었다.', '오래된 상처가 발목을 잡았다.'])
    applyDefeat(w, r)
    assert.equal(ch.hp, 0)
    assert.equal(ch.injuries.length, 0)
  })

  it('최후 판정 성공은 중상 + 탈출, 손실은 일반 패배와 같다', () => {
    const w = referenceWorld(27, { dex: 4 })
    w.state.character!.stats.wil = 4
    sortieWithLoot(w)
    const lethal = {
      source: 'EB03', activity: '던전', step: 'D3 관문', risk_diff: 2, risk_grade: 'normal',
      gate_level: 29, effective_level: 27, potions_at_start: 2, hp_start_ratio: 1, injuries_at_start: [], decisive: [],
    }
    const r = resolveDefeat(fakeWorld(w, fakeRng({ d20: [20] })), { regionId: 'D3', lethal })
    assert.equal(r.outcome, 'escaped')
    assert.equal(r.injury?.grade, 'serious')
    assert.equal(r.losses.coins, 170)
    const { injury } = applyDefeat(w, r)
    assert.equal(injury?.serious_total, 1)
  })

  it('방어구가 레벨 기준 단계보다 낮으면 제안에 들어간다(07 §8.3)', () => {
    const w = referenceWorld(27, { dex: 4 })
    equipDef(w, 'A03') // T2 방어구
    const lines = deathSuggestions(w, 'D3', { gate_level: 29, effective_level: 27, potions_at_start: 2 })
    assert.ok(lines[0]!.includes('방어구'))
  })
})
