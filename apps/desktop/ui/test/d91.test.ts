// D91 기본 창: 배경 띠 위는 투명(칠하지 않음)·상태 칩·투명 영역 통과 판정(03 §2.2·§10)
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CHIP, SCENE_W, TEXT, WIDTH, WIN, chipRect, stageOf, surface } from '../src/layout'
import { Renderer, type FrameView } from '../src/render'
import { throughAt } from '../src/window'

type Call = { op: string; a: number[]; t: number[] }
// 그리기 호출만 적는 가짜 2D 문맥. t = 그때의 변환(k, artY)
function fakeCtx(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = []
  let t = [1, 0]
  const rec = (op: string) => (...a: number[]): void => { calls.push({ op, a: a.filter((x) => typeof x === 'number'), t }) }
  const ctx = {
    setTransform: (k: number, _b: number, _c: number, _d: number, _e: number, f: number) => { t = [k, f] },
    clearRect: rec('clear'), fillRect: rec('fill'),
    drawImage: (_img: unknown, ...a: number[]) => rec('image')(...a),
    save() {}, restore() {}, translate() {}, scale() {},
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

const view = (scene: FrameView['scene']): FrameView => ({
  bg: { file: 'bg', offset: 0 }, scene, paused: false, hero: null, enemy: null, status: '', stateIcon: null, icons: [], line: '',
  mark: null, attitude: '신중', dark: true, heroCx: 208, strip: { lines: [] } as unknown as FrameView['strip'], bubble: null, props: [],
})

describe('배경 띠 위는 투명(D91 확정 1)', () => {
  for (const [dpr, u] of [[1, 1], [1, 2], [1.5, 1], [1, 3]] as const) {
    it(`표시 배율 ${dpr} · 화면 배율 ${u}: 캔버스를 비우고 띠(높이 72) 위에는 아무것도 칠하지 않는다`, () => {
      const s = surface(dpr, u, 768)
      const { ctx, calls } = fakeCtx()
      const images = { bg: { width: 256, height: 72 }, sc: { width: 128, height: 64 } } as unknown as Record<string, CanvasImageSource>
      const r = new Renderer(ctx, images, s)
      for (const scene of [null, { file: 'sc', frame: 0, x: 184 }]) {
        calls.length = 0
        r.draw(view(scene))
        assert.deepEqual(calls[0], { op: 'clear', a: [0, 0, s.devW, s.devH], t: [1, 0] })
        const top = WIN.h - 72
        assert.equal(r.topDev, s.artY + top * s.k)
        const fills = calls.filter((c) => c.op === 'fill')
        assert.equal(fills.length, scene ? 3 : 0, '하늘색 채우기가 없고 장면 어둡게만 있다')
        for (const c of fills) assert.ok(c.a[1]! >= top && c.a[1]! + c.a[3]! <= WIN.h, `어둡게는 띠 높이 안: ${c.a}`)
        // drawImage(sx, sy, w, h, dx, dy, w, h): 그림 윗변 dy가 띠 윗변 이상
        for (const c of calls.filter((x) => x.op === 'image')) assert.ok(c.a[5]! >= top, `그림 y ${c.a[5]}`)
      }
    })
  }
})

describe('상태 칩(D91 확정 2)', () => {
  it('가장 긴 글자(262)에도 창 안에 들고 인물 무리·장면 판을 가리지 않는다(너비 528~1536, 글자 배율 100~150%)', () => {
    for (const t of [1, 1.25, 1.5]) {
      for (const w of [WIDTH.min, 600, 768, 1000, WIDTH.max]) {
        const colW = Math.round(272 * t)
        const total = w + colW - 272 // main.ts apply()와 같은 식
        const st = stageOf(total, colW)
        const c = chipRect(total, 9999, t)
        assert.equal(c.w, Math.ceil((TEXT.w + 2 * CHIP.padX) * t))
        assert.ok(c.x >= 0 && c.x + c.w + CHIP.margin === total, `${w}·${t}: 창 안`)
        assert.ok(c.y >= 0 && c.y + c.h + CHIP.margin === WIN.h)
        assert.ok(c.x >= st.sceneX + SCENE_W, `${w}·${t}: 칩 왼쪽 ${c.x} ≥ 장면 판 오른쪽 ${st.sceneX + SCENE_W}`)
        assert.ok(c.x >= st.enemyCx + 24, `${w}·${t}: 적 셀`)
      }
    }
  })
  it('글자 폭만큼만 차지한다. 2줄 y 95·108, 1줄 글자 175 + 3 + 아이콘·표식 70 ≤ 262', () => {
    assert.deepEqual(chipRect(768, 100), { x: 768 - 4 - 110, y: 128 - 4 - 32, w: 110, h: 32 })
    assert.equal(chipRect(768, 100, 1, 1).h, 19)
    assert.deepEqual([TEXT.row1.y, TEXT.row2.y], [chipRect(768, 0).y + CHIP.padY, chipRect(768, 0).y + CHIP.padY + TEXT.lineH])
    const { size, gap, markGap, w } = TEXT.icons
    assert.equal(4 * size + 3 * gap + markGap + size, w, '아이콘 4칸 + 표식 하나')
    assert.ok(TEXT.statusW + 3 + w <= TEXT.w)
  })
})

describe('투명 영역 통과 판정(D91, 03 §10)', () => {
  const el = (id: string, tagName = 'DIV') => ({ id, tagName })
  it('판 밖·#app·#stack·#win 맨바닥은 통과', () => {
    for (const h of [null, el('', 'HTML'), el('', 'BODY'), el('app'), el('stack'), el('win')]) assert.equal(throughAt(h, 100, 56), true)
  })
  it('풍경 캔버스는 배경 띠 윗변보다 위만 통과, 띠 안은 잡는다', () => {
    assert.equal(throughAt(el('art', 'CANVAS'), 55, 56), true)
    assert.equal(throughAt(el('art', 'CANVAS'), 56, 56), false)
    assert.equal(throughAt(el('art', 'CANVAS'), 10, 0), false, '띠 높이 128이면 전부 잡는다')
  })
  it('칩·기록 띠·말풍선·메뉴 같은 판은 어디서나 잡는다', () => {
    for (const id of ['col', 'strip', 'bubble', 'menu', '']) assert.equal(throughAt(el(id), 10, 56), false)
  })
})
