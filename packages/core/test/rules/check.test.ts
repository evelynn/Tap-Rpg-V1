import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { checkBonus, checkDc, evaluateCheck, recordCheckUse, regionDc, rollCheck } from '../../src/index'
import { equip, makeContent, makeWorld, scriptedRng, setStats, setTraits } from '../fixture'

describe('판정 확률표(05 §6.5)', () => {
  const content = makeContent()
  // 필요값 → 성공·부분·실패 %
  const TABLE = [
    [1, 95, 0, 5], [2, 95, 0, 5], [3, 90, 5, 5], [4, 85, 10, 5], [6, 75, 10, 15], [8, 65, 10, 25], [10, 55, 10, 35],
    [11, 50, 10, 40], [12, 45, 10, 45], [14, 35, 10, 55], [16, 25, 10, 65], [18, 15, 10, 75], [20, 5, 10, 85],
    [21, 5, 5, 90], [22, 5, 0, 95], [25, 5, 0, 95],
  ] as const
  for (const [need, s, p, f] of TABLE) {
    it(`필요값 ${need}: 성공 ${s}% · 부분 ${p}% · 실패 ${f}%`, () => {
      const n = { success: 0, partial: 0, failure: 0 }
      for (let dice = 1; dice <= 20; dice++) {
        const r = evaluateCheck({ content }, dice, dice, need, true)
        n[r === 'crit_success' ? 'success' : r === 'crit_failure' ? 'failure' : r] += 5
      }
      assert.deepEqual(n, { success: s, partial: p, failure: f })
    })
  }

  it('부분 성공이 없는 판정은 그만큼 실패', () => {
    assert.equal(evaluateCheck({ content }, 10, 12, 13, false), 'failure')
    assert.equal(evaluateCheck({ content }, 10, 12, 13, true), 'partial')
    assert.equal(evaluateCheck({ content }, 20, 20, 99, false), 'crit_success')
    assert.equal(evaluateCheck({ content }, 1, 30, 5, true), 'crit_failure')
  })
})

describe('판정 난이도(01 §3.2, 05 §6.1)', () => {
  const ctx = { content: makeContent() }
  it('지역 기준 11 + ⌊레벨/2.5⌋와 종류 offset·관문', () => {
    assert.equal(regionDc(ctx, 8), 14)
    assert.equal(regionDc(ctx, 4), 12)
    assert.equal(checkDc(ctx, 'trap_detect', { regionLevel: 8 }), 14)
    assert.equal(checkDc(ctx, 'ruin_lore', { regionLevel: 8 }), 18) // +4
    assert.equal(checkDc(ctx, 'weather', { regionLevel: 8 }), 10) // −4
    assert.equal(checkDc(ctx, 'fear', { regionLevel: 8, gate: true }), 18) // 관문 +4
    assert.equal(checkDc(ctx, 'forage', { regionLevel: 8, dcOffset: 2 }), 16)
    assert.equal(checkDc(ctx, 'weather', { regionLevel: 8, dc: 12 }), 12) // L09 dc 12
  })
  it('고정·사건·레벨식·적 방어', () => {
    assert.equal(checkDc(ctx, 'haggle', {}), 12)
    assert.equal(checkDc(ctx, 'haggle', { dc: 16 }), 16)
    assert.equal(checkDc(ctx, 'final', {}), 15)
    assert.equal(checkDc(ctx, 'persuade', { dc: 12 }), 12)
    assert.throws(() => checkDc(ctx, 'persuade', { regionLevel: 4 }), /dc 또는 dcOffset/)
    assert.equal(checkDc(ctx, 'flee', { maxEnemyLevel: 9 }), 14) // 10 + ⌊9/2⌋
    assert.equal(checkDc(ctx, 'injury', { regionLevel: 8 }), 14) // 12 + ⌊8/3⌋
    assert.equal(checkDc(ctx, 'attack', { enemyAc: 15 }), 15)
  })
})

