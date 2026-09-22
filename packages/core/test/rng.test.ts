import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { Pcg32, RNG_STREAMS, createRngStreams, sha256, streamSeed, utf8 } from '../src/rng/index'

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex')
const nodeSha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex')

describe('sha256', () => {
  it('NIST 벡터', () => {
    assert.equal(hex(sha256(utf8('abc'))), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    assert.equal(hex(sha256(utf8(''))), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    assert.equal(
      hex(sha256(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))),
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    )
  })

  it('패딩 경계 길이 0~200바이트가 node:crypto와 같다', () => {
    for (let n = 0; n <= 200; n++) {
      const data = Uint8Array.from({ length: n }, (_, i) => (i * 131 + n) & 255)
      assert.equal(hex(sha256(data)), nodeSha(data), `길이 ${n}`)
    }
  })

  it('utf8은 Buffer와 같은 바이트를 낸다', () => {
    for (const s of ['abc', '리아:combat', 'é¢€', '🐺 늑대']) assert.equal(hex(utf8(s)), Buffer.from(s, 'utf8').toString('hex'))
  })
})

describe('Pcg32', () => {
  it('기준 벡터: pcg32_srandom(42, 54)', () => {
    const rng = Pcg32.seed(42n, 54n)
    const out = Array.from({ length: 6 }, () => rng.nextU32())
    assert.deepEqual(out, [0xa15c02b7, 0x7b47f409, 0xba1d3330, 0x83d2f293, 0xbfa4784b, 0xcbed606e])
  })

  it('기준 벡터: pcg32-demo Coins·Rolls(bounded = pcg32_boundedrand_r)', () => {
    const rng = Pcg32.seed(42n, 54n)
    for (let i = 0; i < 6; i++) rng.nextU32()
    const coins = Array.from({ length: 65 }, () => (rng.bounded(2) ? 'H' : 'T')).join('')
    const rolls = Array.from({ length: 33 }, () => rng.bounded(6) + 1).join(' ')
    assert.equal(coins, 'HHTTTHTHHHTHTTTHHHHHTTTHHHTHTHTHTTHTTTHHHHHHTTTTHHTTTTTHTTTTTTTHT')
    assert.equal(rolls, '3 4 1 1 2 2 3 2 4 3 2 4 3 3 5 2 3 1 3 1 5 1 4 1 5 6 4 6 6 2 6 3 3')
  })

  it('16 §5.8 예시 상태를 받아들이고 그대로 돌려준다', () => {
    const s = { state: '853c49e6748fea9b', inc: 'da3e39cb94b95bdb' }
    assert.deepEqual(Pcg32.fromState(s).toState(), s)
  })

  it('상태 직렬화 왕복 후 같은 수열', () => {
    const rng = Pcg32.seed(42n, 54n)
    for (let i = 0; i < 37; i++) rng.nextU32()
    const saved = rng.toState()
    assert.match(saved.state, /^[0-9a-f]{16}$/)
    assert.match(saved.inc, /^[0-9a-f]{16}$/)
    const restored = Pcg32.fromState(JSON.parse(JSON.stringify(saved)))
    assert.deepEqual(restored.toState(), saved)
    for (let i = 0; i < 50; i++) assert.equal(restored.nextU32(), rng.nextU32())
  })

  it('잘못된 상태는 거부한다', () => {
    assert.throws(() => Pcg32.fromState({ state: '853c49e6748fea9b', inc: 'da3e39cb94b95bda' })) // 짝수 inc
    assert.throws(() => Pcg32.fromState({ state: 'xyz', inc: 'da3e39cb94b95bdb' }))
  })

  it('bounded는 [0, n) 안에 있다', () => {
    const rng = Pcg32.seed(1n, 2n)
    for (const n of [1, 2, 3, 7, 20, 1000, 0x80000001, 0xffffffff]) {
      for (let i = 0; i < 300; i++) {
        const v = rng.bounded(n)
        assert.ok(Number.isInteger(v) && v >= 0 && v < n, `n=${n} v=${v}`)
      }
    }
    assert.throws(() => rng.bounded(0), RangeError)
    assert.throws(() => rng.bounded(2 ** 32), RangeError)
    assert.throws(() => rng.bounded(2.5), RangeError)
  })

  it('int·d20은 양 끝을 포함한다', () => {
    const rng = Pcg32.seed(7n, 9n)
    const ints = new Set(Array.from({ length: 500 }, () => rng.int(-2, 2)))
    assert.deepEqual([...ints].sort((a, b) => a - b), [-2, -1, 0, 1, 2])
    const d = new Set(Array.from({ length: 2000 }, () => rng.d20()))
    assert.equal(d.size, 20)
    assert.equal(Math.min(...d), 1)
    assert.equal(Math.max(...d), 20)
  })

  it('chance: 0은 항상 거짓, 1은 항상 참, 매번 1회 소비', () => {
    const a = Pcg32.seed(3n, 4n)
    const b = Pcg32.seed(3n, 4n)
    for (let i = 0; i < 200; i++) {
      assert.equal(a.chance(0), false)
      assert.equal(a.chance(1), true)
      b.nextU32()
      b.nextU32()
    }
    assert.equal(a.nextU32(), b.nextU32())
  })

  it('weightedIndex·pick', () => {
    const rng = Pcg32.seed(5n, 6n)
    for (let i = 0; i < 200; i++) assert.equal(rng.weightedIndex([0, 5, 0]), 1)
    const seen = new Set(Array.from({ length: 500 }, () => rng.weightedIndex([1, 0, 3])))
    assert.deepEqual([...seen].sort(), [0, 2])
    assert.throws(() => rng.weightedIndex([0, 0]), RangeError)
    assert.throws(() => rng.weightedIndex([1, -1]), RangeError)
    assert.throws(() => rng.weightedIndex([0.5, 1]), RangeError)
    const items = ['a', 'b', 'c'] as const
    for (let i = 0; i < 100; i++) assert.ok(items.includes(rng.pick(items)))
    assert.throws(() => rng.pick([]), RangeError)
  })
})

describe('난수 흐름', () => {
  const familySeed = '9e3779b97f4a7c15'

  it('흐름 5개', () => {
    assert.deepEqual([...RNG_STREAMS], ['combat', 'loot', 'event', 'life', 'world'])
  })

  it('시드 파생이 SHA-256 앞 16바이트(빅엔디언)와 같다', () => {
    for (const s of RNG_STREAMS) {
      const d = createHash('sha256').update(`${familySeed}:${s}`, 'utf8').digest()
      assert.deepEqual(streamSeed(familySeed, s), { initstate: d.readBigUInt64BE(0), initseq: d.readBigUInt64BE(8) })
    }
  })

  it('같은 가문 시드면 같은 수열, 흐름끼리는 다르다', () => {
    const a = createRngStreams(familySeed)
    const b = createRngStreams(familySeed)
    const firsts = RNG_STREAMS.map((s) => {
      const v = a[s].nextU32()
      assert.equal(b[s].nextU32(), v)
      return v
    })
    assert.equal(new Set(firsts).size, RNG_STREAMS.length)
    assert.notDeepEqual(createRngStreams('0000000000000001').combat.toState(), createRngStreams(familySeed).combat.toState())
  })

  it('한 흐름의 소비가 다른 흐름을 흔들지 않는다', () => {
    const a = createRngStreams(familySeed)
    const b = createRngStreams(familySeed)
    for (let i = 0; i < 1000; i++) a.combat.d20()
    for (let i = 0; i < 20; i++) assert.equal(a.loot.nextU32(), b.loot.nextU32())
  })
})
