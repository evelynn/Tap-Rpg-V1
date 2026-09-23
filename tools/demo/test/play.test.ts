import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { parseArgs } from '../src/args'
import { createLineSource, EOF_NOTICE, makeAsk } from '../src/input'
import { budgetMinutes, pickMajorLines, play, type PlayDeps } from '../src/play'
import { createDemoWorld, loadContent, seedHex } from '../src/world'

// 팩 검증이 무거워 한 번만 읽어 여러 세계에 쓴다
const content = loadContent()

type Entry = Parameters<typeof pickMajorLines>[0][number]
const e = (line: string, over: Partial<Entry> = {}): Entry => ({ char_uid: 'c1', importance: 'major', tag: 'discovery', line, ...over })

describe('데모 재생', () => {
  it('씨앗은 16진 16자리로 바뀐다', () => {
    assert.equal(seedHex('9e3779b97f4a7c15'), '9e3779b97f4a7c15')
    assert.match(seedHex('tap'), /^[0-9a-f]{16}$/)
    assert.equal(seedHex('tap'), seedHex('tap'))
  })

  it('--fast --minutes 30 을 예외 없이 끝까지 돌린다', async () => {
    const args = parseArgs(['--fast', '--minutes', '30', '--auto', '--plain'])
    const world = createDemoWorld(content, args)
    const lines: string[] = []
    let statuses = 0
    const deps: PlayDeps = {
      write: (t) => void lines.push(t),
      status: () => void (statuses += 1),
      sleep: async () => {},
    }
    const result = await play(world, args, deps)
    assert.ok(result.minutes > 0, '유효 진행이 흘렀다')
    assert.ok(result.minutes <= 30 + 1, '예산을 크게 넘지 않는다')
    assert.ok(lines.length > 0, '기록이 나왔다')
    assert.ok(statuses > 0, '상태 줄을 갱신했다')
    assert.equal(result.lines.length, lines.length)
  })

  it('--minutes 가 없으면 예산은 생애 수 × 기본 수명의 2배다', () => {
    const world = createDemoWorld(content, parseArgs([]))
    const t = world.content.balance.time
    const life = (t.base_retire_age - t.start_age) * t.min_per_year
    assert.equal(budgetMinutes(world, parseArgs([])), life * 2)
    assert.equal(budgetMinutes(world, parseArgs(['--gen', '3'])), life * 2 * 3)
    assert.equal(budgetMinutes(world, parseArgs(['--minutes', '45'])), 45)
  })

  it('주요 기록은 그 인물의 major 기록만, 같은 문장은 한 번, 끝맺음(은퇴·가문 업적)은 뺀다', () => {
    const lines = pickMajorLines([
      e('길을 나섰다'),
      e('길을 나섰다'),
      e('남의 기록', { char_uid: 'c2' }),
      e('일상', { importance: 'daily' }),
      e('마지막 장', { importance: 'last_chapter' }),
      e('관문을 넘었다', { tag: 'dungeon' }),
      e('은빛 패를 이루었다', { tag: 'house', importance: 'family' }),
      e('은빛 패를 이루었다 2', { tag: 'house' }),
      e('은퇴했다', { tag: 'retire' }),
    ], 'c1')
    assert.deepEqual(lines, ['길을 나섰다', '관문을 넘었다'])
  })

  it('주요 기록이 많으면 생애 앞뒤에 고르게 흩어 고른다(시간 순서 유지)', () => {
    const many = Array.from({ length: 9 }, (_, i) => e(`기록 ${i}`))
    assert.deepEqual(pickMajorLines(many, 'c1', 5), ['기록 0', '기록 2', '기록 4', '기록 6', '기록 8'])
  })

  it('파이프 입력(줄 수 < 선택 수)으로 기본 실행하면 입력이 끝난 뒤 자동으로 넘어가 한 생애를 끝까지 본다', async () => {
    // 시드는 "한 생애에 선택이 2번 이상 온다"를 재현하는 값이다. 난수 순서가 바뀌면 다시 고른다
    const args = parseArgs(['--fast', '--plain', '--seed', '1'])
    const world = createDemoWorld(content, args)
    let raw = ''
    const lines: string[] = []
    const deps: PlayDeps = {
      write: (t) => void lines.push(t),
      status: () => {},
      sleep: async () => {},
      ask: makeAsk({ source: createLineSource(Readable.from(['1\n'])), write: (t) => void (raw += t), echo: true }),
    }
    const result = await play(world, args, deps)
    assert.equal(result.lives, 1, '생애 끝(은퇴·사망)까지 갔다')
    assert.match(raw, /\): 1\n/, '첫 선택은 입력대로, 답 뒤에 줄바꿈')
    assert.ok(raw.includes(EOF_NOTICE), '입력이 끝나 자동으로 넘겼다')
    const summary = lines.find((l) => l.includes('의 생애 ──'))!
    const major = summary.split('\n').filter((l) => l.startsWith('  · '))
    assert.ok(major.length > 0, '주요 기록이 있다')
    assert.equal(new Set(major).size, major.length, '주요 기록에 같은 줄이 없다')
    assert.ok(!major.some((l) => /이루었다$/.test(l)), '바로 위에 찍힌 가문 업적을 되풀이하지 않는다')
  })
})
