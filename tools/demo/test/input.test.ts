import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { setImmediate as tick } from 'node:timers/promises'
import { AUTO_NOTICE, createLineSource, EOF_NOTICE, makeAsk } from '../src/input'

const view = { options: ['a', 'b', 'c'] }

describe('데모 입력', () => {
  it('파이프로 한꺼번에 들어온 줄을 순서대로 하나씩 내주고, 끝나면 null이다', async () => {
    const src = createLineSource(Readable.from(['1\n2', '\n3']))
    await tick() // 묻기 전에 줄이 먼저 다 들어와도 버리지 않는다
    await tick()
    assert.equal(await src.next(), '1')
    assert.equal(await src.next(), '2')
    assert.equal(await src.next(), '3') // 마지막 줄바꿈이 없어도 한 줄이다
    assert.equal(await src.next(), null)
    assert.equal(await src.next(), null)
  })

  it('기다리는 중에 입력이 끝나면 null로 풀린다(멈춰 버리지 않는다)', async () => {
    const stream = new Readable({ read() {} })
    const src = createLineSource(stream)
    const pending = src.next()
    stream.push(null)
    assert.equal(await pending, null)
  })

  it('중단 신호면 null로 풀린다', async () => {
    const src = createLineSource(new Readable({ read() {} }))
    const abort = new AbortController()
    const pending = src.next(abort.signal)
    abort.abort()
    assert.equal(await pending, null)
    src.close()
  })

  it('파이프 입력이면 물음 뒤에 받은 답과 줄바꿈을 남기고, 끝나면 안내 뒤 자동 선택으로 넘긴다', async () => {
    let out = ''
    const ask = makeAsk({ source: createLineSource(Readable.from(['2\n'])), write: (t) => void (out += t), echo: true })
    assert.equal(await ask(view), 2)
    assert.equal(out, '번호를 고르세요 (1~3, 그냥 Enter면 자동): 2\n')
    out = ''
    assert.equal(await ask(view), 0, '입력이 끝나면 자동')
    assert.equal(out, `번호를 고르세요 (1~3, 그냥 Enter면 자동): \n${EOF_NOTICE}\n`)
    out = ''
    assert.equal(await ask(view), 0, '그 뒤로는 묻지 않고 자동')
    assert.equal(out, `${AUTO_NOTICE}\n`)
  })

  it('터미널끼리면 답을 다시 쓰지 않는다(터미널이 되비친다)', async () => {
    let out = ''
    const ask = makeAsk({ source: createLineSource(Readable.from([' 3 \n'])), write: (t) => void (out += t), echo: false })
    assert.equal(await ask(view), 3)
    assert.equal(out, '번호를 고르세요 (1~3, 그냥 Enter면 자동): ')
  })

  it('중단(Ctrl+C)이면 입력 끝 안내 없이 자동 선택이다', async () => {
    let out = ''
    let stop = false
    const abort = new AbortController()
    const ask = makeAsk({
      source: createLineSource(new Readable({ read() {} })),
      write: (t) => void (out += t),
      echo: true,
      signal: abort.signal,
      stopped: () => stop,
    })
    const pending = ask(view)
    stop = true
    abort.abort()
    assert.equal(await pending, 0)
    assert.doesNotMatch(out, /입력이 끝났다/)
  })
})
