import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { LineQueue, type Grade } from '../src/records'

const RULES = { minSec: 4, importantSec: 8, queueMax: 5 }
const item = (id: number, grade: Grade = 'C') => ({ id, text: `기록 ${id}`, grade })

describe('한 줄 기록 교체(03 §2.5)', () => {
  it('첫 기록은 바로 보이고, 다음 기록은 최소 4초 뒤에 바뀐다', () => {
    const q = new LineQueue(RULES)
    q.push(item(1))
    assert.equal(q.update(0), true)
    q.push(item(2))
    assert.equal(q.current?.id, 1)
    assert.equal(q.update(3999), false)
    assert.equal(q.update(4000), true)
    assert.equal(q.current?.id, 2)
  })

  it('A 등급은 8초 보인다', () => {
    const q = new LineQueue(RULES)
    q.push(item(1, 'A'))
    q.update(0)
    q.push(item(2))
    assert.equal(q.update(7999), false)
    assert.equal(q.update(8000), true)
  })

  it('새 기록이 없으면 마지막 기록을 계속 보인다', () => {
    const q = new LineQueue(RULES)
    q.push(item(1))
    q.update(0)
    assert.equal(q.update(60000), false)
    assert.equal(q.current?.id, 1)
  })

  it('A는 맨 앞에 끼어들고 B는 C·D 앞에 선다', () => {
    const q = new LineQueue(RULES)
    q.push(item(1))
    q.update(0)
    q.push(item(2, 'C'))
    q.push(item(3, 'B'))
    q.push(item(4, 'A'))
    q.push(item(5, 'A'))
    assert.deepEqual(q.pending.map((p) => p.id), [4, 5, 3, 2])
  })

  it('대기열은 5개까지, 넘치면 등급이 낮고 오래된 기록부터 뺀다', () => {
    const q = new LineQueue(RULES)
    q.push(item(1))
    q.update(0) // 표시 중
    q.push(item(2, 'D'))
    q.push(item(3, 'C'))
    q.push(item(4, 'D'))
    q.push(item(5, 'B'))
    q.push(item(6, 'C'))
    q.push(item(7, 'A')) // 6개 → D 중 오래된 2가 빠진다
    assert.deepEqual(q.pending.map((p) => p.id), [7, 5, 3, 4, 6])
    q.push(item(8, 'C')) // 남은 D 4가 빠진다
    q.push(item(9, 'C')) // D가 없으면 C 중 가장 오래된 3이 빠진다
    assert.deepEqual(q.pending.map((p) => p.id), [7, 5, 6, 8, 9])
  })
})
