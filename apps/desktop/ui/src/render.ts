// 기본 창 풍경 그리기(03 §2.2, D75). 캔버스에는 픽셀 그림만 그리고 글자 칸은 DOM(panel.ts)이 맡는다.
// 캔버스 기억 크기는 장치 픽셀이고, 그림은 정수 배율 k로만 키운다(가장 가까운 이웃). 좌표는 모두 논리 픽셀이다.
import { SCENE_W, STRIP_W, WIN, groundOf, type Surface } from './layout'
import { PROPS, SHEETS, cellRect } from './sprites'
import type { PropDraw } from './props'
import type { Icon } from './status'
import type { BubbleItem, StripView } from './overlay'

export interface SpriteDraw {
  sheet: string // SHEETS 키
  cell: number
  cx: number // 창 좌표의 인물 가로 중심
  flip: boolean
  flash: boolean // 흰빛 덮기(피격 1프레임, D70)
}

export interface FrameView {
  bg: { file: string; offset: number } // 풍경 전체(글자 판 뒤까지)를 채우는 띠
  scene: { file: string; frame: number; x: number } | null // 이벤트 장면(판 x ~ x + 127, 풍경 가운데 D82). 그 밖의 풍경은 어둡게
  paused: boolean
  hero: SpriteDraw | null
  enemy: SpriteDraw | null
  status: string
  stateIcon: number | null // 이름·상태 줄 앞 행동 상태 기호(03 §4.1, ui_icons_12 칸)
  icons: Icon[]
  line: string
  mark: 'choice' | 'succession' | null
  attitude: string // 태도 이름. 표식은 첫 글자(자리 표시)
  dark: boolean
  heroCx: number // 평소 주인공 자리(말풍선 꼬리, D82)
  strip: StripView // 기록 띠(03 §2.7)
  bubble: BubbleItem | null // 말풍선
  props: PropDraw[] // 판정 주사위·떨어진 꾸러미(인물 위에 그린다)
}

export type Images = Record<string, CanvasImageSource | undefined>

const SCENE_DIM = 'rgba(0, 0, 0, 0.5)' // 장면 밖 풍경 어둡게(약 50%)

