// 판단 지점 처리(10 §3~§4), 선택 대기(§8), 연속 사건(§7), 결정성(13 §8.3).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyJudgment, chainResumes, applyChainResume, closeLifeChains, fireScheduledEvents, makeConditionTest,
  resolveJudgment, runEvent, runJudgment, runTownReturnEffects, submitChoice, type JudgmentPoint,
} from '../../src/events/index'
import { fakePorts, makeWorld, startSortie, type TestWorld } from './fixture'

const ports = () => fakePorts()

// F01 후보가 되는 인물(레벨 8 이상, 근접 2단계, 전문화 없음)
function readyForF01(tw: TestWorld): void {
  const ch = tw.w.state.character!
  ch.level = 10
  ch.skills.melee.rank = 2
  ch.eff_min = 12 * 5
  tw.scope.place = 'T00'
}

const townPoint: JudgmentPoint = { trigger: 'town_return', place: 'T00' }

describe('첫 출정 사건 보장(10 §3.4)', () => {
  it('첫 가문 첫 인물의 2번째 조우 뒤에 L01이 확정 발생하고 가려서 캔다를 자동 선택한다', () => {
    const tw = makeWorld()
    tw.w.state.character!.eff_min = 10 // 겨울(계절 조건 무시)
    startSortie(tw, { location_id: 'H1' })
    const res = runJudgment(tw.w, { trigger: 'after_encounter', place: 'H1', encounter: 2 }, ports())
    assert.ok(res)
    assert.equal(res.event_id, 'L01')
    assert.equal(res.choice_id, 'careful')
    assert.equal(res.reason, '처음 보는 약초라 하나씩 살폈다.')
    assert.equal(tw.w.state.character!.event_counts.L01, 1)
  })

  it('다음 인물(2대)에는 보장하지 않는다', () => {
    const tw = makeWorld()
    tw.w.state.family.generation = 2
    tw.w.state.character!.generation = 2
    tw.w.state.character!.family_role = 'direct'
    startSortie(tw, { location_id: 'H1' })
    const res = resolveJudgment(tw.w, { trigger: 'after_encounter', place: 'H1', encounter: 2 }, ports())
    assert.ok(res.occurrence === null || res.occurrence.event_id !== 'L01' || res.occurrence.choice_id !== 'careful')
  })
})

describe('선택 대기(10 §8)', () => {
  it('운명 사건은 보류되고 그동안 시계가 멈춘다', () => {
    const tw = makeWorld()
    readyForF01(tw)
    const before = tw.w.state.character!.eff_min
    const res = runJudgment(tw.w, townPoint, ports())
    assert.ok(res)
    assert.equal(res.event_id, 'F01')
    assert.equal(res.held, true)
    const p = tw.w.state.pending_choice!
    assert.equal(p.kind, 'fate')
    assert.deepEqual(p.choices_visible, ['guardian', 'pathfinder', 'defer'])
    assert.equal(tw.w.state.current_activity.state, 'awaiting_choice')
    assert.equal(tw.w.clockRunning, false)
    assert.equal(tw.w.advance(600), 0)
    assert.equal(tw.w.state.character!.eff_min, before)
    // 대기 중에는 새 사건을 검사하지 않는다
    assert.equal(resolveJudgment(tw.w, townPoint, ports()).occurrence, null)

    const done = submitChoice(tw.w, 'guardian', ports())
    assert.equal(done.outcome, 'always')
    assert.equal(tw.w.state.character!.specialization, 'guardian')
    assert.equal(tw.w.state.pending_choice, null)
    assert.equal(tw.w.state.current_activity.state, 'town_idle')
    assert.equal(tw.w.state.character!.event_counts.F01, 1)
    assert.equal(tw.w.state.character!.f01_presentations, 1)
  })

  it('방침 "거절하고 계속"이면 아직은을 자동으로 고르고 멈추지 않는다', () => {
    const tw = makeWorld()
    readyForF01(tw)
    tw.w.state.policies.fate_handling = 'decline_and_continue'
    const res = runJudgment(tw.w, townPoint, ports())!
    assert.equal(res.choice_id, 'defer')
    assert.equal(res.held, false)
    assert.equal(tw.w.state.pending_choice, null)
    assert.equal(tw.w.state.character!.spec_deferred_until_level, 13) // 레벨 +3 뒤 재제시(05 §8.3)
    assert.equal(tw.w.state.character!.counters['defer_rank.melee'], 2)
    // 조건을 다시 채워도 레벨·숙련이 그대로면 재제시하지 않는다(다른 마을 사건은 나올 수 있다)
    assert.notEqual(resolveJudgment(tw.w, townPoint, ports()).occurrence?.event_id, 'F01')
    tw.w.state.character!.level = 13
    const again = resolveJudgment(tw.w, townPoint, ports())
    assert.equal(again.occurrence?.event_id, 'F01')
  })

  it('자동 전문화 방침이 거절보다 앞선다', () => {
    const tw = makeWorld()
    readyForF01(tw)
    tw.w.state.policies.fate_handling = 'decline_and_continue'
    tw.w.state.policies.auto_specialization = 'combat_first'
    const res = runJudgment(tw.w, townPoint, ports())!
    assert.equal(res.choice_id, 'guardian')
    assert.equal(tw.w.state.character!.specialization, 'guardian')
  })

  it('중대 분기(C01-3)는 방침과 무관하게 보류한다', () => {
    const tw = makeWorld()
    tw.w.state.policies.fate_handling = 'decline_and_continue'
    const ch = tw.w.state.character!
    ch.level = 15
    ch.flags['life.c01_stage'] = 2
    startSortie(tw, { location_id: 'D2', activity: 'dungeon' })
    const res = runEvent(tw.w, 'C01-3', { place: 'D2' }, ports())!
    assert.equal(res.held, true)
    assert.equal(tw.w.state.pending_choice!.kind, 'branch')
  })
})

