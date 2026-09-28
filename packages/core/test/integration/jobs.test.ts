// 직업과 기술(05 §8·§10, 12 §7.7, D79): 1차 4갈래, F04 2차 전직, 기술 익힘·상한, 가문 수첩 요령
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  chargesLeft, collectModSources, fieldJudgment, learnTechnique, nextRoomWeights, recommendedSpecKey, useCharge, noteEncounter, runEvent, secondJobReady, submitChoice, submitPendingAuto, writeNote, type World,
} from '../../src/index'
import { makeGame } from './life-fixture'

function veteran(w: World, spec: 'guardian' | 'herbalist'): void {
  const c = w.state.character!
  c.specialization = spec
  c.level = 20
  c.skills[spec === 'guardian' ? 'melee' : 'survival'].rank = 3
}

describe('직업과 기술(D79)', () => {
  it('F01에 약초꾼·행상이 있고, 고르면 전직 기술을 익히며 [성장] 기록이 남는다', () => {
    const w = makeGame()
    const c = w.state.character!
    c.level = 8
    c.skills.survival.rank = 2
    runEvent(w, 'F01', { place: 'T00', force: true }, w.ports)
    assert.deepEqual(w.state.pending_choice!.choices_visible, ['guardian', 'pathfinder', 'herbalist', 'merchant', 'defer'])
    submitChoice(w, 'herbalist', w.ports)
    assert.equal(c.specialization, 'herbalist')
    assert.deepEqual(c.techniques.map((t) => [t.id, t.source]), [['herb_poultice', 'job']])
    const e = w.state.journal.find((x) => x.sub === 'tech')!
    assert.equal(e.line, '약초 찜질을 익혔다')
    assert.match(e.detail!, /숨 고르기 회복 \+50%/)
  })

  it('F04: 조건이 되면 1차 직업의 두 갈래만 보이고, 고르면 2차 효과·기술이 수정자에 더해진다', () => {
    const w = makeGame()
    veteran(w, 'guardian')
    assert.ok(secondJobReady(w))
    runEvent(w, 'F04', { place: 'T00', force: true }, w.ports)
    assert.deepEqual(w.state.pending_choice!.choices_visible, ['warden', 'vanguard', 'enough'])
    submitChoice(w, 'warden', w.ports)
    const c = w.state.character!
    assert.equal(c.job2, 'warden')
    assert.ok(c.techniques.some((t) => t.id === 'stand_fast'))
    const labels = collectModSources(w).map((s) => s.label)
    assert.ok(labels.includes('파수꾼') && labels.includes('끝까지 선다'))
    assert.equal(secondJobReady(w), false)
  })

  it('F04 `지금의 길로 충분하다`는 레벨 3 오를 때까지 다시 묻지 않는다', () => {
    const w = makeGame()
    veteran(w, 'herbalist')
    runEvent(w, 'F04', { place: 'T00', force: true }, w.ports)
    submitChoice(w, 'enough', w.ports)
    assert.equal(secondJobReady(w), false)
    w.state.character!.level = 23
    assert.equal(secondJobReady(w), true)
  })

  it('사건 기술은 한 생애 2개까지, 같은 기술은 한 번만', () => {
    const w = makeGame()
    assert.ok(learnTechnique(w, 'hadel_counter', 'event'))
    assert.equal(learnTechnique(w, 'hadel_counter', 'event'), false)
    assert.ok(learnTechnique(w, 'fallen_rise', 'event'))
    assert.equal(learnTechnique(w, 'old_lamp', 'event'), false)
  })

  it('가문 수첩: 생애 끝에 사건 기술이 먼저 적히고, 은퇴 교관 부모는 판정 없이 가르친다', () => {
    const w = makeGame()
    const c = w.state.character!
    c.specialization = 'guardian'
    learnTechnique(w, 'shield_hold', 'job')
    learnTechnique(w, 'hadel_counter', 'event')
    writeNote(w)
    assert.deepEqual(w.state.family.technique_note, { tech_id: 'hadel_counter', gen: 1 })
    // 다음 세대처럼 꾸며 확률 1로 만나게 한다
    c.generation = 2
    c.techniques = []
    c.level = 5
    w.content.balance.job_rules.note_chance = 1
    try {
      noteEncounter(w, w.rng.event, '어머니', true)
    } finally {
      w.content.balance.job_rules.note_chance = 0.2
    }
    assert.deepEqual(c.techniques.map((t) => [t.id, t.source]), [['hadel_counter', 'note']])
    assert.ok(w.state.journal.some((e) => e.line === '수첩 속 요령을 익혔다' && e.detail === '어머니가 직접 하델의 받아치기 요령을 가르쳐 주었다.'))
  })

  it('한 생애를 돌려도 직업·기술 기록이 깨지지 않는다(자동 전문화 숙련 높은 쪽)', () => {
    const w = makeGame({ autoSuccession: true })
    w.state.policies.auto_specialization = 'higher_skill'
    for (let i = 0; i < 6000 && w.state.family.generation < 2; i++) {
      if (w.state.pending_choice) submitPendingAuto(w)
      else w.advance(600)
    }
    const rec = w.state.family.chronicle[0]
    assert.ok(rec, '한 생애가 끝났다')
    assert.ok(rec.techniques.length <= 4)
    if (rec.specialization !== 'none') assert.ok(rec.techniques.length >= 1, '전직 기술')
  })

  it('사건 기술 상한이 차 있으면 수첩 요령을 만나지 않는다(익혔다는 기록만 남지 않는다, 독립 검증 D79-6)', () => {
    const w = makeGame()
    const c = w.state.character!
    w.state.family.technique_note = { tech_id: 'old_lamp', gen: 1 }
    c.generation = 2
    c.level = 6
    learnTechnique(w, 'hadel_counter', 'event')
    learnTechnique(w, 'fallen_rise', 'event')
    const n = w.state.journal.length
    w.content.balance.job_rules.note_chance = 1
    try {
      noteEncounter(w, w.rng.event, '어머니', true)
    } finally {
      w.content.balance.job_rules.note_chance = 0.2
    }
    assert.equal(w.state.journal.length, n)
    assert.ok(!c.techniques.some((t) => t.id === 'old_lamp'))
  })

  it('기술 출정 충전: 발소리 읽기의 매복 무효가 충전 목록에 들고, 쓰면 줄고, 새 출정에 다시 찬다(독립 검증 D79-5)', () => {
    const w = makeGame()
    learnTechnique(w, 'footstep_read', 'job')
    assert.deepEqual(chargesLeft(w, 'ambush_negate'), [{ uid: 'tech:footstep_read', left: 1 }])
    useCharge(w, 'tech:footstep_read', 'ambush_negate')
    assert.deepEqual(chargesLeft(w, 'ambush_negate'), [])
    for (let i = 0; i < 400 && w.state.current_activity.sortie?.activity !== 'hunt'; i++) w.advance(60)
    for (let i = 0; i < 2000 && w.state.current_activity.sortie; i++) w.advance(60)
    for (let i = 0; i < 2000 && !w.state.current_activity.sortie; i++) w.advance(60)
    assert.ok(w.state.current_activity.sortie, '다음 출정')
    assert.equal(chargesLeft(w, 'ambush_negate').length, 1)
  })

  it('방패 버티기: 체력이 퇴각 기준에 닿은 판단 지점에서 출정당 한 번 최대 HP 10%를 되찾는다', () => {
    const w = makeGame()
    for (let i = 0; i < 400 && !w.state.current_activity.sortie; i++) w.advance(60)
    assert.ok(w.state.current_activity.sortie)
    learnTechnique(w, 'shield_hold', 'job')
    const c = w.state.character!
    w.state.inventory.consumables = {}
    c.hp = 1
    fieldJudgment(w)
    const e = w.state.journal.at(-1)!
    assert.equal(e.line, '두 번째 숨으로 버텼다')
    assert.ok(c.hp > 1)
    const after = c.hp
    c.hp = 1
    fieldJudgment(w)
    assert.equal(c.hp, 1, '출정당 한 번')
    assert.ok(after > 1)
  })

  it('틈 사이 걸음: 다음 방이 보물 방일 몫을 5%p 올린다', () => {
    const w = makeGame()
    const share = () => {
      const ws = nextRoomWeights(w, 'D1', ['combat'], 1)
      const total = Object.values(ws).reduce((a, b) => a + b, 0)
      return ws.treasure / total
    }
    const before = share()
    learnTechnique(w, 'gap_step', 'event')
    assert.ok(Math.abs(share() - before - 0.05) < 1e-9, `${before} → ${share()}`)
  })

  it('F01 추천: 기동이 가장 높으면 길잡이(05 §8.1 탐색·기동 → 길잡이, 독립 검증 D79-8)', () => {
    const w = makeGame()
    const s = w.state.character!.skills
    s.mobility = { rank: 3, uses: 99 }
    s.melee = { rank: 2, uses: 30 }
    assert.equal(recommendedSpecKey(w), 'search_first')
    assert.deepEqual(w.content.get('event', 'F01').policy_hooks?.represent_after?.skill_rank_up, ['melee', 'search', 'survival', 'negotiation'])
  })
})
