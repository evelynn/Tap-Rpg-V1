import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { World, addXp, type ActionResolver, type WorldOptions } from '../../src/index'
import { makeContent, makeWorld } from '../fixture'

// 가짜 사냥 조우: 시작 때 combat·world·loot 흐름으로 결과를 모두 굴리고, 적용 때 동전·경험치(레벨업 배분은 life 흐름)
const encounter: ActionResolver = {
  resolve(w) {
    const rounds = [1, 2, 3].map(() => {
      const dice = w.rng.combat.d20()
      return { actor: 'char', dice, total: dice + 3, target_ac: 12, hit: dice + 3 >= 12, damage: w.rng.combat.int(2, 5) }
    })
    const coins = w.rng.loot.int(3, 9)
    return {
      duration_sec: w.rng.world.int(30, 50),
      rounds,
      outcome: rounds.some((r) => r.hit) ? 'win' : 'stalemate',
      effects: [{ type: 'add_coins', amount: coins }, { type: 'add_xp', amount: 40 }],
      journal: [{ tag: 'hunt', line: `들쥐를 쫓고 동전 ${coins}개를 얻었다` }],
    }
  },
  apply(w, a) {
    const ch = w.state.character!
    for (const e of a.effects) {
      if (e.type === 'add_coins') ch.coins += e.amount as number
      if (e.type === 'add_xp') addXp(w, w.rng.life, e.amount as number)
    }
  },
}

const opts: WorldOptions = { resolvers: { encounter }, decide: () => 'encounter' }
const content = makeContent()
// 할 일이 없을 때의 대기: 길이가 정해진 행동(마을 대기)
const idle: ActionResolver = { resolve: () => ({ duration_sec: 60, outcome: 'idle', effects: [], journal: [] }), apply: () => {} }
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

describe('행동 골격(13 §8.1·§8.3)', () => {
  it('같은 시드 → 같은 결과', () => {
    const a = makeWorld(content, opts)
    const b = makeWorld(content, opts)
    assert.equal(a.advance(3600), 3600)
    b.advance(3600)
    assert.deepEqual(a.snapshot(), b.snapshot())
    assert.ok(a.state.character!.level > 1)
    assert.ok(a.state.journal.length > 50)
  })

  it('행동 시작 후 저장을 복제해 이어 가도 결과가 같다(재추첨 없음)', () => {
    const a = makeWorld(content, opts)
    a.advance(10) // 첫 조우를 시작만 한 상태
    const pending = a.state.current_activity.resolved_action!
    assert.equal(pending.applied, false)
    const saved = a.snapshot()

    const b = new World(content, JSON.parse(JSON.stringify(saved)), opts)
    b.advance(5) // 아직 끝나지 않음: 확정 결과가 그대로다
    assert.deepEqual(b.state.current_activity.resolved_action, saved.current_activity.resolved_action)

    a.advance(1995)
    b.advance(1990)
    assert.deepEqual(a.snapshot(), b.snapshot())
  })

  it('시간을 나눠 흘려도 한 번에 흘린 것과 같다', () => {
    const a = makeWorld(content, opts)
    const b = makeWorld(content, opts)
    a.advance(900)
    for (let i = 0; i < 36; i++) b.advance(25)
    assert.deepEqual(a.snapshot(), b.snapshot())
  })

  it('결정기는 행동 사이에만 불린다: 결정기가 난수를 써도 나눠 흘린 결과가 같다', () => {
    const o: WorldOptions = {
      resolvers: { encounter, town: idle },
      decide: (w) => (w.rng.world.d20() > 10 ? 'encounter' : 'town'),
    }
    const a = makeWorld(content, o)
    const b = makeWorld(content, o)
    a.advance(600)
    for (let i = 0; i < 600; i++) b.advance(1)
    assert.deepEqual(a.snapshot(), b.snapshot())
  })

  it('행동 시작·적용 직후 state의 난수 상태가 맞아, snapshot 없이 state를 복제해도 이어진다', () => {
    const a = makeWorld(content, opts)
    a.advance(10) // 첫 조우를 시작만 한 상태
    const b = new World(content, clone(a.state), opts)
    a.advance(600)
    b.advance(600)
    assert.deepEqual(a.snapshot(), b.snapshot())
  })

  it('적용하지 않은 확정 결과가 있으면 새 행동을 시작하지 않는다(재추첨 방지)', () => {
    const w = makeWorld(content, opts)
    w.advance(1)
    assert.throws(() => w.startAction('encounter'), /적용하지 않은 확정 결과/)
  })

  it('apply가 인물을 없애도(사망) 그 행동의 기록은 원래 인물에 남는다', () => {
    const death: ActionResolver = {
      resolve: () => ({ duration_sec: 30, outcome: 'death', effects: [], journal: [{ tag: 'death', line: '돌아오지 않았다' }] }),
      apply: (w) => {
        w.state.character = null
      },
    }
    const w = makeWorld(content, { resolvers: { encounter: death }, decide: () => 'encounter' })
    const uid = w.state.character!.uid
    assert.equal(w.advance(600), 30)
    const last = w.state.journal.at(-1)!
    assert.deepEqual([last.tag, last.char_uid, last.importance, last.eff_min], ['death', uid, 'family', 0.5])
    assert.equal(w.clockRunning, false)
  })

  it('0초 행동이 끝없이 이어지면 예외(무한 반복 방지)', () => {
    const instant: ActionResolver = { resolve: () => ({ duration_sec: 0, outcome: 'x', effects: [], journal: [] }), apply: () => {} }
    const w = makeWorld(content, { resolvers: { event: instant }, decide: () => 'event' })
    assert.throws(() => w.advance(10), /0초 행동이/)
  })

  it('확정 결과는 시간이 다 찬 뒤에 적용하고, 기록 id는 적용 때 받는다', () => {
    const w = makeWorld(content, opts)
    const coins = w.state.character!.coins
    w.advance(1)
    const act = w.state.current_activity.resolved_action!
    assert.equal(w.state.character!.coins, coins)
    w.advance(act.duration_sec - 1)
    assert.equal(act.applied, true)
    assert.equal(w.state.character!.coins, coins + (act.effects[0]!.amount as number))
    assert.equal(w.state.journal.at(-1)!.eff_min, act.duration_sec / 60)
  })
})

