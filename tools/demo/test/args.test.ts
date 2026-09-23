import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULTS, parseArgs, renderIntro } from '../src/args'

describe('데모 인자', () => {
  it('아무것도 주지 않으면 기본값이다', () => {
    assert.deepEqual(parseArgs([]), DEFAULTS)
  })

  it('값 옵션과 플래그를 읽는다', () => {
    const a = parseArgs(['--speed', '120', '--seed', 'abc', '--attitude', 'stable', '--name', '리아', '--family', '돌', '--minutes', '30', '--gen', '3', '--fast', '--plain', '--auto', '--save'])
    assert.equal(a.speed, 120)
    assert.equal(a.seed, 'abc')
    assert.equal(a.attitude, 'stable')
    assert.equal(a.name, '리아')
    assert.equal(a.family, '돌')
    assert.equal(a.minutes, 30)
    assert.equal(a.gen, 3)
    assert.ok(a.fast && a.plain && a.auto && a.save)
  })

  it('--키=값 모양도 받는다', () => {
    assert.equal(parseArgs(['--speed=10']).speed, 10)
    assert.equal(parseArgs(['--name=모라']).name, '모라')
  })

  it('모르는 옵션·잘못된 수·빠진 값은 오류다', () => {
    assert.throws(() => parseArgs(['--nope']), /모르는 옵션/)
    assert.throws(() => parseArgs(['pnpm']), /모르는 인자/)
    assert.throws(() => parseArgs(['--speed', '0']), /0보다 큰 수/)
    assert.throws(() => parseArgs(['--gen', '1.5']), /정수/)
    assert.throws(() => parseArgs(['--seed']), /값이 없다/)
  })

  it('첫 줄 안내에 설정과 조작법이 들어간다', () => {
    const text = renderIntro(parseArgs(['--gen', '2', '--fast']))
    assert.match(text, /조약돌 가문/)
    assert.match(text, /생애 2회/)
    assert.match(text, /Ctrl\+C/)
  })
})
