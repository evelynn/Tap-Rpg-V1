// 가호(01 §19, 04 §10.3, D78): 별빛·걸기·발동·바로 쓰기·극복 순간·시작 축복·계승
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyDefeat, applyStartBlessing, arm, armBlock, charges, crisisMoment, healBlock, healNow, illuminate, illuminateBlock, isArmed,
  resolveDefeat, runEvent, submitChoice, submitPendingAuto, succeed, talentOffers, unarm, usesLeft, type World,
} from '../../src/index'
import { makeGame } from './life-fixture'

const serious = (w: World) => w.state.character!.injuries.push({ grade: 'serious', stat: 'str', remaining_min: 100, source: 'test' } as never)

// 같은 결과가 나올 때까지 패배를 굴린다(rng가 나아간다)
function defeatUntil(w: World, lethal: boolean, ok: (r: ReturnType<typeof resolveDefeat>) => boolean) {
  for (let i = 0; i < 200; i++) {
    const r = resolveDefeat(w, { regionId: 'D3', lethal, cause: 'combat' } as never)
    if (ok(r)) return r
  }
  throw new Error('원하는 패배 결과가 나오지 않았다')
}

describe('가호(D78)', () => {
  it('첫 가문은 별빛 1. 걸면 떼고 풀면 돌려준다. 사용 상한은 걸어 둔 수를 포함한다', () => {
    const w = makeGame()
    assert.equal(charges(w), 1)
    assert.equal(armBlock(w, 'final_save'), 'no_charge')
    assert.ok(arm(w, 'miracle'))
    assert.equal(charges(w), 0)
    assert.equal(usesLeft(w), 2)
    assert.ok(unarm(w, 'miracle'))
    assert.equal(charges(w), 1)
    w.state.family.blessing.charges = 3
    w.state.character!.blessing.uses = 2
    assert.ok(arm(w, 'mitigate'))
    assert.equal(armBlock(w, 'miracle'), 'life_cap')
  })

  it('최후의 순간: 최후 판정 실패를 중상 + 탈출로 바꾸고, 쓰면 생애 1번으로 막힌다', () => {
    const w = makeGame()
    w.state.family.blessing.charges = 3
    assert.ok(arm(w, 'final_save'))
    const r = defeatUntil(w, true, (x) => x.blessing === 'final_save')
    assert.equal(r.outcome, 'escaped')
    assert.equal(r.injury?.grade, 'serious')
    applyDefeat(w, r)
    const b = w.state.character!.blessing
    assert.deepEqual([b.final_used, b.uses, isArmed(w, 'final_save')], [true, 1, false])
    const e = w.state.journal.at(-1)!
    assert.deepEqual([e.tag, e.sub, e.line], ['injury', 'blessing', '이상하게도 쓰러진 자리에서 다시 눈을 떴다'])
    assert.equal(armBlock(w, 'final_save'), 'used')
  })

  it('누그러뜨림: 일반 패배의 손실이 없고 중상은 경상으로, 걸린 가호는 쓰인다', () => {
    const w = makeGame()
    assert.ok(arm(w, 'mitigate'))
    const r = resolveDefeat(w, { regionId: 'H1', lethal: false, cause: 'combat' } as never)
    assert.equal(r.blessing, 'mitigate')
    assert.equal(r.injury?.grade, 'light')
    assert.deepEqual(r.losses, { coins: 0, materials: {}, items: [] })
    applyDefeat(w, r)
    assert.equal(isArmed(w, 'mitigate'), false)
    assert.equal(w.state.journal.at(-1)!.sub, 'blessing')
  })

  it('기적의 주사위: 부상 판정이 실패하면 한 번 더 굴린 기록이 남고 가호가 쓰인다', () => {
    const w = makeGame()
    assert.ok(arm(w, 'miracle'))
    const r = defeatUntil(w, false, (x) => x.check?.record.reroll !== undefined)
    const rr = r.check!.record.reroll!
    assert.ok(rr.first >= 1 && rr.second >= 1)
    applyDefeat(w, r)
    assert.equal(isArmed(w, 'miracle'), false)
    assert.equal(w.state.character!.blessing.uses, 1)
  })

  it('상처 치유: 중상이 있을 때만, 바로 치유하고 기록을 남긴다', () => {
    const w = makeGame()
    assert.equal(healBlock(w), 'no_target')
    serious(w)
    assert.ok(healNow(w))
    assert.equal(w.state.character!.injuries.some((i) => i.grade === 'serious'), false)
    assert.equal(charges(w), 0)
    assert.equal(w.state.journal.at(-1)!.line, '이상하게도 상처가 하룻밤 새 아물었다')
  })

  it('숨은 길: 별빛 길은 비추기 전에는 보이지 않고, 비추면 고를 수 있으며 결과에 가호 표시가 붙는다', () => {
    const w = makeGame()
    w.state.family.blessing.charges = 2
    runEvent(w, 'F03', { place: 'A4', force: true }, w.ports)
    const p = w.state.pending_choice!
    assert.ok(p, '선택 대기')
    assert.equal(p.choices_visible.includes('star'), false)
    assert.equal(illuminateBlock(w), null)
    assert.deepEqual(illuminate(w), ['star'])
    assert.equal(illuminateBlock(w), 'no_target') // 한 사건에 한 번
    submitChoice(w, 'star', w.ports)
    const res = w.state.journal.find((e) => e.line === '잔 속 별을 본 성주가 사연을 들려주었다')!
    assert.equal(res.sub, 'blessing')
    assert.ok(w.state.character!.flags['life.f03_clue'])
    assert.ok(w.state.pending_choice, '받는다·내려놓는다를 다시 고른다')
    assert.equal(w.state.pending_choice!.choices_visible.includes('ask'), true)
    assert.ok(w.state.pending_choice!.excluded.includes('star'))
  })

  it('자동 선택은 별빛 길을 고르지 않는다', () => {
    const w = makeGame()
    runEvent(w, 'F03', { place: 'A4', force: true }, w.ports)
    submitPendingAuto(w)
    assert.equal(w.state.journal.some((e) => e.sub === 'blessing'), false)
  })

  it('극복 순간은 한 생애 2번, 별빛은 상한 3을 넘지 않는다', () => {
    const w = makeGame()
    crisisMoment(w)
    crisisMoment(w)
    crisisMoment(w)
    assert.equal(charges(w), 3)
    assert.equal(w.state.character!.blessing.crisis_gains, 2)
    w.state.family.blessing.charges = 0
    crisisMoment(w)
    assert.equal(charges(w), 0)
  })

  it('시작 축복: 후보는 다시 물어도 같고, 기울어진 재능은 합 11을 지킨다', () => {
    const w = makeGame()
    const offers = talentOffers(w)
    assert.deepEqual(talentOffers(w), offers)
    const ch = w.state.character!
    const sum = () => Object.values(ch.birth_stats).reduce((a, b) => a + b, 0)
    const before = sum()
    const from = (Object.keys(ch.birth_stats) as (keyof typeof ch.birth_stats)[]).find((s) => ch.birth_stats[s] > 1)!
    const to = (Object.keys(ch.birth_stats) as (keyof typeof ch.birth_stats)[]).find((s) => s !== from && ch.birth_stats[s] < 4)!
    applyStartBlessing(w, { kind: 'tilt', from, to })
    assert.equal(sum(), before)
    assert.equal(ch.blessing.start, 'tilt')
    assert.throws(() => applyStartBlessing(w, { kind: 'handful' }), /이미 시작 축복/)
    assert.equal(w.state.journal.at(-1)!.line, '별이 유난히 밝은 밤이었다')
  })

  it('계승: 걸어 둔 가호는 돌려받고, 출발에 별빛 +1과 고른 시작 축복', () => {
    const w = makeGame({ autoSuccession: false })
    assert.ok(arm(w, 'miracle')) // 별빛 1 → 0
    for (let i = 0; i < 40000 && w.state.current_activity.state !== 'awaiting_succession'; i++) {
      if (w.state.pending_choice) submitPendingAuto(w)
      else w.advance(600)
    }
    assert.equal(w.state.current_activity.state, 'awaiting_succession')
    const before = charges(w)
    assert.ok(before >= 1, '걸어 둔 별빛이 돌아왔다')
    const heir = succeed(w, { blessing: { kind: 'handful' } })
    assert.equal(heir.blessing.start, 'handful')
    assert.equal(charges(w), Math.min(3, before + 2))
  })
})
