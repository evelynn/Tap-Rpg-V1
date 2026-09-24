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

  it('normalize·preview는 위치 인자를 대응표로 받는다', () => {
    const a = parseArgs(['normalize', 'x/map.json', '--name', 'ref'])
    assert.equal(a.command, 'normalize')
    assert.equal(a.map, 'x/map.json')
    assert.deepEqual(a.names, ['ref'])
    assert.deepEqual(a.paths, [])
    assert.match(parseArgs(['preview']).map.split('\\').join('/'), /docs\/art\/imagegen\.map\.json$/)
    assert.throws(() => parseArgs(['preview', 'a.json', 'b.json']), /하나만/)
  })

  it('derive는 위치 인자를 대응표로, --min-recompose를 수로 받는다', () => {
    const a = parseArgs(['derive', 'x/v04.map.json', '--name', 'derived_d_48', '--min-recompose=0.9'])
    assert.equal(a.command, 'derive')
    assert.equal(a.map, 'x/v04.map.json')
    assert.deepEqual(a.names, ['derived_d_48'])
    assert.equal(a.minRecompose, 0.9)
    assert.equal(parseArgs(['derive']).minRecompose, null)
  })

  it('layers는 기준·레이어와 기준값 옵션을 받는다', () => {
    const a = parseArgs(['layers', 'ref', 'hair', 'a/b.png', '--clothing', 'a/b.png', '--max-shift=2', '--min-containment', '0.9', '--max-skin', '0.05'])
    assert.deepEqual(a.paths, ['ref', 'hair', 'a/b.png'])
    assert.deepEqual(a.clothing, ['a/b.png'])
    assert.equal(a.maxShift, 2)
    assert.equal(a.minContainment, 0.9)
    assert.equal(a.maxSkin, 0.05)
    assert.throws(() => parseArgs(['layers', 'ref', '--max-shift', 'x']), /수여야/)
  })

  it('모르는 명령·옵션·빠진 값은 오류다', () => {
    assert.throws(() => parseArgs(['nope']), /모르는 명령/)
    assert.throws(() => parseArgs(['check', '-x']), /모르는 옵션/)
    assert.throws(() => parseArgs(['check', '--root']), /값이 없다/)
  })
})
