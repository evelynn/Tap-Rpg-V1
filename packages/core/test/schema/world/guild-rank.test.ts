import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { guildRankSchema } from '../../../src/schema/world/index'
import { expectFail, expectOk, registerTestVocabulary } from './helpers'

registerTestVocabulary()

// CONTENT_SCHEMA §5.4 은패·별패
const silver = {
  id: 'silver', name: '은패', order: 2,
  condition: { all: [{ level_gte: 12 }, { defeated: 'EB01' }] },
  grants_text: 'D2 입장, 길드 특별 상점 1단계',
}
const star = {
  id: 'star', name: '별패', order: 4,
  condition: { all: [{ level_gte: 24 }, { safe_returns_gte: { count: 3, where: { dungeon_group: 'bell_mine', dungeon_depth_gte: 3 } } }] },
  grants_text: 'T5 상점 품목, 연대기 칭호',
  line: '별패를 받았다.',
}

describe('guild_rank', () => {
  it('은패·별패가 통과한다', () => {
    expectOk(guildRankSchema, silver)
    expectOk(guildRankSchema, star)
  })

  it('order 누락, 음수 order', () => {
    const { order: _order, ...noOrder } = silver
    assert.deepEqual(expectFail(guildRankSchema, noOrder), ['order'])
    expectFail(guildRankSchema, { ...silver, order: -1 })
  })

  it('알 수 없는 조건 단말(V3), 빈 장소 거르개', () => {
    const paths = expectFail(guildRankSchema, { ...silver, condition: { lvl_gte: 12 } })
    assert.deepEqual(paths, ['condition.lvl_gte'])
    expectFail(guildRankSchema, { ...star, condition: { safe_returns_gte: { count: 3, where: {} } } })
  })
})