describe('판정 보정과 기록(05 §6.2~§6.6)', () => {
  it('v0.1 예시: 주사위 12 + 민첩 3 + 길눈 1 = 16 / 난이도 14', () => {
    const w = makeWorld()
    setTraits(w, ['TI03'])
    setStats(w, { dex: 3 })
    const r = rollCheck(w, scriptedRng([], [12]), { kinds: ['terrain'], dc: 14 })
    assert.deepEqual(r.record, { dice: 12, parts: [{ label: '민첩', value: 3 }, { label: '길눈', value: 1 }], total: 16, dc: 14, result: 'success', kind: 'terrain' })
  })

  it('기타 보정 상한: J05 탐색 +3 · 길잡이 +2 · J03 +1 = +5(상한)', () => {
    const w = makeWorld()
    setTraits(w, [])
    setStats(w, { kno: 2 })
    w.state.character!.specialization = 'pathfinder'
    const j05 = equip(w, 'J05')
    const b = checkBonus(w, 'trap_detect')
    assert.equal(b.capped, false)
    assert.deepEqual(b.parts, [{ label: '지식', value: 2 }, { label: '속삭이는 종 조각', value: 3 }, { label: '길잡이', value: 2 }])
    // J03을 더하면 +6 → +5(상한), 합친 값 하나로 적는다
    equip(w, 'J03')
    w.state.inventory.equipped.relic = j05
    const c = checkBonus(w, 'trap_detect')
    assert.equal(c.others, 5)
    assert.equal(c.capped, true)
    assert.deepEqual(c.parts, [{ label: '지식', value: 2 }, { label: '보정(상한)', value: 5 }])
  })

  it('특성 하나의 판정 보정은 ±2, 피로 80 이상은 모든 판정 −1', () => {
    const w = makeWorld()
    setTraits(w, ['TX99'])
    setStats(w, { wil: 2 })
    w.state.character!.fatigue = 85
    const b = checkBonus(w, 'fear')
    assert.equal(b.others, 1) // +4 → +2, 피로 −1
    assert.deepEqual(b.parts, [{ label: '의지', value: 2 }, { label: '과장된 특성', value: 2 }, { label: '피로', value: -1 }])
  })

  it('부상 감소: 경상 −1, 중상 −2, 최저 0', () => {
    const w = makeWorld()
    setTraits(w, [])
    setStats(w, { dex: 2 })
    w.state.character!.injuries = [{ grade: 'light', stat: 'dex', remaining_min: 3, source: 'trap' }]
    assert.equal(checkBonus(w, 'terrain').statValue, 1)
    w.state.character!.injuries.push({ grade: 'serious', stat: 'dex', remaining_min: 6, source: 'combat' })
    assert.equal(checkBonus(w, 'terrain').statValue, 0)
  })

  it('최후 판정: 의지 + ⌊행운/2⌋(기타 상한과 별도)', () => {
    const w = makeWorld()
    setTraits(w, [])
    setStats(w, { wil: 4, luk: 3 })
    const b = checkBonus(w, 'final')
    assert.equal(b.extra, 1)
    assert.deepEqual(b.parts, [{ label: '의지', value: 4 }, { label: '행운', value: 1 }])
  })

  it('선택형: 보정 합이 높은 쪽, 같으면 앞쪽', () => {
    const w = makeWorld()
    setTraits(w, [])
    setStats(w, { kno: 3, soc: 2 })
    w.state.character!.skills.negotiation.rank = 1
    assert.equal(rollCheck(w, scriptedRng([], [10]), { kinds: ['lore', 'persuade'], dc: 12 }).kind, 'lore')
    w.state.character!.skills.negotiation.rank = 2
    assert.equal(rollCheck(w, scriptedRng([], [10]), { kinds: ['lore', 'persuade'], dc: 12 }).kind, 'persuade')
  })

  it('명중(사건)도 무기 명중 보정(등급)을 기타에 넣는다(05 §6.1)', () => {
    const w = makeWorld()
    setTraits(w, [])
    setStats(w, { str: 2 })
    equip(w, 'WT1', 'legendary') // 등급 명중 +2
    const b = checkBonus(w, 'attack_event')
    assert.equal(b.others, 2)
    assert.deepEqual(b.parts, [{ label: '힘', value: 2 }, { label: '한손검', value: 2 }])
  })

  it('미리 굴린 주사위와 추가 target(최후 판정 final_check_add)', () => {
    const w = makeWorld()
    setTraits(w, [])
    setStats(w, { wil: 4, luk: 2 })
    const situational = [{ target: 'final_check_add', op: 'add' as const, value: 5 }]
    // 주사위를 주면 난수를 쓰지 않는다(scriptedRng에 d20이 없다)
    const r = rollCheck(w, scriptedRng([]), { kinds: ['final'], dc: 15, dice: 7, situational, extraTargets: ['final_check_add'] })
    assert.equal(r.dice, 7)
    assert.equal(r.record.total, 7 + 4 + 5 + 1)
  })

  it('명중(사건)은 사건이 partial_allowed로 켤 때만 부분 성공', () => {
    const w = makeWorld()
    setTraits(w, [])
    setStats(w, { str: 2 })
    assert.equal(rollCheck(w, scriptedRng([], [9]), { kinds: ['attack_event'], dc: 12 }).result, 'failure')
    assert.equal(rollCheck(w, scriptedRng([], [9]), { kinds: ['attack_event'], dc: 12, partialAllowed: true }).result, 'partial')
  })

  it('사용 점수·숙련 횟수: 판정 +1, 사건 판정 +2, 자연 20 행운 +1, 길잡이 탐색 ×1.25', () => {
    const w = makeWorld()
    setTraits(w, [])
    const ch = w.state.character!
    ch.specialization = 'pathfinder'
    ch.skills.search.uses = 14
    const r = rollCheck(w, scriptedRng([], [20]), { kinds: ['forage'], dc: 12 })
    assert.deepEqual(recordCheckUse(w, r), [{ skill: 'search', from: 0, to: 1 }])
    assert.equal(ch.skills.search.uses, 15.25)
    assert.equal(ch.stat_use_points.kno, 1)
    assert.equal(ch.stat_use_points.luk, 1)
    recordCheckUse(w, rollCheck(w, scriptedRng([], [5]), { kinds: ['persuade'], dc: 12 }), { event: true })
    assert.equal(ch.stat_use_points.soc, 2)
    assert.equal(ch.skills.negotiation.uses, 2)
    // 부상·최후 판정은 injury_or_final을 넘긴다(두 번 쌓지 않는다)
    recordCheckUse(w, rollCheck(w, scriptedRng([], [5]), { kinds: ['final'], dc: 15 }), { statPoints: w.content.balance.growth.use_points.injury_or_final })
    assert.equal(ch.stat_use_points.wil, w.content.balance.growth.use_points.injury_or_final)
  })
})