describe('유효 진행 시계와 정지 상태', () => {
  it('일시정지 동안 시간이 흐르지 않고, 재개하면 이전 상태로 돌아간다', () => {
    const w = makeWorld(content, opts)
    w.state.current_activity.state = 'hunt'
    w.pause()
    assert.equal(w.advance(600), 0)
    assert.equal(w.state.character!.eff_min, 0)
    w.resume()
    assert.equal(w.state.current_activity.state, 'hunt')
    assert.equal(w.advance(600), 600)
  })

  it('선택 대기가 되면 그 자리에서 멈춘다', () => {
    const fate: ActionResolver = {
      resolve: () => ({ duration_sec: 40, outcome: 'hold', effects: [], journal: [] }),
      apply: (w) => {
        w.state.current_activity.state = 'awaiting_choice'
      },
    }
    const w = makeWorld(content, { resolvers: { event: fate }, decide: () => 'event' })
    assert.equal(w.advance(600), 40)
    assert.equal(w.clockRunning, false)
    assert.equal(w.advance(600), 0)
  })

  it('계승 대기(인물 없음)면 시계가 멈춘다', () => {
    const w = makeWorld(content, opts)
    w.state.character = null
    assert.equal(w.advance(60), 0)
  })

  it('나이가 바뀌면 노화 이정표를 적용하고 onAge로 알린다', () => {
    const ages: [number, number, number][] = []
    const w = makeWorld(content, {
      resolvers: { town: idle }, decide: () => 'town',
      onAge: (_w, from, to, changes) => ages.push([from, to, changes.length]),
    })
    const ch = w.state.character!
    const { kno, wil } = ch.stats
    w.advance(32 * 12 * 60) // 32년 = 384분 → 50세
    assert.equal(ch.eff_min, 384)
    assert.equal(ch.stats.kno, Math.min(8, kno + 1))
    assert.equal(ch.stats.wil, Math.min(8, wil + 1))
    assert.equal(ages.length, 32)
    assert.deepEqual(ages.at(-1), [49, 50, (kno < 8 ? 1 : 0) + (wil < 8 ? 1 : 0)])
  })

  it('해석기·결정기가 없으면 예외', () => {
    const w = makeWorld(content, { resolvers: {}, decide: () => 'camp' })
    assert.throws(() => w.advance(10), /행동 해석기가 없다: camp/)
    assert.throws(() => makeWorld(content).advance(10), /행동 결정기가 없다/)
  })
})
