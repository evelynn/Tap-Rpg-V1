import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULTS, parseArgs, renderIntro, USAGE } from '../src/args'

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

  it('--minutes 를 주지 않으면 생애가 끝날 때까지 본다(null)', () => {
    assert.equal(parseArgs([]).minutes, null)
    assert.equal(parseArgs(['--minutes', '900']).minutes, 900)
    assert.match(renderIntro(parseArgs([])), /생애가 끝날 때까지/)
    assert.match(renderIntro(parseArgs(['--minutes', '30'])), /최대 30유효분/)
  })

  it('--content 는 다음 옵션 앞까지 경로를 여러 개 받는다', () => {
    assert.deepEqual(parseArgs([]).content, ['content/base'])
    const a = parseArgs(['--content', 'content/base', 'content/examples/mist-forest', '--fast'])
    assert.deepEqual(a.content, ['content/base', 'content/examples/mist-forest'])
    assert.ok(a.fast)
    assert.deepEqual(parseArgs(['--content=content/base']).content, ['content/base'])
    assert.throws(() => parseArgs(['--content']), /경로가 없다/)
    assert.throws(() => parseArgs(['--content', '--fast']), /경로가 없다/)
    assert.deepEqual(DEFAULTS.content, ['content/base'], '기본값 배열을 건드리지 않는다')
    assert.match(renderIntro(a), /콘텐츠: content\/base \+ content\/examples\/mist-forest/)
  })

  it('도움말이 기본 실행 길이와 확장 팩 보는 법을 알려 준다', () => {
    assert.doesNotMatch(USAGE, /600 = 한 생애/)
    assert.match(USAGE, /--content <경로\.\.\.>/)
    assert.match(USAGE, /--content content\/base content\/examples\/mist-forest/)
  })

  it('첫 줄 안내에 설정과 조작법이 들어간다', () => {
    const text = renderIntro(parseArgs(['--gen', '2', '--fast']))
    assert.match(text, /조약돌 가문/)
    assert.match(text, /생애 2회/)
    assert.match(text, /Ctrl\+C/)
  })
})
