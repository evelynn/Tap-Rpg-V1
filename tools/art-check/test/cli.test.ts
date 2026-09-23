import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseArgs } from '../src/cli'

describe('명령줄 인자', () => {
  it('명령이 없으면 도움말이다', () => {
    assert.equal(parseArgs([]).command, 'help')
    assert.equal(parseArgs(['--help']).command, 'help')
  })

  it('check의 기본값을 채운다', () => {
    const a = parseArgs(['check'])
    assert.equal(a.command, 'check')
    assert.match(a.manifest.split('\\').join('/'), /docs\/art\/assets\.manifest\.json$/)
    assert.equal(a.root, null)
    assert.equal(a.json, false)
    assert.equal(a.requireAll, false)
    assert.deepEqual(a.ids, [])
  })

  it('값 옵션은 띄어쓰기와 =를 모두 받는다', () => {
    const a = parseArgs(['check', '--priority', 'P0', '--id', 'x', '--id=y', '--root=/tmp/a', '--json', '--require-all', '--allow-empty'])
    assert.equal(a.priority, 'P0')
    assert.deepEqual(a.ids, ['x', 'y'])
    assert.equal(a.root, '/tmp/a')
    assert.ok(a.json && a.requireAll && a.allowEmpty)
  })

  it('inspect는 경로를 모은다', () => {
    const a = parseArgs(['inspect', 'output/a', 'output/b.png'])
    assert.equal(a.command, 'inspect')
    assert.deepEqual(a.paths, ['output/a', 'output/b.png'])
  })

  it('모르는 명령·옵션·빠진 값은 오류다', () => {
    assert.throws(() => parseArgs(['nope']), /모르는 명령/)
    assert.throws(() => parseArgs(['check', '-x']), /모르는 옵션/)
    assert.throws(() => parseArgs(['check', '--root']), /값이 없다/)
  })
})
