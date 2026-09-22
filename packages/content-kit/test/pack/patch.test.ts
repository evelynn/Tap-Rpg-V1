import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergePatch } from '../../src/pack/patch'

describe('mergePatch (RFC 7386)', () => {
  it('RFC 7386 부록 A 예시', () => {
    const cases: [unknown, unknown, unknown][] = [
      [{ a: 'b' }, { a: 'c' }, { a: 'c' }],
      [{ a: 'b' }, { b: 'c' }, { a: 'b', b: 'c' }],
      [{ a: 'b' }, { a: null }, {}],
      [{ a: 'b', b: 'c' }, { a: null }, { b: 'c' }],
      [{ a: ['b'] }, { a: 'c' }, { a: 'c' }],
      [{ a: 'c' }, { a: ['b'] }, { a: ['b'] }],
      [{ a: { b: 'c' } }, { a: { b: 'd', c: null } }, { a: { b: 'd' } }],
      [{ a: [{ b: 'c' }] }, { a: [1] }, { a: [1] }],
      [['a', 'b'], ['c', 'd'], ['c', 'd']],
      [{ a: 'b' }, ['c'], ['c']],
      [{ a: 'foo' }, null, null],
      [{ a: 'foo' }, 'bar', 'bar'],
      [{ e: null }, { a: 1 }, { e: null, a: 1 }],
      [[1, 2], { a: 'b', c: null }, { a: 'b' }],
      [{}, { a: { bb: { ccc: null } } }, { a: { bb: {} } }],
    ]
    for (const [target, patch, want] of cases) assert.deepEqual(mergePatch(target, patch), want)
  })

  it('원본을 바꾸지 않고 키 순서를 유지한다', () => {
    const target = { x: 1, y: { z: 1, k: 0 }, w: 2 }
    const out = mergePatch(target, { y: { z: 2 }, n: 3 }) as Record<string, unknown>
    assert.deepEqual(Object.keys(out), ['x', 'y', 'w', 'n'])
    assert.deepEqual(out.y, { z: 2, k: 0 })
    assert.deepEqual(target, { x: 1, y: { z: 1, k: 0 }, w: 2 })
  })

  it('키 __proto__는 프로토타입을 바꾸지 않고 own 키로 남는다(스키마가 모르는 필드로 거른다)', () => {
    const out = mergePatch({ a: 1, b: { c: 1 } }, JSON.parse('{"__proto__":{"x":1},"b":{"__proto__":{"y":2}}}')) as Record<string, any>
    assert.equal(Object.getPrototypeOf(out), Object.prototype)
    assert.equal(Object.getPrototypeOf(out.b), Object.prototype)
    assert.ok(Object.hasOwn(out, '__proto__') && Object.hasOwn(out.b, '__proto__'))
    assert.equal(out.x, undefined)
    assert.equal(JSON.stringify(out), '{"a":1,"b":{"c":1,"__proto__":{"y":2}},"__proto__":{"x":1}}')
  })
})
