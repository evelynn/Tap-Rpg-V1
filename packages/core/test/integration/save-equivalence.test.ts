// 독립 검증 지적 C1·C2·M1의 회귀 테스트: 흡혈귀 갈증 저장(I73), F02 헌납 조건과 선택자(I74),
// 고유 장비 "가문이 가진 것"의 단일 정의와 로드 보정 B9(I75). C1·M1은 저장 → 로드 → 이어 진행이
// 중단 없이 진행한 것과 같은지까지 본다.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyMutation, applyOccurrence, canonicalJson, createItemInstance, familyHasItem, loadGameWorld, loadSave,
  makeConditionTest, makeSaveRoot, prepareOccurrence, serializeSave, submitChoice, submitPendingAuto, type World,
} from '../../src/index'
import { makeGame } from './life-fixture'

// 목표 유효 진행 분까지 60초씩 흘린다(offline/scenario.test.ts의 runTo와 같다)
function runTo(world: World, targetMin: number): void {
  for (;;) {
    const ch = world.state.character
    if (!ch || ch.eff_min >= targetMin) return
    if (world.state.pending_choice) {
      submitPendingAuto(world)
      continue
    }
    if (!world.clockRunning) return
    if (world.advance(Math.min(60, (targetMin - ch.eff_min) * 60)) === 0) return
  }
}

// 저장 → 직렬화 → 로드(치명 검사 K1~K7 + 보정 B1~B15) → 세계 복원
function saveLoad(world: World): { world: World; codes: string[] } {
  const root = makeSaveRoot(world.snapshot(), {
    app_version: '0.1.0', saved_at_utc: 1_790_000_000_000, content_packs: [{ id: 'base', version: '0.1.0' }], content_hash: 'test',
  })
  const r = loadSave(serializeSave(root), world.content)
  assert.ok(r.ok, r.ok ? '' : `저장을 읽지 못했다: ${r.code} ${r.message}`)
  return { world: loadGameWorld(world.content, r.root.body), codes: r.diagnostics.map((d) => d.code) }
}

const acquired = (w: World) => ({ gen: 1, char_uid: w.state.character!.uid, age: 30, location: 'T00', source: 'drop' })

describe('흡혈귀 갈증은 소수로 누적되고 저장을 다시 읽는다(09 §7.5, I73)', () => {
  const START = 20 // 변이를 거는 유효 진행 분
  const TOTAL = 120
  const vampire = (seed: string): World => {
    const w = makeGame({ seed, attitude: 'adventurous' })
    runTo(w, START)
    applyMutation(w, 'TM01')
    return w
  }

  it('출정 중 행동 길이만큼 +2/분을 잃지 않고 쌓는다', () => {
    const w = vampire('0123456789abcdef')
    runTo(w, START + 10)
    const t = w.state.character!.mutation!.thirst
    assert.ok(t > 0 && !Number.isInteger(t), `갈증 ${t}`)
  })

  for (const seed of ['0123456789abcdef', 'feedfacecafebeef']) {
    it(`갈증이 소수일 때 저장해도 이어 진행 결과가 중단 없이 진행한 것과 같다(${seed})`, () => {
      const whole = vampire(seed)
      runTo(whole, START + TOTAL)
      let fractional = 0
      for (const cut of [7, 33, 61, 95]) {
        const killed = vampire(seed)
        runTo(killed, START + cut)
        if (!Number.isInteger(killed.state.character?.mutation?.thirst ?? 0)) fractional += 1
        const { world: resumed } = saveLoad(killed)
        runTo(resumed, START + TOTAL)
        assert.equal(canonicalJson(resumed.snapshot()), canonicalJson(whole.snapshot()), `${seed} ${cut}분에서 저장한 뒤 결과가 달라졌다`)
      }
      assert.ok(fractional > 0, '소수 갈증인 저장 지점이 하나도 없다')
    })
  }
})

