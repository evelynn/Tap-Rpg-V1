import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { findCoreContentIds } from '../src/scripts/core-id-scan'

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
})