describe('운명 사건 상충과 pity(10 §4.3)', () => {
  function a4World(): TestWorld {
    const tw = makeWorld()
    const ch = tw.w.state.character!
    ch.level = 25
    ch.eff_min = 12 * 33 // 51세
    startSortie(tw, { location_id: 'A4', activity: 'adventure' })
    return tw
  }

  it('F02와 F03이 함께 조건을 채우면 한 출정에 하나만 남는다', () => {
    const tw = a4World()
    const res = resolveJudgment(tw.w, { trigger: 'adventure_event_scene', place: 'A4' }, ports())
    assert.ok(res.exclusive, '배타 그룹 추첨 결과가 있어야 한다')
    const [group, keep] = res.exclusive!.split('=') as [string, string]
    assert.equal(group, 'lifespan_offer')
    assert.ok(['F02', 'F03'].includes(keep))
    applyJudgment(tw.w, res, ports())
    assert.ok(tw.w.state.current_activity.sortie!.exclusive_used.includes(res.exclusive!))
    // 등장하지 않았다면 다른 하나는 이번 출정에서 다시 검사하지 않는다
    if (!res.occurrence) {
      const next = resolveJudgment(tw.w, { trigger: 'adventure_event_scene', place: 'A4' }, ports())
      assert.notEqual(next.occurrence?.event_id, keep === 'F02' ? 'F03' : 'F02')
    }
  })

  it('pity_after 회째에는 확정으로 나온다', () => {
    const tw = a4World()
    tw.w.state.character!.event_pity.F02 = 2 // F02 pity_after 3
    tw.w.state.current_activity.sortie!.exclusive_used.push('lifespan_offer=F02')
    const res = resolveJudgment(tw.w, { trigger: 'adventure_event_scene', place: 'A4' }, ports())
    assert.equal(res.occurrence?.event_id, 'F02')
    assert.equal(res.fate, true)
    assert.equal(res.pity.F02, 0)
    applyJudgment(tw.w, res, ports())
    assert.equal(tw.w.state.character!.event_pity.F02, undefined)
    assert.equal(tw.w.state.current_activity.sortie!.fate_offered, true)
    // 한 출정에서 운명 사건은 하나뿐이다
    tw.w.state.pending_choice = null
    tw.w.state.current_activity.state = 'adventure'
    assert.equal(resolveJudgment(tw.w, { trigger: 'adventure_event_scene', place: 'A4' }, ports()).fate, false)
  })

  it('등장하지 않으면 pity가 쌓인다', () => {
    const tw = a4World()
    tw.w.state.current_activity.sortie!.exclusive_used.push('lifespan_offer=F02')
    let stacked = 0
    for (let i = 0; i < 6 && !tw.w.state.pending_choice; i++) {
      const res = resolveJudgment(tw.w, { trigger: 'adventure_event_scene', place: 'A4' }, ports())
      if (!res.occurrence) stacked = res.pity.F02 ?? 0
      applyJudgment(tw.w, res, ports())
      if (stacked >= 2) break
    }
    assert.ok(stacked >= 1 || tw.w.state.pending_choice !== null)
  })
})

