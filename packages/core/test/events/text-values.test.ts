// 사건 문장 값(16 §1.4.3): 효과 결과·가족 문맥·선택 창 값이 실제 값으로 채워지고, 못 채우면 조용히 비지 않고 예외다(I67).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { checkAchievements, createItemInstance, pendingSuccession } from '../../src/index'
import {
  applyOccurrence, makeConditionTest, newEffectOutput, prepareOccurrence, render, ruleContext, runEffects, textValues,
  type EffectRun, type EventScope,
} from '../../src/events/index'
import { baseContent, fakePorts, makeWorld, startSortie, type TestWorld } from './fixture'
import { makeGame, run as runLife } from '../integration/life-fixture'

function effectRun(tw: TestWorld, scope: EventScope, dice: Record<string, number> = {}): EffectRun {
  const test = makeConditionTest(tw.w, scope)
  return { w: tw.w, ports: fakePorts(), scope, test, rule: ruleContext(tw.w, test), pre: { dice, chance: {} }, rewardMult: 1, out: newEffectOutput() }
}

describe('빈 변수는 조용히 비지 않는다', () => {
  it('render는 값이 없는 변수·빈 값의 조사를 예외로 막는다', () => {
    const tw = makeWorld()
    const vals = textValues(tw.w, { place: 'T00', vars: {} })
    assert.equal(render('{name:이/가} 왔다', vals), '모라가 왔다')
    assert.throws(() => render('{partner:과/와} 걸었다', vals), /값이 없다: \{partner\}/) // 동반자가 아직 없다
  })
})

describe('효과 결과 값: {item}·{loot}(11 L02·L04)', () => {
  const buy = (offer: (tw: TestWorld) => string | null) => {
    const tw = makeWorld()
    tw.w.state.character!.coins = 5000
    const ports = { ...fakePorts(), economy: { offerPurchase: () => offer(tw) } }
    const occ = prepareOccurrence(tw.w, 'L02', 'T00', ports, { choiceId: 'buy' })
    applyOccurrence(tw.w, occ, ports)
    return { tw, occ, rec: tw.w.state.journal.at(-1)! }
  }

  it('사지 못하면 결과 한 줄은 구매 불발 문장, 도입은 선택자가 고른 물건', () => {
    const { occ, rec } = buy(() => null)
    const offered = baseContent.get('item', occ.vars.item!).name
    assert.equal(rec.line, '마음에 드는 물건이 없었다')
    assert.match(rec.detail ?? '', new RegExp(`수레 위에는 ${offered}`))
  })

  it('사면 한 줄과 도입 모두 산 물건 이름', () => {
    const { rec } = buy((tw) => createItemInstance(tw.w.content, tw.w.state, 'W02', 'common', {
      gen: 1, char_uid: tw.w.state.character!.uid, age: 18, location: 'T00', source: 'test',
    }).uid)
    const name = baseContent.get('item', 'W02').name
    assert.match(rec.line, new RegExp(`^부르는 값에 ${name}[을를] 샀다$`))
    assert.match(rec.detail ?? '', new RegExp(`수레 위에는 ${name}[이가] 햇빛에`))
  })

  it('{loot}는 준 장비 이름, 장비가 없으면 얻은 동전', () => {
    const tw = makeWorld()
    startSortie(tw, { location_id: 'H1' })
    const scope: EventScope = { place: 'H1', vars: {}, eventId: 'L04' }
    const a = effectRun(tw, scope)
    runEffects(a, [{ type: 'add_coins', amount: 21 }, { type: 'journal', tag: 'hunt', line: '굴 속에서 {loot:을/를} 꺼냈다' }], 't')
    assert.equal(a.out.journal.at(-1)!.line, '굴 속에서 동전 21개를 꺼냈다')
    const b = effectRun(tw, scope)
    b.ports = { ...b.ports, item: { ...b.ports.item, addItem: () => null } }
    // 아무것도 얻지 못했는데 {loot}를 쓰면 빈칸이 아니라 예외
    assert.throws(() => runEffects(b, [{ type: 'add_item', item_id: 'J02', to: 'bag' }, { type: 'journal', tag: 'hunt', line: '{loot:을/를} 꺼냈다' }], 't'), /값이 없다: \{loot\}/)
  })
})

