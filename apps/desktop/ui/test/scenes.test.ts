import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SCENES, SceneTracker, sceneFor, sceneFrame } from '../src/scenes'

const HAVE = new Set(['ES15', 'ES18'])

describe('이벤트 장면(15 §9.3)', () => {
  it('사건 id로 장면을 고르되 그림이 있는 장면만 쓴다', () => {
    assert.equal(sceneFor('S07', HAVE)?.scene, 'ES18')
    assert.deepEqual(sceneFor('S07', HAVE)?.hero, { x: 30, motion: 'interact' })
    assert.equal(sceneFor('S04', HAVE)?.hero, null) // ES15는 주인공을 얹지 않는다
    assert.equal(sceneFor('L09', HAVE), null) // ES01 그림은 아직 ready에 없다
    assert.equal(sceneFor('L01', HAVE), null)
    assert.equal(sceneFor(undefined, HAVE), null)
    assert.equal(SCENES.L09?.hero?.x, 24)
  })

  it('반복 장면은 250ms × 4 주기, 끝 유지 장면은 4프레임째에서 멈춘다', () => {
    const loop = SCENES.S07!
    assert.deepEqual([0, 250, 500, 750, 1000].map((t) => sceneFrame(loop, t)), [0, 1, 2, 3, 0])
    const hold = SCENES.S04!
    assert.deepEqual([0, 750, 1000, 5000].map((t) => sceneFrame(hold, t)), [0, 3, 3, 3])
  })

  it('기록이 처음 보일 때부터 8초, 그사이 다른 기록이 오면 그때까지', () => {
    const s = new SceneTracker(HAVE)
    s.onLine('S07', 1000)
    assert.equal(s.at(1000)?.row.scene, 'ES18')
    assert.equal(s.at(8999)?.frame, 3)
    assert.equal(s.at(9000), null)
    s.onLine('S07', 10000)
    s.onLine('S07', 12000) // 같은 사건 기록이 이어지면 처음 시각 그대로
    assert.equal(s.at(17999)?.row.scene, 'ES18')
    s.onLine(undefined, 13000)
    assert.equal(s.at(13000), null)
  })
})
