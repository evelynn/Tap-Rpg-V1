import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { aggregate, armorClass, collectModSources, damageProfile, hitBonus, maxHp, modValue, weaponProfile, type Modifier } from '../../src/index'
import { equip, makeContent, makeWorld, setStats, setTraits } from '../fixture'

const m = (op: Modifier['op'], value: number): { mod: Modifier } => ({ mod: { target: 'x', op, value } })

describe('수정자 합산(16 §3.3)', () => {
  it('(set 또는 기준값) + Σadd, 그 뒤 × Πmul', () => {
    assert.equal(aggregate([m('add', 2), m('mul', 1.5), m('set', 10)], 3), 18)
    assert.equal(aggregate([m('add', 2), m('mul', 2)], 3), 10)
    assert.equal(aggregate([], 1), 1)
  })

  it('when이 거짓이면 빼고, 단말 조건은 평가기가 없으면 알린다', () => {
    const w = makeWorld()
    setTraits(w, [])
    const src = [{ kind: 'situational' as const, key: 's', label: 's', modifiers: [
      { target: 'ac', op: 'add' as const, value: 5, when: false },
      { target: 'ac', op: 'add' as const, value: 1, when: true },
    ] }]
    assert.equal(modValue(w, 'ac', 10, src), 11)
    assert.throws(() => modValue(w, 'ac', 10, [{ ...src[0]!, modifiers: [{ target: 'ac', op: 'add', value: 1, when: { level_gte: 3 } }] }]), /조건 평가기/)
  })

  it('출처: 특성·장비·전문화·피로·밤/날씨(출정 중)', () => {
    const w = makeWorld()
    setTraits(w, ['TI01'])
    equip(w, 'J03')
    w.state.character!.specialization = 'guardian'
    w.state.character!.fatigue = 80
    const kinds = collectModSources(w).map((s) => s.kind)
    assert.deepEqual(kinds, ['trait', 'item', 'item', 'item', 'specialization', 'fatigue'])
  })

  it('장비는 슬롯 순서로 돈다(저장 키 순서와 무관), 쓴 1회용 장비는 효과가 없다', () => {
    const w = makeWorld()
    setTraits(w, [])
    const j03 = equip(w, 'J03')
    const eq = w.state.inventory.equipped
    const order = () => collectModSources(w).filter((s) => s.kind === 'item').map((s) => s.key)
    const before = order()
    w.state.inventory.equipped = { relic: eq.relic, accessory: eq.accessory, armor: eq.armor, weapon: eq.weapon }
    assert.deepEqual(order(), before)
    assert.deepEqual(before, ['W01', 'A01', 'J03'])
    w.state.item_instances[j03]!.used = true
    assert.deepEqual(order(), ['W01', 'A01'])
  })

  it('일시 수정자: 대기 scope(next_sortie 등)와 만료된 eff_min은 빼고 모은다', () => {
    const w = makeWorld()
    setTraits(w, [])
    const ch = w.state.character!
    ch.eff_min = 100
    const tm = (scope: 'sortie' | 'next_sortie' | 'next_scene' | 'eff_min' | 'next_check', value: number, expires: number | null = null) => ({
      modifier: { target: 'check.all', op: 'add' as const, value }, scope, remaining: null, expires_eff_min: expires, source_event: null,
    })
    ch.temp_mods = [tm('next_sortie', 10), tm('next_scene', 20), tm('eff_min', 40, 100), tm('eff_min', 1, 101), tm('next_check', 2)]
    assert.equal(modValue(w, 'check.all', 0), 3)
  })

  it('출정: 참인 trip 플래그만 키 정렬 순서로, 날씨는 면제 장소 안에서만 뺀다(01 §1.3)', () => {
    const flag = (id: string, value: number) => ({
      id, scope: 'trip', value: 'bool', set_by: 't', read_by: 't', trip_modifiers: [{ target: 'check.all', op: 'add', value }],
    })
    const w = makeWorld(makeContent({ flag: { 'trip.zz': flag('trip.zz', 1), 'trip.fear': flag('trip.fear', -1), 'trip.aa': flag('trip.aa', 2) } }))
    setTraits(w, [])
    const off = { value: false, remaining: null }
    const on = { value: true, remaining: null }
    w.state.current_activity.sortie = {
      id: 'so_00001', activity: 'dungeon', location_id: 'D1', time_of_day: 'day', weather: 'rain', started_eff_min: 0,
      plan: { rooms: ['combat'], gate: false }, progress: 0,
      trip_flags: { 'trip.zz': on, 'trip.fear': off, 'trip.aa': on },
      temp_mods: [], dungeon_mods: [], quest_wins: null, loot: { coins: 0, item_uids: [], materials: {} },
      potions_used: 0, events_this_sortie: 0, camps: 0, discovery_attempts: [], exclusive_used: [], fate_offered: false,
    }
    const keys = () => collectModSources(w).filter((s) => s.kind === 'trip' || s.kind === 'weather').map((s) => s.key)
    w.state.current_activity.state = 'dungeon'
    assert.deepEqual(keys(), ['trip.aa', 'trip.zz'])
    w.state.current_activity.state = 'travel' // 폐광 입구까지 가는 길은 날씨를 받는다
    assert.deepEqual(keys(), ['trip.aa', 'trip.zz', 'rain'])
  })
})