describe('생일(specific_age)과 마을 귀환 기준 나이', () => {
  it('30세가 된 뒤 첫 귀환에서 L23이 확정 발생한다', () => {
    const tw = makeWorld()
    const ch = tw.w.state.character!
    ch.eff_min = 12 * 12 // 30세
    ch.counters.sorties = 3
    const res = runJudgment(tw.w, townPoint, ports())
    assert.equal(res?.event_id, 'L23')
    assert.equal(ch.counters.town_return_age, 30)
    // 같은 나이로 다시 귀환하면 조건이 꺼진다
    assert.equal(makeConditionTest(tw.w, { place: 'T00', vars: {} })({ specific_age: [30] }), false)
  })
})

describe('연속 사건(10 §7)', () => {
  it('생애가 끝나면 미완료 줄기를 끝나지 않은 이야기로 남긴다', () => {
    const tw = makeWorld()
    tw.w.state.character!.flags['life.c01_stage'] = 2
    const lines = closeLifeChains(tw.w)
    assert.deepEqual(lines, ['끝나지 않은 이야기 — 광부의 지도: 세나에게 약속했다'])
    assert.equal(tw.w.state.family.flags['fam.c01_unfinished'], 2)
  })

  it('후계자가 마을에서 같은 단계를 이어받는다(한 번만)', () => {
    const tw = makeWorld()
    tw.w.state.family.flags['fam.c01_unfinished'] = 2
    tw.w.state.family.generation = 2
    const test = makeConditionTest(tw.w, { place: 'T00', vars: {} })
    const resumes = chainResumes(tw.w, test)
    assert.deepEqual(resumes.map((r) => [r.chain_id, r.stage]), [['C01', 2]])
    applyChainResume(tw.w, resumes[0]!)
    assert.equal(tw.w.state.character!.flags['life.c01_stage'], 2)
    assert.equal(tw.w.state.family.flags['fam.c01_unfinished'], undefined)
    assert.deepEqual(chainResumes(tw.w, test), [])
  })

  it('C02는 이어받지 않는다', () => {
    const tw = makeWorld()
    tw.w.state.family.flags['fam.c02_unfinished'] = 2
    tw.w.state.family.generation = 2
    assert.deepEqual(chainResumes(tw.w, makeConditionTest(tw.w, { place: 'T00', vars: {} })), [])
  })
})

describe('미룬 처리', () => {
  it('on_town_return 효과는 마을 도착 때 적용된다', () => {
    const tw = makeWorld()
    startSortie(tw)
    runEvent(tw.w, 'L01', { place: 'H1', choiceId: 'mark' }, ports())
    assert.equal(tw.w.state.current_activity.pending_town_effects.length, 1)
    runTownReturnEffects(tw.w, ports())
    assert.equal(tw.w.state.character!.shop_discounts.length, 1)
    assert.equal(tw.w.state.current_activity.pending_town_effects.length, 0)
  })

  it('예약 사건은 발화할 때 condition만 본다', () => {
    const tw = makeWorld()
    tw.w.state.character!.scheduled_events.push({ event_id: 'L23', at: 'next_town_return', due_eff_min: null })
    tw.w.state.character!.eff_min = 12 * 12
    const out = fireScheduledEvents(tw.w, 'next_town_return', 'T00', ports())
    assert.equal(out.length, 1)
    assert.equal(out[0]!.event_id, 'L23')
    assert.deepEqual(tw.w.state.character!.scheduled_events, [])
  })
})

describe('결정성', () => {
  it('같은 시드 → 같은 결과', () => {
    const run = () => {
      const tw = makeWorld()
      tw.w.state.character!.level = 6
      startSortie(tw, { location_id: 'H1' })
      for (let i = 1; i <= 20; i++) runJudgment(tw.w, { trigger: 'after_encounter', place: 'H1', encounter: i }, ports())
      for (let i = 0; i < 5; i++) runJudgment(tw.w, { trigger: 'camp', place: 'H1' }, ports())
      return tw.w.snapshot()
    }
    assert.deepEqual(run(), run())
  })

  it('다른 시드 → 다른 결과', () => {
    const run = (seed: string) => {
      const tw = makeWorld(seed)
      startSortie(tw, { location_id: 'H1' })
      for (let i = 1; i <= 30; i++) runJudgment(tw.w, { trigger: 'after_encounter', place: 'H1', encounter: i }, ports())
      return tw.w.state.journal.map((e) => e.line).join('|')
    }
    assert.notEqual(run('9e3779b97f4a7c15'), run('0123456789abcdef'))
  })
})