describe('F02 마신다: 조건과 헌납 유물 선택자가 같은 후보를 본다(09 §6.2, 11 F02, I74)', () => {
  const at51 = (): World => {
    const w = makeGame()
    const t = w.content.balance.time
    w.state.character!.eff_min = (51 - t.start_age) * t.min_per_year
    return w
  }
  const relic = (w: World, used: boolean): string => {
    const inst = createItemInstance(w.content, w.state, 'R03', undefined, acquired(w))
    if (used) inst.used = true
    w.state.inventory.equipped.relic = inst.uid
    return inst.uid
  }
  const open = (w: World): string[] => {
    applyOccurrence(w, prepareOccurrence(w, 'F02', 'A4', w.ports), w.ports)
    return w.state.pending_choice!.choices_visible
  }

  it('희귀 이상 유물이 쓴 R03(빈 병 기념품)뿐이면 행운 −2 변형만 보이고 선택 창이 깨지지 않는다', () => {
    const w = at51()
    relic(w, true)
    const cond = makeConditionTest(w, { place: 'A4', vars: {}, eventId: 'F02' })
    assert.equal(cond({ has_item_where: { slot: 'relic', grade_gte: 'rare' } }), false)
    const visible = open(w)
    assert.ok(visible.includes('drink_luck') && !visible.includes('drink'), visible.join(','))
    submitChoice(w, 'drink_luck', w.ports)
    assert.equal(w.state.character!.retire_age, 78)
  })

  it('쓰지 않은 R03이 있으면 그것을 바치는 변형이 보이고 이름이 채워진다', () => {
    const w = at51()
    const uid = relic(w, false)
    const visible = open(w)
    assert.ok(visible.includes('drink') && !visible.includes('drink_luck'), visible.join(','))
    submitChoice(w, 'drink', w.ports)
    assert.equal(w.state.item_instances[uid], undefined)
    const last = w.state.journal.at(-1)!
    assert.ok(!/[{}]/.test(`${last.line}${last.detail ?? ''}`), last.detail)
  })
})

describe('고유 장비 "가문이 가진 것"의 단일 정의와 로드 보정 B9(08 §9.5·§13.3, I75)', () => {
  // 판매한 고유 장비는 기록(08 §13.3)만 item_instances에 남고 어느 칸에도 없다
  const soldRecord = (w: World, defId: string): string => createItemInstance(w.content, w.state, defId, 'rare', acquired(w)).uid
  const inBag = (w: World, defId: string): string => {
    const uid = createItemInstance(w.content, w.state, defId, 'rare', acquired(w)).uid
    w.state.inventory.bag.push(uid)
    return uid
  }

  it('판매 기록만 남은 J05는 가문에 없고, 다시 얻은 J05를 로드가 지우지 않는다', () => {
    const w = makeGame()
    soldRecord(w, 'J05')
    assert.equal(familyHasItem(w, 'J05'), false)
    const fresh = inBag(w, 'J05')
    assert.equal(familyHasItem(w, 'J05'), true)
    const { world, codes } = saveLoad(w)
    assert.ok(!codes.includes('B9'), codes.join(','))
    assert.ok(world.state.inventory.bag.includes(fresh) && world.state.item_instances[fresh])
  })

  it('빈 병 기념품(쓴 R03) 옆의 새 R03도 지우지 않는다', () => {
    const w = makeGame()
    const empty = inBag(w, 'R03')
    w.state.item_instances[empty]!.used = true
    const fresh = inBag(w, 'R03')
    const { world, codes } = saveLoad(w)
    assert.ok(!codes.includes('B9'), codes.join(','))
    assert.ok(world.state.item_instances[empty] && world.state.item_instances[fresh])
  })

  it('가문이 가진 고유 장비가 둘이면 여전히 오래된 것만 남긴다', () => {
    const w = makeGame()
    const old = inBag(w, 'J05')
    const dup = inBag(w, 'J05')
    const { world, codes } = saveLoad(w)
    assert.ok(codes.includes('B9'))
    assert.ok(world.state.item_instances[old] && !world.state.item_instances[dup])
    assert.ok(!world.state.inventory.bag.includes(dup))
  })

  it('판매 기록과 다시 얻은 J05가 함께 있어도 저장 → 로드 → 이어 진행이 중단 없이 진행한 것과 같다', () => {
    const setup = (): World => {
      const w = makeGame({ seed: '0123456789abcdef' })
      runTo(w, 10)
      soldRecord(w, 'J05')
      inBag(w, 'J05')
      return w
    }
    const whole = setup()
    runTo(whole, 90)
    for (const cut of [11, 40, 73]) {
      const killed = setup()
      runTo(killed, cut)
      const { world: resumed } = saveLoad(killed)
      runTo(resumed, 90)
      assert.equal(canonicalJson(resumed.snapshot()), canonicalJson(whole.snapshot()), `${cut}분에서 저장한 뒤 결과가 달라졌다`)
    }
  })
})
