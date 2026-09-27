import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { defaultRelicOffer, relicOfferCandidates } from '../../src/life/index'
import { autoPickRelics, childhoodNote, designateRelic, dormantOpened, relicScore, relicsToPass, transferRelics } from '../../src/succession/index'
import { give, lifeWorld, setAge, stripStartingKit, withFamily } from './fixture'

// 한글 음절 받침 유무(14 §6). 조사 기대값을 이름에 맞춰 고른다
const hasFinal = (word: string): boolean => (word.codePointAt(word.length - 1)! - 0xac00) % 28 !== 0

describe('유품 자동 선택(12 §5.3)', () => {
  it('점수는 등급·고유·단계·사연을 더하고, 저주 장비는 후보에서 빠진다', () => {
    const w = lifeWorld()
    stripStartingKit(w)
    const good = give(w, 'W08', 'good', 'bag') // T4 좋은
    const plain = give(w, 'W02', 'common', 'bag') // T1 일반
    assert.ok(relicScore(w, w.state.item_instances[good]!) > relicScore(w, w.state.item_instances[plain]!))
    const cursed = w.content.list('item').find((i) => i.cursed)
    if (cursed) {
      const uid = give(w, cursed.id, 'common', 'bag')
      assert.equal(autoPickRelics(w, 4, []).some((i) => i.uid === uid), false)
    }
  })

  it('등록이 모자라면 자동 선택으로 채우고 개수 상한을 넘지 않는다', () => {
    const w = lifeWorld()
    stripStartingKit(w)
    const a = give(w, 'W07', 'rare', 'equip')
    give(w, 'W08', 'good', 'bag')
    give(w, 'J04', 'good', 'bag')
    designateRelic(w, a, 1)
    const passed = relicsToPass(w, 'retired')
    assert.equal(passed.length, 2)
    assert.equal(passed[0]!.uid, a) // 등록 1위가 먼저
    assert.equal(relicsToPass(w, 'died').length, 1)
  })

  it('유품 등록은 최대 2개이고 같은 순위는 덮어쓴다(12 §5.1)', () => {
    const w = lifeWorld()
    const a = give(w, 'W07', 'rare', 'bag')
    const b = give(w, 'W08', 'good', 'bag')
    const c = give(w, 'J04', 'good', 'bag')
    designateRelic(w, a, 1)
    designateRelic(w, b, 2)
    designateRelic(w, c, 1)
    assert.deepEqual(w.state.inventory.relic_designations, [{ uid: c, priority: 1 }, { uid: b, priority: 2 }])
  })
})

describe('잠재 상태 개방(12 §5.5)', () => {
  it('레벨 기준 단계가 유품 단계에 닿으면 개방 기록을 남긴다', () => {
    const w = lifeWorld()
    const uid = give(w, 'W07', 'rare', 'equip') // T3 → 레벨 12에 개방
    w.state.item_instances[uid]!.inherited_from_gen = 1
    assert.deepEqual(dormantOpened(w, 1, 11), [])
    const opened = dormantOpened(w, 11, 12)
    assert.equal(opened.length, 1)
    assert.match(opened[0]!.line, /손에 맞기 시작했다/)
    const name = w.content.get('item', w.state.item_instances[uid]!.def_id).name
    assert.ok(opened[0]!.line.includes(`${hasFinal(name) ? '이' : '가'} 손에 맞기`), opened[0]!.line)
    assert.equal(w.state.item_instances[uid]!.history.at(-1)!.kind, 'potential_opened')
  })
})

describe('유품 이전 문장의 조사(14 §6)', () => {
  it('앞 세대 이름과 장비 이름의 받침에 맞춰 조사를 고른다(누리가 남겼다, 하준이 남겼다)', () => {
    for (const parent of ['누리', '하준']) {
      const w = lifeWorld()
      const uid = give(w, 'W07', 'rare', 'bag')
      const inst = w.state.item_instances[uid]!
      const name = w.content.get('item', inst.def_id).name
      const r = transferRelics(w, [inst], 1, parent, 64)
      assert.equal(inst.history.at(-1)!.text, `${parent}${hasFinal(parent) ? '이' : '가'} 남겼다`)
      assert.equal(inst.history.at(-1)!.age, 64) // 물려준 나이(획득 나이가 아니다)
      assert.match(r.journal[0]!.line, new RegExp(`${hasFinal(name) ? '을' : '를'} 물려받았다$`))
    }
  })
})

describe('F02 헌납 유물 기본 선택(09 §6.2)', () => {
  it('희귀 이상 유물 중 유품 등록이 안 된 것 가운데 기준 가격이 가장 낮은 것', () => {
    const w = lifeWorld()
    const cheap = give(w, 'R02', 'rare', 'bag')
    const dear = give(w, 'R04', 'rare', 'equip')
    assert.equal(relicOfferCandidates(w).length, 2)
    assert.equal(defaultRelicOffer(w)!.uid, cheap)
    // 등록된 유물만 남으면 경고를 단다
    designateRelic(w, cheap, 1)
    const pick = defaultRelicOffer(w)!
    assert.equal(pick.uid, dear)
    assert.equal(pick.registered, false)
    designateRelic(w, dear, 2)
    const warned = defaultRelicOffer(w)!
    assert.equal(warned.registered, true)
    assert.match(warned.note, /다음 세대에 남길 물건/)
  })

  it('희귀 이상 유물이 없으면 후보가 없다(대체 대가 행운 −2)', () => {
    const w = lifeWorld()
    give(w, 'R02', 'common', 'bag')
    assert.deepEqual(relicOfferCandidates(w), [])
    assert.equal(defaultRelicOffer(w), null)
  })
})

describe('자녀의 어린 시절 기록(12 §2.2)', () => {
  it('자녀가 있어야 나오고 생애 최대 횟수를 넘지 않는다', () => {
    const w = lifeWorld()
    setAge(w, 30)
    assert.equal(childhoodNote(w), null) // 자녀 없음
    withFamily(w, 2)
    const max = w.content.balance.inheritance.childhood.max_per_life
    let made = 0
    for (let i = 0; i < 400; i++) if (childhoodNote(w)) made += 1
    assert.equal(made, max)
    assert.equal(w.state.character!.counters.childhood_notes, max)
  })
})

describe('유품 해제·태도 바꾸기(03 §5.3.1·§5.4)', () => {
  it('해제하면 등록에서 빠진다', async () => {
    const { undesignateRelic } = await import('../../src/succession/index')
    const w = lifeWorld()
    const a = give(w, 'W07', 'rare', 'bag')
    designateRelic(w, a, 1)
    undesignateRelic(w, a)
    assert.deepEqual(w.state.inventory.relic_designations, [])
  })

  it('태도를 바꾸면 방침과 태도 이력이 바뀌고, 같은 순간 두 번은 마지막 값만 남는다', async () => {
    const { setAttitude } = await import('../../src/ai/index')
    const w = lifeWorld()
    const ch = w.state.character!
    const before = ch.attitude_log.length
    ch.eff_min = 42
    setAttitude(w, 'stable')
    setAttitude(w, 'challenging')
    assert.equal(w.state.policies.attitude, 'challenging')
    assert.equal(ch.attitude_log.length, before + 1)
    assert.deepEqual(ch.attitude_log.at(-1), { eff_min: 42, attitude: 'challenging' })
    assert.throws(() => setAttitude(w, 'nope'))
  })
})