export class Renderer {
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly images: Images,
    private readonly s: Surface,
    private readonly scratch: CanvasRenderingContext2D | null = null, // 흰빛 덮기용 48 × 48 이상 캔버스
    private readonly grid = false, // ?grid=1: 선명도 확인용 격자
  ) {}

  draw(v: FrameView): void {
    const c = this.ctx
    const { k, artY, logicalW } = this.s
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.imageSmoothingEnabled = false
    c.filter = v.paused ? 'saturate(50%)' : 'none' // 일시정지: 현재 장면 정지, 채도 50% 낮춤(03 §15)
    c.fillStyle = v.dark ? '#1C1822' : '#B5C7F5' // 그림 위로 남는 높이(125·150%)는 하늘색
    c.fillRect(0, 0, this.s.devW, this.s.devH)
    c.setTransform(k, 0, 0, k, 0, artY)
    this.strip(v.bg.file, v.bg.offset, 0, logicalW)
    const ground = groundOf((this.images[v.bg.file] as { height?: number } | undefined)?.height || 64)
    if (v.scene) {
      c.fillStyle = SCENE_DIM
      const x = v.scene.x
      // 장면 띠(높이 64)는 원본 도트로 옮기기 전까지 창 아래에 붙이고, 판 밖(위 포함)은 어둡게(D84)
      const sy = WIN.h - 64
      c.fillRect(0, 0, x, WIN.h)
      c.fillRect(x + SCENE_W, 0, logicalW - x - SCENE_W, WIN.h)
      c.fillRect(x, 0, SCENE_W, sy)
      this.image(v.scene.file, v.scene.frame * SCENE_W, 0, SCENE_W, 64, x, sy)
    }
    const feet = v.scene ? groundOf(64) : ground
    if (v.enemy) this.sprite(v.enemy, feet)
    if (v.hero) this.sprite(v.hero, feet)
    for (const p of v.props) {
      const s = PROPS[p.prop]
      this.image(s.file, (p.cell % s.cols) * s.w, Math.floor(p.cell / s.cols) * s.h, s.w, s.h, Math.round(p.cx - s.w / 2), feet + p.dy)
    }
    c.filter = 'none'
    if (this.grid) this.drawGrid()
  }

  // 가로 이음 띠를 offset만큼 밀어 [x0, x1) 구간에 채운다. 띠 폭·높이는 그림 그대로(원본 도트, D83).
  // 띠는 창 아래에 붙이고(D84), 띠보다 위는 띠 맨 윗줄에서 가장 흔한 색(하늘·천장) 한 가지로 채운다.
  // 맨 윗줄을 그대로 위로 늘이면 윗변에 걸린 나무·기둥이 세로 줄이 된다
  private strip(file: string, offset: number, x0: number, x1: number): void {
    const img = this.images[file] as { width?: number; height?: number } | undefined
    const w = img?.width || STRIP_W
    const h = img?.height || 64
    const top = WIN.h - h
    if (top > 0) {
      this.ctx.fillStyle = this.skyOf(file)
      this.ctx.fillRect(x0, 0, x1 - x0, top)
    }
    const o = ((Math.floor(offset) % w) + w) % w
    for (let x = x0 - ((x0 + o) % w); x < x1; x += w) this.image(file, 0, 0, w, h, x, top)
  }

  private readonly skies = new Map<string, string>()
  private skyOf(file: string): string {
    const hit = this.skies.get(file)
    if (hit) return hit
    let color = '#B5C7F5'
    const src = this.images[file] as (CanvasImageSource & { width?: number }) | undefined
    const k = this.scratch
    if (src && k && src.width) {
      const w = Math.min(src.width, k.canvas.width)
      k.clearRect(0, 0, w, 1)
      k.drawImage(src, 0, 0, w, 1, 0, 0, w, 1)
      const d = k.getImageData(0, 0, w, 1).data
      const count = new Map<number, number>()
      for (let i = 0; i < w * 4; i += 4) {
        const c = (d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!
        count.set(c, (count.get(c) ?? 0) + 1)
      }
      let best = 0
      let n = -1
      for (const [c, m] of count) if (m > n) [best, n] = [c, m]
      color = `#${best.toString(16).padStart(6, '0')}`
    }
    this.skies.set(file, color)
    return color
  }

  private image(file: string, sx: number, sy: number, w: number, h: number, dx: number, dy: number): void {
    const img = this.images[file]
    if (img) this.ctx.drawImage(img, sx, sy, w, h, dx, dy, w, h)
  }

  // 발바닥이 지면선(지금 배경의 지면, D84), 가로 중심이 cx에 오게 놓는다
  private sprite(s: SpriteDraw, ground: number): void {
    const sheet = SHEETS[s.sheet]!
    const img = this.images[sheet.file]
    if (!img) return
    const r = cellRect(sheet, s.cell)
    const c = this.ctx
    const x = Math.round(s.cx - sheet.centerX)
    const y = ground - sheet.footY
    let src: CanvasImageSource = img
    let sx = r.sx
    let sy = r.sy
    if (s.flash && this.scratch) {
      const k = this.scratch
      k.clearRect(0, 0, r.w, r.h)
      k.globalCompositeOperation = 'source-over'
      k.drawImage(img, r.sx, r.sy, r.w, r.h, 0, 0, r.w, r.h)
      k.globalCompositeOperation = 'source-in'
      k.fillStyle = '#FFFFFF'
      k.fillRect(0, 0, r.w, r.h)
      src = k.canvas
      sx = 0
      sy = 0
    }
    c.save()
    if (s.flip) {
      c.translate(x + sheet.w, y)
      c.scale(-1, 1)
      c.drawImage(src, sx, sy, r.w, r.h, sheet.w - 2 * sheet.centerX, 0, r.w, r.h)
    } else {
      c.drawImage(src, sx, sy, r.w, r.h, x, y, r.w, r.h)
    }
    c.restore()
  }

  // 8 논리 픽셀마다 장치 1픽셀 선, 왼쪽 위 16 × 16에는 논리 1픽셀 바둑판을 그린다.
  // 브라우저가 캔버스를 다시 늘이거나 흐리게 하면 바둑판이 회색으로 뭉개져 바로 보인다
  private drawGrid(): void {
    const c = this.ctx
    const { k, artY, devW } = this.s
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.fillStyle = 'rgba(255, 0, 255, 0.55)'
    for (let x = 0; x < devW; x += 8 * k) c.fillRect(x, artY, 1, WIN.h * k)
    for (let y = 0; y <= WIN.h; y += 8) c.fillRect(0, artY + y * k, devW, 1)
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        c.fillStyle = (x + y) % 2 ? '#000000' : '#FFFFFF'
        c.fillRect(x * k, artY + y * k, k, k)
      }
    }
  }
}
