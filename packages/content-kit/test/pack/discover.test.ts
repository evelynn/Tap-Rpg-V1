import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { orderPacks } from '../../src/pack/discover'
import type { PackManifest } from '../../src/pack/manifest'

const m = (id: string, requires: string[] = []): PackManifest => ({ id, name: id, version: '0.1.0', requires })
const ids = (order: PackManifest[]) => order.map((p) => p.id)

describe('orderPacks', () => {
  it('서로 의존이 없는 팩은 id 사전순', () => {
    assert.deepEqual(ids(orderPacks([m('c'), m('a'), m('b')]).order), ['a', 'b', 'c'])
  })

  it('requires 팩을 먼저 둔다(깊이 우선)', () => {
    const { order, issues } = orderPacks([m('a', ['z']), m('b'), m('z'), m('y', ['a', 'b'])])
    assert.deepEqual(issues, [])
    assert.deepEqual(ids(order), ['z', 'a', 'b', 'y'])
  })

  it('순환은 P04', () => {
    const { issues } = orderPacks([m('a', ['b']), m('b', ['c']), m('c', ['a'])])
    assert.deepEqual(issues.map((i) => [i.code, i.message]), [['P04', 'requires 순환: a → b → c → a']])
  })

  it('로드 대상에 없는 requires는 P03', () => {
    const { issues } = orderPacks([m('a', ['base', 'nowhere']), m('base')])
    assert.deepEqual(issues.map((i) => [i.code, i.pack, i.pointer]), [['P03', 'a', '/requires/1']])
  })
})
