// 기록 띠·말풍선(03 §2.7, D82)
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { World } from '@tap/core'
import { BUBBLE, BubbleQueue, bubbleWorthy, stripView } from '../src/overlay'

const entry = (id: number, over: Record<string, unknown> = {}) => ({ id, age: 18 + id, tag: 'hunt', line: `기록 ${id}`, importance: 'daily', ...over })

describe('기록 띠·말풍선(D82)', () => {
  it('기록 띠: 최근 기록 3개(오래된 것 위)와 가장 새 기록의 상세 문장', () => {
    const w = { state: { journal: [entry(1), entry(2), entry(3, { tag: 'town' }), entry(4, { detail: '마을 어귀에서 숨을 골랐다.' })] } } as unknown as World
    const v = stripView(w)
    assert.deepEqual(v.rows.map((r) => r.text), ['20세 [사냥] 기록 2', '21세 [마을] 기록 3', '22세 [사냥] 기록 4'])
    assert.equal(v.detail, '마을 어귀에서 숨을 골랐다.')
    assert.deepEqual(stripView({ state: { journal: [] } } as unknown as World), { rows: [], detail: '' })
  })

  it('말풍선 대상: 중요 기록, 운명·연속 사건, 희귀 이상 장비, 세대 교대만', () => {
    assert.ok(bubbleWorthy({ tag: 'growth', importance: 'major' }))
    assert.ok(bubbleWorthy({ tag: 'house', importance: 'family' }))
    assert.ok(bubbleWorthy({ tag: 'adventure', importance: 'daily', refs: { event_id: 'C01-3' } }, 'chain'))
    assert.ok(bubbleWorthy({ tag: 'growth', importance: 'daily' }, 'fate'))
    assert.ok(bubbleWorthy({ tag: 'gear', sub: 'rare_gain', importance: 'daily' }))
    for (const tag of ['retire', 'death', 'succession'] as const) assert.ok(bubbleWorthy({ tag, importance: 'daily' }))
    assert.equal(bubbleWorthy({ tag: 'hunt', importance: 'daily' }), false)
    assert.equal(bubbleWorthy({ tag: 'town', importance: 'last_chapter' }), false)
    assert.equal(bubbleWorthy({ tag: 'town', importance: 'daily' }, 'life'), false)
  })

  it('말풍선은 8초 보이고, 앞 것이 4초 이상 보였으면 다음 것으로 바꾸며, 기다리는 것은 3개까지', () => {
    const q = new BubbleQueue()
    q.push({ id: 1, line: 'a', detail: '' })
    q.update(0)
    assert.equal(q.current?.id, 1)
    q.push({ id: 2, line: 'b', detail: '' })
    q.update(BUBBLE.minMs - 1)
    assert.equal(q.current?.id, 1, '4초 전에는 바꾸지 않는다')
    q.update(BUBBLE.minMs)
    assert.equal(q.current?.id, 2)
    q.update(BUBBLE.minMs + BUBBLE.holdMs)
    assert.equal(q.current, null, '8초가 지나면 사라진다')
    for (let i = 3; i <= 7; i++) q.push({ id: i, line: '', detail: '' })
    assert.deepEqual(q.pending.map((b) => b.id), [5, 6, 7])
  })
})
