// CLI 인자 해석(17 §5.1 입력)
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_ARGS, parseArgs } from '../src/args'

describe('인자 해석', () => {
  it('인자가 없으면 17 §5.1 기본 실행이다(태도 전부·시드 1~100·CSV)', () => {
    const a = parseArgs([])
    assert.equal(a.attitude, 'all')
    assert.deepEqual(a.seeds, [1, 100])
    assert.equal(a.lives, 1)
    assert.deepEqual(a.content, ['content/base'])
    assert.equal(a.out, DEFAULT_ARGS.out)
    assert.equal(a.csv, true)
    assert.equal(a.json, false)
  })

  it('시드는 a-b와 n을 모두 받는다', () => {
    assert.deepEqual(parseArgs(['--seeds', '3-7']).seeds, [3, 7])
    assert.deepEqual(parseArgs(['--seeds', '9']).seeds, [9, 9])
  })

  it('--content는 다음 옵션 전까지 여러 경로를 받는다', () => {
    const a = parseArgs(['--content', 'content/base', 'content/extra', '--out', 'r'])
    assert.deepEqual(a.content, ['content/base', 'content/extra'])
    assert.equal(a.out, 'r')
  })

  it('형식 인자를 주면 그것만 쓴다', () => {
    const a = parseArgs(['--json'])
    assert.equal(a.json, true)
    assert.equal(a.csv, false)
    const b = parseArgs(['--json', '--csv'])
    assert.equal(b.json, true)
    assert.equal(b.csv, true)
  })

  it('규칙 해시는 인자로만 받는다(환경에서 읽지 않는다)', () => {
    assert.equal(parseArgs([]).rules, '미지정')
    assert.equal(parseArgs(['--rules', 'ab4d005']).rules, 'ab4d005')
  })

  it('잘못된 인자는 예외다', () => {
    assert.throws(() => parseArgs(['--seeds', '7-3']))
    assert.throws(() => parseArgs(['--seeds', 'x']))
    assert.throws(() => parseArgs(['--lives', '0']))
    assert.throws(() => parseArgs(['--minutes', '-1']))
    assert.throws(() => parseArgs(['--content']))
    assert.throws(() => parseArgs(['--nope']))
  })
})
