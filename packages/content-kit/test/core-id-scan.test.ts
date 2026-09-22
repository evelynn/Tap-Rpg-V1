import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { findCoreContentIds, findNondeterminism } from '../src/scripts/core-id-scan'

describe('findCoreContentIds', () => {
  it('문자열 리터럴 안의 콘텐츠 ID를 찾는다', () => {
    const src = [
      "if (loc === 'H1') patrol()",
      'const boss = "EB03"',
      'const step = `C01-3`',
    ].join('\n')
    assert.deepEqual(
      findCoreContentIds('x.ts', src).map((h) => h.id),
      ['H1', 'EB03', 'C01-3'],
    )
  })

  it('주석, 식별자, 허용 표시 줄은 무시한다', () => {
    const src = [
      '// H1 은 순찰 구역이다',
      'const H1 = region.patrol_zone',
      "const x = 'H1' // id-lint-allow",
      "const tag = 'hunt'",
    ].join('\n')
    assert.deepEqual(findCoreContentIds('x.ts', src), [])
  })

  it('밑줄 뒤 ID, E·X·AC·BK 접두, 문자열 안 // 뒤 ID도 찾는다', () => {
    const src = [
      "const m = 'mat_EN04'",
      "const e = ['E01', 'X02', 'AC03', 'BK04']",
      "const u = 'http://x' + 'EN04' // 주석 속 'L01'은 무시",
      "const rule = 'V13'",
    ].join('\n')
    assert.deepEqual(findCoreContentIds('x.ts', src).map((h) => `${h.line}:${h.id}`), ['1:EN04', '2:E01', '2:X02', '2:AC03', '2:BK04', '3:EN04'])
  })
})

describe('findNondeterminism', () => {
  it('코드 속 Math.random·new Date·Date.now·performance를 찾고, 문자열·주석은 무시한다', () => {
    const src = [
      'const r = Math.random()',
      'const t = new Date()',
      'const n = Date.now()',
      'const p = performance.now()',
      "const s = 'Math.random' // Date.now()는 쓰지 않는다",
      'const d = updateDate(x)',
    ].join('\n')
    assert.deepEqual(findNondeterminism('x.ts', src).map((h) => `${h.line}:${h.id}`), ['1:Math.random', '2:new Date', '3:Date.now', '4:performance.'])
  })
})
