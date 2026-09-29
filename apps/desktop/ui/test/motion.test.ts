import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Animator } from '../src/motion'
import { HERO_CLIPS, SHEETS, cellRect, enemyClips, spriteFamily, type EnemyMotion, type Motion } from '../src/sprites'

describe('스프라이트 칸 찾기', () => {
  it('칸 번호를 시트 격자 사각형으로 바꾼다', () => {
    assert.deepEqual(cellRect(SHEETS.chr18!, 7), { sx: 48, sy: 48, w: 48, h: 48 }) // 공격 2프레임
    assert.deepEqual(cellRect(SHEETS.wolf!, 5), { sx: 48, sy: 32, w: 48, h: 32 }) // 이동 2프레임
    assert.deepEqual(cellRect(SHEETS.rat!, 19), { sx: 120, sy: 96, w: 40, h: 24 }) // 퇴장 4프레임(v07 칸 40 × 24, D89)
  })

  it('걷기는 12칸 중 1·2·4·7·8·10번을 110ms로 돈다', () => {
    const walk = HERO_CLIPS.walk
    assert.deepEqual(walk.cells.map((c) => cellRect(SHEETS.walk!, c)).map((r) => [r.sx / 48, r.sy / 48]), [[0, 0], [1, 0], [3, 0], [0, 1], [1, 1], [3, 1]])
    assert.ok(walk.ms.every((m) => m === 110))
  })

  it('동작마다 프레임 수와 시간 수가 같다(15 §4)', () => {
    for (const clip of Object.values(HERO_CLIPS)) assert.equal(clip.cells.length, clip.ms.length)
    assert.deepEqual(HERO_CLIPS.attack.ms, [100, 80, 60, 60, 120, 160])
    assert.equal(enemyClips('bat').exit.cells.length, 4) // v07 박쥐는 퇴장 4칸(D89)
  })

  it('시트가 없는 적 계열은 가까운 계열로 대신한다', () => {
    assert.equal(spriteFamily('wolf'), 'wolf')
    assert.equal(spriteFamily('bellwarden'), 'kobold')
    assert.equal(spriteFamily('unknown'), 'rat')
  })
})

describe('동작 재생기', () => {
  it('반복 동작은 현재 프레임이 끝나는 순간에만 바뀐다', () => {
    const a = new Animator<Motion>(HERO_CLIPS, 'idle', 'idle')
    a.update(100)
    a.request('walk')
    assert.equal(a.motion, 'idle')
    a.update(119) // 대기 1프레임 220ms 중 219ms
    assert.equal(a.motion, 'idle')
    a.update(1)
    assert.equal(a.motion, 'walk')
    assert.equal(a.frame, 0)
  })

  it('1회 동작은 끝까지 재생하고, 같은 동작을 계속 원해도 한 번만 튼 뒤 대기로 쉰다', () => {
    const a = new Animator<Motion>(HERO_CLIPS, 'attack', 'idle')
    a.request('walk')
    a.update(100 + 80 + 60)
    assert.equal(a.motion, 'attack') // 원하는 동작이 바뀌어도 끊지 않는다
    assert.equal(a.frame, 3)
    a.update(60 + 120 + 160)
    assert.equal(a.motion, 'walk')

    const b = new Animator<Motion>(HERO_CLIPS, 'attack', 'idle')
    b.update(580)
    assert.equal(b.motion, 'idle')
    b.update(2000)
    assert.equal(b.motion, 'idle') // 다시 틀지 않는다
    b.request('hit')
    b.update(220)
    assert.equal(b.motion, 'hit')
    b.request('attack')
    b.update(350 + 220)
    assert.equal(b.motion, 'attack') // 원하는 동작이 바뀌었다 돌아오면 다시 튼다
  })

  it('유지 동작(쓰러짐·퇴장)은 마지막 프레임에 멈춘다', () => {
    const a = new Animator<Motion>(HERO_CLIPS, 'collapse', 'idle')
    a.update(5000)
    assert.equal(a.motion, 'collapse')
    assert.equal(a.frame, 4)
    assert.ok(a.done)
    const e = new Animator<EnemyMotion>(enemyClips('wolf'), 'exit', 'idle')
    e.update(480)
    assert.ok(e.done)
    assert.equal(e.cell, 19)
  })
})
