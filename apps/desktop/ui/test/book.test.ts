// 책 보기 쪽 나누기(03 §5.6, 18 §8.3)
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { bookPages, type BookLike } from '../src/book'

const book = (blocks: number, len = 60): BookLike => ({
  cover: { family: '조약돌', volume: 1, title: '샘을 양보한 모라', subtitle: '18~68세 · 은퇴', end_kind: 'retired', emblem: 'lamp_lit', spine: 'mid' },
  epigraph: { text: '앞에 선다는 건, 뒤를 믿는다는 거야.', speaker: '하델' }, binder: '미루',
  chapters: [
    { key: 'ch1', head: '1장 · 새내기', subtitle: '여울가의 첫걸음', age_from: 18, age_to: 29, blocks: Array.from({ length: blocks }, (_, i) => ({ kind: i === 2 ? 'fork' : 'entry', text: '가'.repeat(len), src: [i] })) },
    { key: 'close', head: '맺는 장 · 등불을 걸다', subtitle: '', age_from: 60, age_to: 68, blocks: [{ kind: 'closing', text: '모라는 여울가 집으로 돌아갔다.', src: [] }] },
  ],
  appendix: { people: ['토리'], left: ['낡은 호각'], walk: ['출정 120회'] }, afterword: null, opened: false,
})

describe('생애의 책 쪽 나누기', () => {
  it('표지·속표지·차례·장·맺는 장·부록은 새 쪽에서 시작한다', () => {
    const parts = bookPages(book(3)).map((p) => p.part)
    assert.deepEqual([...new Set(parts)], ['표지', '속표지', '차례', '1장 · 새내기', '맺는 장 · 등불을 걸다', '부록'])
  })
  it('한 쪽은 18줄을 넘지 않고, 블록은 쪽 사이에서 나누지 않는다(한 쪽보다 긴 블록만 잇는다)', () => {
    const pages = bookPages(book(20))
    for (const p of pages) assert.ok(p.lines.length <= 18)
    const ch = pages.filter((p) => p.part === '1장 · 새내기')
    assert.ok(ch.length >= 2)
    // 60자 블록은 2줄(34자씩) — 쪽 끝에서 한 줄만 남기고 넘어가지 않는다
    for (const p of ch.slice(1)) assert.notEqual(p.lines[0]!.text, '')
    const long = bookPages(book(1, 34 * 25))
    assert.ok(long.filter((p) => p.part === '1장 · 새내기').length >= 2, '긴 블록은 줄 단위로 잇는다')
  })
  it('갈림길 상자는 모양 표시(fork)를 달고 좁은 폭으로 접는다', () => {
    const lines = bookPages(book(3)).flatMap((p) => p.lines)
    assert.ok(lines.some((l) => l.cls === 'fork'))
    assert.ok(lines.filter((l) => l.cls === 'fork').every((l) => [...l.text].length <= 32))
  })
})
