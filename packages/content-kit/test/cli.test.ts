import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stagePacks } from './stage-packs'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url))
const fx = (p: string) => fileURLToPath(new URL(`fixtures/${p}`, import.meta.url))

function run(...args: string[]) {
  const r = spawnSync(process.execPath, ['--import', 'tsx', cli, ...args], { cwd: repoRoot, encoding: 'utf8' })
  return { code: r.status, stdout: r.stdout, out: r.stdout + r.stderr }
}

// 기본 종류 스키마(KIND_SCHEMAS)로 돈다. 통과 사례는 e2e 팩(balance 포함)을 임시 폴더에 펼쳐 쓴다.
describe('cli check', () => {
  it('오류가 없으면 종료 코드 0', () => {
    const { dir, cleanup } = stagePacks()
    try {
      const r = run('check', dir)
      assert.equal(r.code, 0, r.out)
      assert.match(r.out, /오류 0건, 경고 0건/)
    } finally {
      cleanup()
    }
  })

  it('경고만이면 0, --strict면 1', () => {
    const again = [{ target: { kind: 'event', id: 'L05' }, op: 'merge', value: { weight: 2 } }]
    const { dir, cleanup } = stagePacks({
      'tune_again/pack.json': { id: 'tune_again', name: '소문 재조정', version: '0.1.0', requires: ['base'] },
      'tune_again/patches/010_l05.json': again,
    })
    try {
      const r = run('check', dir)
      assert.equal(r.code, 0, r.out)
      assert.match(r.out, /^warn {2}P09 tune_l05\/patches\/010_l05\.json#\/0\/value\/weight: /m)
      assert.equal(run('check', '--strict', dir).code, 1)
    } finally {
      cleanup()
    }
  })

  it('오류면 1, --json은 이슈 배열', () => {
    const r = run('check', fx('errors/cycle'))
    assert.equal(r.code, 1)
    assert.match(r.out, /error P04 cyc_a\/pack\.json#\/requires: requires 순환/)
    const json = JSON.parse(run('check', '--json', fx('errors/cycle')).stdout)
    assert.deepEqual(Object.keys(json[0]), ['severity', 'code', 'pack', 'file', 'pointer', 'message'])
  })

  it('팩이 하나도 없으면 오류', () => {
    const r = run('check')
    assert.equal(r.code, 1)
    assert.match(r.out, /로드할 팩이 없다/)
  })

  it('모르는 명령·옵션은 2', () => {
    assert.equal(run('bundle').code, 2)
    assert.equal(run('check', '--fast', fx('e2e/base')).code, 2)
  })
})

describe('cli schema', () => {
  it('종류별 JSON Schema 파일을 파일 모양대로 쓴다', () => {
    const out = mkdtempSync(join(tmpdir(), 'tap-schema-'))
    try {
      const r = run('schema', out)
      assert.equal(r.code, 0, r.out)
      const files = readdirSync(out).sort()
      assert.equal(files.length, 24)
      assert.ok(files.includes('region.schema.json') && files.includes('event.schema.json'))
      const read = (kind: string) => JSON.parse(readFileSync(join(out, `${kind}.schema.json`), 'utf8'))
      assert.equal(read('flag').type, 'array')
      assert.equal(read('region').anyOf[1].type, 'array')
      assert.equal(read('event').type === 'array', false)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })
})
