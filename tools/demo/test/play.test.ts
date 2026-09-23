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
let nextId = 0
const e = (line: string, over: Partial<Entry> = {}): Entry => {
  nextId += 1
  return { id: nextId, eff_min: nextId, age: 20, char_uid: 'c1', importance: 'major', tag: 'bond', line, ...over }
}
// 사건 분류: F로 시작하면 운명(테스트용 id)
const opts = { relicUids: ['it_1'], eventCategory: (id: string) => (id.startsWith('F') ? 'fate' : 'life'), clamp: [4, 6] as const, scoreGte: 5 }

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

  it('주요 기록은 12 §7.1 후보만: 안내·결과가 뒤에 있는 대기 기록·이동·묶음·가문·은퇴는 싣지 않는다', () => {
    const lines = pickMajorLines([
      e('여울가 풀밭으로 떠났다', { tag: 'travel' }),
      e('남길 물건을 정해 두세요', { tag: 'important' }), // 사건이 아닌 [중요] = 안내
      e('샘 앞에서 결정을 기다린다', { tag: 'important', refs: { event_id: 'F01' } }),
      e('샘물을 병에 담았다', { tag: 'check', refs: { event_id: 'F01' }, importance: 'daily' }), // 운명 사건 결과(일상 기록이어도 대기 기록을 뺀다)
      e('샘물을 병에 담아 왔다', { tag: 'check', refs: { event_id: 'F01' } }),
      e('세나가 이름을 기억해주었다'),
      e('남의 기록', { char_uid: 'c2' }),
      e('10번 싸워 동전 58개를 모았다', { tag: 'hunt', bundle_count: 10 }),
      e('은빛 패를 이루었다', { tag: 'house', importance: 'family' }),
      e('은퇴했다', { tag: 'retire', importance: 'family' }),
    ], 'c1', opts)
    assert.deepEqual(lines, ['20세 샘물을 병에 담아 왔다', '20세 세나가 이름을 기억해주었다'])
  })

  it('후보가 많으면 18 §4.1 점수가 높은 것부터 고르고(점수 5 이상이 4개 미만이면 4개), 시간 순서로 싣는다', () => {
    const many = [
      e('처음 보는 길을 찾았다', { tag: 'discovery' }), // 첫 [발견] 3+3
      e('길을 잃은 아이를 도왔다', { tag: 'important', refs: { event_id: 'L01' } }), // [중요] 첫 기록 1+3
      e('다른 제안을 받았다', { tag: 'important', refs: { event_id: 'L02' } }), // 1
      e('또 다른 제안을 받았다', { tag: 'important', refs: { event_id: 'L03' } }), // 1
      e('세나가 이름을 기억해주었다'), // [인연] 7+3
      e('종이 달린 짧은 검을 손에 넣었다', { tag: 'gear', refs: { item_uid: 'it_1' } }), // 유품 1+3+3
    ]
    assert.deepEqual(pickMajorLines(many, 'c1', opts), [
      '20세 처음 보는 길을 찾았다', '20세 길을 잃은 아이를 도왔다', '20세 세나가 이름을 기억해주었다', '20세 종이 달린 짧은 검을 손에 넣었다',
    ])
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
