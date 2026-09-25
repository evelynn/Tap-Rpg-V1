// 헤드리스 연기 시험: 기반 팩 번들로 세계를 만들어 ×600으로 돌리며 가짜 캔버스에 그린다.
// 브라우저가 하는 일(번들 → Content.fromBundle → App.step → Renderer.draw)을 DOM 없이 그대로 밟는다.
import { before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { validateContent } from '@tap/content-kit'
import { Content, createGameWorld } from '@tap/core'
import { App, PAUSE_LINE } from '../src/app'
import { HERO_CX, SCENE, TEXT, fitLines, surface } from '../src/layout'
import { Renderer, type FrameView } from '../src/render'
import { STRIPS } from '../src/sprites'
import { measure11 } from './measure'

// 호출만 기록하는 캔버스 문맥. 속성 쓰기는 받아 두고, 메서드는 이름과 인자를 남긴다
function fakeContext(calls: { name: string; args: unknown[] }[]): CanvasRenderingContext2D {
  const props: Record<string | symbol, unknown> = { canvas: {} }
  return new Proxy(props, {
    get(target, key) {
      if (key in target) return target[key]
      if (key === 'createLinearGradient') return () => ({ addColorStop() {} })
      return (...args: unknown[]) => { calls.push({ name: String(key), args }) }
    },
    set(target, key, value) {
      target[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

let content: Content
const SCENE_FILES = { ES15: STRIPS.ES15, ES18: STRIPS.ES18 }

function newApp(): App {
  const bg = content.list('background').find((b) => b.unlock === null)!
  const world = createGameWorld(content, {
    familyName: '모래',
    familySeed: '0123456789abcdef',
    foundedUtc: 0,
    character: { name: '모라', background: bg.id, appearance: { body: 'body_base', hair: 'HR03', hair_color: 'hair_chestnut', skin_tone: 'skin_02', decor: [], age_stage_override: null } },
  })
  return new App(world, SCENE_FILES)
}

before(() => {
  const { bundle } = validateContent([fileURLToPath(new URL('../../../../content/base', import.meta.url))])
  assert.ok(bundle)
  content = Content.fromBundle(JSON.parse(JSON.stringify(bundle))) // 브라우저처럼 JSON을 거친다
})

describe('기본 창 연기 시험', () => {
  it('×600으로 돌리며 매 프레임 그린다: 상태 줄·한 줄 기록·캐릭터·적·배경 흐름이 나온다', () => {
    const app = newApp()
    app.driver.speed = 600
    const calls: { name: string; args: unknown[] }[] = []
    const r = new Renderer(fakeContext(calls), { [STRIPS.bg]: {} as CanvasImageSource, chr_actions18_48: {} as CanvasImageSource }, surface(1))
    const seen = { lines: new Set<string>(), heroes: new Set<string>(), enemies: 0, scroll: false, states: new Set<string>() }
    let last: FrameView | null = null
    let prevOffset = 0
    for (let i = 0; i < 6000; i++) { // 16ms × 6000 = 실시간 96초 = 유효 16시간
      const v = app.step(i * 16, 16)
      r.draw(v)
      seen.lines.add(v.line)
      if (v.hero) seen.heroes.add(`${v.hero.sheet}:${v.hero.cell}`)
      if (v.hero && !v.scene) assert.equal(v.hero.cx, HERO_CX)
      if (v.enemy) seen.enemies++
      if (v.bg.offset !== prevOffset) seen.scroll = true
      prevOffset = v.bg.offset
      seen.states.add(app.world.state.current_activity.state)
      last = v
    }
    assert.ok(last)
    assert.match(last.status, /^\S+ \d+ · \S+/)
    assert.equal(last.icons.length, 4)
    assert.ok(seen.lines.size > 10, `한 줄 기록 ${seen.lines.size}개`)
    for (const line of seen.lines) { // 나온 기록이 모두 글자 칸 2줄 안에 든다(11px 폭 대역)
      const ls = fitLines(line, TEXT.w, measure11)
      assert.ok(ls.length <= 2 && ls.every((l) => measure11(l) <= TEXT.w), line)
    }
    assert.ok(seen.heroes.size > 5, `캐릭터 프레임 ${seen.heroes.size}종`)
    assert.ok(seen.enemies > 0, '조우 중 적이 보인다')
    assert.ok(seen.scroll, '이동 중 배경이 흐른다')
    assert.ok(seen.states.has('travel') && seen.states.has('town_idle'), [...seen.states].join(','))
    // 그리기 호출: 캔버스에는 그림만(글자는 DOM 글자 칸), 배경·스프라이트 drawImage
    assert.ok(!calls.some((c) => c.name === 'fillText'))
    assert.ok(calls.filter((c) => c.name === 'drawImage').length > 1000)
  })

  it('일시정지하면 진행이 멈추고 안내 문구가 보인다', () => {
    const app = newApp()
    app.step(0, 16)
    app.driver.setPaused(true)
    const min = app.world.state.character!.eff_min
    const v = app.step(1000, 1000)
    assert.equal(v.line, PAUSE_LINE)
    assert.ok(v.paused)
    assert.equal(app.world.state.character!.eff_min, min)
    assert.match(v.status, /· 멈춤/)
    app.driver.setPaused(false)
    app.step(2000, 1000)
    assert.ok(app.world.state.character!.eff_min > min)
  })

  it('장면이 있는 사건 기록이 보이면 풍경이 장면으로 바뀌고 주인공이 표의 자리에 선다', () => {
    const app = newApp()
    app.step(0, 16)
    app.driver.setPaused(true) // 새 기록이 끼어들지 않게 멈춘다
    app.lines.push({ id: 1e9, text: '부모의 편지가 왔다', grade: 'A', eventId: 'S07' })
    const v = app.step(100000, 16) // 앞 기록의 표시 시간이 지나 편지 기록으로 바뀐다
    assert.equal(v.line, PAUSE_LINE) // 멈춤 중에는 안내 문구가 기록 자리를 대신한다
    assert.deepEqual(v.scene, { file: STRIPS.ES18, frame: 0 })
    assert.equal(v.hero?.cx, SCENE.x + 30) // 장면 표 x 30(장면 판 기준) → 창 x 78
    assert.equal(v.enemy, null)
  })
})
