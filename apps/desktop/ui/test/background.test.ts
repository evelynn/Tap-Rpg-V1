// 배경 띠 고르기(15 §8.3, 01 §1.2 배경 시간대 표, I87)
import { before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { validateContent } from '@tap/content-kit'
import { Content, createGameWorld, type World } from '@tap/core'
import { bgCandidates, bgPlace, bgTime, pickBackground } from '../src/background'
import { BACKGROUNDS } from '../src/sprites'

let content: Content
function newWorld(): World {
  const bg = content.list('background').find((b) => b.unlock === null)!
  return createGameWorld(content, {
    familyName: '모래', familySeed: '00000000000070a1', foundedUtc: 0,
    character: { name: '모라', background: bg.id, appearance: { body: 'body_base', hair: 'HR03', hair_color: 'hair_chestnut', skin_tone: 'skin_02', decor: [], age_stage_override: null } },
  })
}

before(() => {
  const { bundle } = validateContent([fileURLToPath(new URL('../../../../content/base', import.meta.url))])
  content = Content.fromBundle(JSON.parse(JSON.stringify(bundle)))
})

describe('배경 띠 고르기', () => {
  it('마을은 낮, 낮 출정은 떠나는 이동 새벽 · 현장 낮 · 귀환 해질녘, 밤 출정은 밤(01 §1.2)', () => {
    const w = newWorld()
    assert.equal(bgTime(w), 'day')
    const seen = new Set<string>()
    for (let i = 0; i < 400; i++) {
      w.advance(20)
      const s = w.state.current_activity.sortie
      if (!s) continue
      const t = bgTime(w)
      const st = w.state.current_activity.state
      if (['town_idle', 'town_prep', 'treatment'].includes(st)) assert.equal(t, 'day') // 귀환 뒤 정비 중은 마을
      else if (s.time_of_day === 'night') assert.equal(t, 'night')
      else if (st === 'travel') assert.equal(t, 'dawn')
      else if (st === 'return') assert.equal(t, 'dusk')
      seen.add(t)
    }
    assert.ok(seen.has('dawn') && seen.has('day'), [...seen].join(','))
  })

  it('지하 목적지로 가는 이동은 A2 세트, 없는 그림은 여름 낮 → 한 벌 → H1로 내려간다', () => {
    const w = newWorld()
    const ca = w.state.current_activity
    w.advance(60)
    assert.ok(ca.sortie, '출정 중')
    ca.sortie!.location_id = 'D1'
    ca.state = 'travel'
    assert.equal(bgPlace(w), 'A2')
    ca.state = 'dungeon'
    assert.equal(bgPlace(w), 'D1')
    assert.equal(pickBackground(w, new Set(BACKGROUNDS)), 'bg_d1')
    assert.equal(pickBackground(w, new Set()), 'bg_h1_summer_day')
    const c = bgCandidates(w)
    assert.deepEqual(c.slice(-2), ['bg_d1', 'bg_h1_summer_day'])
  })

  it('목록의 배경은 모두 assets/ready에 있다', async () => {
    const { existsSync } = await import('node:fs')
    for (const f of BACKGROUNDS) assert.ok(existsSync(fileURLToPath(new URL(`../../../../assets/ready/${f}.png`, import.meta.url))), f)
  })
})