describe('사건 동전은 번 동전에 든다(I65, 12 §7.1 coins_earned)', () => {
  it('add_coins는 소지금과 counters.coins_earned를 함께 올린다(대성공 배수 포함)', () => {
    const tw = makeWorld()
    const ch = tw.w.state.character!
    const before = ch.coins
    const a = effectRun(tw, { place: 'H1', vars: {} })
    a.rewardMult = 1.5
    runEffects(a, [{ type: 'add_coins', amount: 21 }], 't')
    assert.equal(ch.coins, before + 31)
    assert.equal(ch.counters.coins_earned, 31)
    runEffects(effectRun(tw, { place: 'H1', vars: {} }), [{ type: 'add_coins', amount: 0 }], 't')
    assert.equal(ch.counters.coins_earned, 31) // 0은 세지 않는다
  })
})

describe('기록 한 줄 문형(14 §5.1)', () => {
  it('roll_check: [판정] 한 줄은 결과 문장이다', () => {
    const tw = makeWorld()
    startSortie(tw, { location_id: 'A3', activity: 'adventure' })
    const fear = { type: 'roll_check', check: { kind: 'fear', dc_offset: 0 } }
    const ok = effectRun(tw, { place: 'A3', vars: {} }, { 't/0': 20 })
    runEffects(ok, [fear], 't')
    assert.equal(ok.out.journal[0]!.line, '공포 판정을 넘겼다')
    const bad = effectRun(tw, { place: 'A3', vars: {} }, { 't/0': 1 })
    runEffects(bad, [fear], 't')
    assert.equal(bad.out.journal[0]!.line, '공포 판정을 넘지 못했다')
    assert.ok(bad.out.journal[0]!.check, '판정식은 check 기록이 펼친다')
  })

  it('family_record: 도감은 [발견] 도감 문형(상세는 첫 발견 문형, D77), 연대기·인연 문장은 상세로', () => {
    const tw = makeWorld()
    const a = effectRun(tw, { place: 'A1', vars: {} })
    runEffects(a, [
      { type: 'family_record', kind: 'codex', key: 'A1-7', text: '이름 없는 무덤' },
      { type: 'family_record', kind: 'bond', key: 'k', text: '{name:이/가} {age}세에 아버지의 흔적을 찾아 주었다. 가문을 기억한다.' },
    ], 't')
    const [codex, bond] = a.out.journal
    assert.deepEqual([codex!.tag, codex!.line, codex!.detail], ['discovery', '이름 없는 무덤을 도감에 적었다', '모라가 이름 없는 무덤을 수첩에 적었다. 가문 최초의 발견이다.'])
    assert.deepEqual([bond!.tag, bond!.line, bond!.detail], ['bond', '가문 연대기에 새 장이 열렸다', '모라가 18세에 아버지의 흔적을 찾아 주었다. 가문을 기억한다.'])
  })

  it('가문 업적: 조사는 업적 이름을 따른다(은빛 패를)', () => {
    const tw = makeWorld()
    tw.w.state.character!.guild_rank = 'silver'
    const got = checkAchievements(tw.w).find((g) => g.name === '은빛 패')!
    assert.equal(got.journal.line, '은빛 패를 이루었다')
    assert.equal(got.journal.detail, '조약돌 가문이 은빛 패를 이루었다.')
  })
})

describe('선택 창 값(holdValues)', () => {
  it('F01 숙련 단계 {n}·{m}과 선택지 이익·대가가 렌더된다', () => {
    const tw = makeWorld()
    const ch = tw.w.state.character!
    ch.skills.melee.rank = 3
    ch.skills.search.rank = 1
    tw.w.state.policies.auto_specialization = 'none'
    tw.w.state.policies.fate_handling = 'hold'
    const ports = fakePorts()
    applyOccurrence(tw.w, prepareOccurrence(tw.w, 'F01', 'T00', ports), ports)
    const p = tw.w.state.pending_choice!
    const r = p.preview_rendered as { note?: string; choices: Record<string, Record<string, unknown>> }
    assert.match(r.note ?? '', /^근접 3단계 · 탐색 1단계 · 태도 /)
    for (const c of Object.values(r.choices)) for (const v of Object.values(c)) if (typeof v === 'string') assert.ok(!/[{}]/.test(v), v)
  })
})

describe('계승 첫 장 {first_page}(12 §1.3)', () => {
  it('기록 문장이 아니라 발견·유품·인연의 이름이다', () => {
    const world = makeGame()
    runLife(world)
    const page = pendingSuccession(world)!.firstPage
    const names = new Set([
      ...world.content.list('item').map((i) => i.name),
      ...world.content.list('npc').map((n) => n.name),
      ...world.content.list('region').flatMap((r) => (r.kind === 'adventure_route' ? r.discoveries.map((d) => d.name) : [])),
    ])
    assert.ok(names.has(page) || [...names].some((n) => page.endsWith(n)) || page.endsWith('의 이름'), page)
    assert.ok(!/다\.?$/.test(page), `문장이 들어갔다: ${page}`)
  })
})