// 01 §2.4 표준 진행표: 주능력치 힘 3(레벨 4·10·16·22·28에 +1), 근접 단계(레벨 3·7·13·19·26), 해당 단계 일반 장비
describe('유도 수치 — 01 §2.4 표준 진행표', () => {
  const TABLE = [
    [1, 33, 3, 12, 4.5], [2, 37, 3, 12, 4.5], [3, 41, 4, 12, 4.5], [4, 48, 5, 12, 5.5], [5, 52, 5, 12, 5.5],
    [6, 61, 5, 14, 9.5], [7, 65, 6, 14, 9.5], [8, 69, 6, 14, 9.5], [9, 73, 6, 14, 9.5], [10, 80, 7, 14, 9.5],
    [11, 84, 7, 14, 9.5], [12, 93, 7, 16, 14], [13, 97, 8, 16, 14], [14, 101, 8, 16, 14], [15, 105, 8, 16, 14],
    [16, 112, 9, 16, 15], [17, 116, 9, 16, 15], [18, 125, 9, 18, 20], [19, 129, 10, null, 20], [20, 133, 10, null, 20],
    [21, 137, 10, null, 20], [22, 144, 11, null, 20], [23, 148, 11, null, 20], [24, 157, 11, null, 26], [25, 161, 11, null, 26],
    [26, 165, 12, null, 26], [27, 169, 12, null, 26], [28, 176, 13, null, 27], [29, 180, 13, null, 27], [30, 184, 13, null, 27],
  ] as const
  const count = (list: readonly number[], lv: number) => list.filter((x) => x <= lv).length

  for (const [lv, hp, hit, ac, dmg] of TABLE) {
    it(`Lv${lv}: HP ${hp}, 명중 +${hit}${ac ? `, 방어 ${ac}` : ''}, 피해 ${dmg}`, () => {
      const w = makeWorld()
      const ch = w.state.character!
      setTraits(w, [])
      ch.level = lv
      setStats(w, { str: 3 + count([4, 10, 16, 22, 28], lv), dex: 2 })
      ch.skills.melee.rank = count([3, 7, 13, 19, 26], lv)
      const tier = w.content.balance.economy.tier_levels.findIndex(([lo, hi]) => lv >= lo && lv <= hi) + 1
      equip(w, `WT${tier}`, 'common')
      equip(w, `AT${tier}`, 'common')
      assert.equal(maxHp(w), hp)
      assert.equal(hitBonus(w).bonus, hit)
      if (ac) assert.equal(armorClass(w), ac)
      const d = damageProfile(w)
      assert.equal((d.min + d.max) / 2 + d.bonus, dmg)
    })
  }
})

describe('유도 수치 — 문서 예시', () => {
  it('16 §5.10 리아 Lv15: (20 + 60 + 12 + T3 방어구 10) × 1.1 = 112', () => {
    const w = makeWorld()
    setTraits(w, ['TI01', 'TI06'])
    w.state.character!.level = 15
    setStats(w, { str: 4 })
    equip(w, 'AT3', 'good')
    assert.equal(maxHp(w), 112)
  })

  it('05 §4.4 모라 Lv26 수호자: 165 × (1 + 0.10 + 0.15) = 206(소수 버림)', () => {
    const w = makeWorld()
    setTraits(w, ['TI01', 'TI08'])
    w.state.character!.level = 26
    w.state.character!.specialization = 'guardian'
    setStats(w, { str: 7 })
    equip(w, 'AT5')
    assert.equal(maxHp(w), 206)
    assert.equal(armorClass(w) - armorClass({ ...w, state: { ...w.state, character: { ...w.state.character!, specialization: 'none' } } }), 1)
  })

  it('08 §3.1 등급별 무기 피해: 단계 범위 양 끝 × 등급 배수, 반올림', () => {
    const cases = [
      ['WT1', 'good', [2, 6]], ['WT2', 'rare', [7, 13]], ['WT3', 'rare', [10, 21]], ['WT4', 'good', [14, 25]],
      ['WT5', 'good', [20, 33]], ['WT5', 'rare', [22, 38]], ['WT5', 'legendary', [25, 42]], ['W01', undefined, [1, 4]],
    ] as const
    for (const [id, grade, range] of cases) {
      const w = makeWorld()
      equip(w, id, grade)
      assert.deepEqual(weaponProfile(w).damage, range, `${id} ${grade}`)
    }
  })

  it('힘·민첩 중 높은 쪽 무기(W06)와 계열 특화 명중', () => {
    const w = makeWorld()
    setTraits(w, [])
    setStats(w, { str: 2, dex: 4 })
    equip(w, 'W06')
    assert.equal(weaponProfile(w).stat, 'dex')
    assert.equal(hitBonus(w, 'wolf').bonus - hitBonus(w).bonus, 2)
  })
})
