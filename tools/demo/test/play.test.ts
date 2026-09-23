import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseArgs } from '../src/args'
import { play, type PlayDeps } from '../src/play'
import { createDemoWorld, loadContent, seedHex } from '../src/world'

describe('데모 재생', () => {
  it('씨앗은 16진 16자리로 바뀐다', () => {
    assert.equal(seedHex('9e3779b97f4a7c15'), '9e3779b97f4a7c15')
    assert.match(seedHex('tap'), /^[0-9a-f]{16}$/)
    assert.equal(seedHex('tap'), seedHex('tap'))
  })

  it('--fast --minutes 30 을 예외 없이 끝까지 돌린다', async () => {
    const args = parseArgs(['--fast', '--minutes', '30', '--auto', '--plain'])
    const world = createDemoWorld(loadContent(), args)
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
})
