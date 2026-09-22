import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Content } from '../../src/index'
import { makeContent, rawDefs } from '../fixture'

describe('Content 조회기', () => {
  const content = makeContent()

  it('종류·ID로 찾고, 없으면 예외', () => {
    assert.equal(content.get('trait', 'TI01').name, '튼튼한 체질')
    assert.equal(content.has('trait', 'TI01'), true)
    assert.equal(content.has('item', 'TI01'), false) // 종류별 이름공간
    assert.throws(() => content.get('trait', 'NOPE'), /trait 'NOPE'가 없다/)
    assert.equal(content.balance.time.start_age, 18)
  })

  it('list는 번들 순서, 없는 종류는 빈 배열', () => {
    assert.deepEqual(content.list('guild_rank').map((g) => g.id), ['silver', 'apprentice'])
    assert.deepEqual(content.list('event'), [])
  })

  it('종류 스키마의 기본값을 채운다(번들은 원본을 담는다, I11)', () => {
    const h1 = content.get('region', 'H1')
    assert.equal(h1.patrol_zone, false)
    assert.equal(h1.weather_exempt, false)
    assert.equal(content.get('region', 'D1').weather_exempt, true)
  })

  it('스키마를 어긴 정의는 만들 때 예외', () => {
    assert.throws(() => new Content(rawDefs({ guild_rank: { x: { id: 'x', name: 'x' } } })), /guild_rank 'x' 스키마 위반/)
  })

  it('번들 형식이 다르면 거부한다', () => {
    assert.throws(() => Content.fromBundle({ format: 2, defs: rawDefs() }), /형식 2/)
    assert.equal(Content.fromBundle({ format: 1, defs: rawDefs() }).has('item', 'W01'), true)
  })
})
