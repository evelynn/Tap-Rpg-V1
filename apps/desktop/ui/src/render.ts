// 기본 창 520 × 64 그리기(03 §2.2). 그릴 것은 FrameView(순수 데이터)로 받고, 캔버스 호출만 한다.
// 좌표는 모두 논리 픽셀이고 정수 배율은 setTransform으로 건다(픽셀 그림은 가장 가까운 이웃, 글자는 배율 해상도로 선명하게).
import { SHEETS, cellRect } from './sprites'
import type { Icon } from './status'

export const WIN = { w: 520, h: 64 }
export const AREA = {
  land: { x: 0, w: 128 },
  band: { x: 128, w: 8 },
  status: { x: 136, y: 6, w: 236, h: 20 },
  icons: { x: 376, y: 8, size: 16, gap: 4 },
  mark: { x: 460, y: 4, w: 28, h: 24 },
  attitude: { x: 492, y: 6, w: 20, h: 20 },
  line: { x: 136, y: 36, w: 352, h: 22 },
  menu: { x: 492, y: 36, w: 20, h: 20 },
  panel: { x: 136, w: 376 },
}
export const GROUND_Y = 56
export const STRIP_W = 256
const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'

export interface SpriteDraw {
  sheet: string // SHEETS 키
  cell: number
  cx: number // 풍경 좌표의 인물 가로 중심
  flip: boolean
  flash: boolean // 흰빛 덮기(피격 1프레임, D70)
}

export interface FrameView {
  land: { kind: 'strip'; file: string; offset: number } | { kind: 'scene'; file: string; frame: number }
  bg: { file: string; offset: number } // 글자 판 뒤(x 128 오른쪽)는 띠를 이어 그린다
  paused: boolean
  hero: SpriteDraw | null
  enemy: SpriteDraw | null
  status: string
  icons: Icon[]
  line: string
  mark: 'choice' | 'succession' | null
  attitude: string // 태도 버튼 글자(자리 표시)
  dark: boolean
}

export type Images = Record<string, CanvasImageSource | undefined>

export class Renderer {
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly images: Images,
    private readonly scale: number,
    private readonly scratch: CanvasRenderingContext2D | null = null, // 흰빛 덮기용 48 × 48 이상 캔버스
  ) {}

  draw(v: FrameView): void {
    const c = this.ctx
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0)
    c.imageSmoothingEnabled = false
    c.fillStyle = v.dark ? '#1C1822' : '#B5C7F5'
    c.fillRect(0, 0, WIN.w, WIN.h)
    // 일시정지: 현재 장면 정지, 채도 50% 낮춤(03 §15)
    c.filter = v.paused ? 'saturate(50%)' : 'none'
    this.strip(v.bg.file, v.bg.offset, AREA.land.w, WIN.w)
    c.save()
    c.beginPath()
    c.rect(AREA.land.x, 0, AREA.land.w, WIN.h)
    c.clip()
    if (v.land.kind === 'strip') this.strip(v.land.file, v.land.offset, 0, AREA.land.w)
    else this.image(v.land.file, v.land.frame * AREA.land.w, 0, AREA.land.w, WIN.h, 0, 0)
    if (v.enemy) this.sprite(v.enemy)
    if (v.hero) this.sprite(v.hero)
    c.restore()
    c.filter = 'none'
    this.panel(v)
  }

  // 가로 이음 띠를 offset만큼 밀어 [x0, x1) 구간에 채운다
  private strip(file: string, offset: number, x0: number, x1: number): void {
    const o = ((Math.floor(offset) % STRIP_W) + STRIP_W) % STRIP_W
    for (let x = x0 - ((x0 + o) % STRIP_W); x < x1; x += STRIP_W) this.image(file, 0, 0, STRIP_W, WIN.h, x, 0)
  }

  private image(file: string, sx: number, sy: number, w: number, h: number, dx: number, dy: number): void {
    const img = this.images[file]
    if (img) this.ctx.drawImage(img, sx, sy, w, h, dx, dy, w, h)
  }

  // 발바닥이 지면선 y 56, 가로 중심이 cx에 오게 놓는다
  private sprite(s: SpriteDraw): void {
    const sheet = SHEETS[s.sheet]!
    const img = this.images[sheet.file]
    if (!img) return
    const r = cellRect(sheet, s.cell)
    const c = this.ctx
    const x = Math.round(s.cx - sheet.centerX)
    const y = GROUND_Y - sheet.footY
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

  private panel(v: FrameView): void {
    const c = this.ctx
    const paper = v.dark ? '#2A2530' : '#F4EFE6'
    const ink = v.dark ? '#F4EFE6' : '#2B2233'
    // 구분 띠: 풍경 → 글자 판 그라데이션, 글자 판: 불투명도 88%
    c.globalAlpha = 0.88
    const g = c.createLinearGradient(AREA.band.x, 0, AREA.band.x + AREA.band.w, 0)
    g.addColorStop(0, v.dark ? 'rgba(42,37,48,0)' : 'rgba(244,239,230,0)')
    g.addColorStop(1, paper)
    c.fillStyle = g
    c.fillRect(AREA.band.x, 0, AREA.band.w, WIN.h)
    c.fillStyle = paper
    c.fillRect(AREA.panel.x, 0, AREA.panel.w, WIN.h)
    c.globalAlpha = 1

    c.fillStyle = ink
    c.textBaseline = 'middle'
    c.font = `bold 13px ${FONT}`
    c.fillText(v.status, AREA.status.x, AREA.status.y + AREA.status.h / 2)
    c.font = `12px ${FONT}`
    c.fillText(v.line, AREA.line.x, AREA.line.y + AREA.line.h / 2)

    v.icons.forEach((icon, i) => this.icon(icon, AREA.icons.x + i * (AREA.icons.size + AREA.icons.gap), AREA.icons.y, ink))

    if (v.mark) {
      const m = AREA.mark
      c.fillStyle = v.mark === 'choice' ? '#7B5CC4' : '#A8894A'
      c.fillRect(m.x + 4, m.y + 2, m.w - 8, m.h - 4)
      c.fillStyle = '#FFFFFF'
      c.font = `bold 10px ${FONT}`
      c.textAlign = 'center'
      c.fillText(v.mark === 'choice' ? '1' : '✿', m.x + m.w / 2, m.y + m.h / 2)
      c.textAlign = 'left'
    }
    this.button(AREA.attitude, v.attitude, ink)
    this.button(AREA.menu, '⋯', ink)
  }

  private button(r: { x: number; y: number; w: number; h: number }, text: string, ink: string): void {
    const c = this.ctx
    c.strokeStyle = ink
    c.lineWidth = 1
    c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1)
    c.fillStyle = ink
    c.font = `12px ${FONT}`
    c.textAlign = 'center'
    c.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 1)
    c.textAlign = 'left'
  }

  // 아이콘 그림이 없어 칸마다 다른 자리 도형으로 그린다(모양·색 구분만)
  private icon(icon: Icon, x: number, y: number, ink: string): void {
    const c = this.ctx
    if (!icon.color) return
    c.fillStyle = icon.color
    c.strokeStyle = icon.color
    c.lineWidth = 2
    switch (icon.slot) {
      case 'hp': { // 채운 높이로 단계를 보인다(가득·3/4·절반·빈)
        const fill = [14, 10, 7, 0][icon.level] ?? 0
        c.strokeRect(x + 2, y + 2, 12, 12)
        c.fillRect(x + 2, y + 14 - fill, 12, fill)
        break
      }
      case 'fatigue': // 원, 지침·탈진은 z
        c.beginPath()
        c.arc(x + 8, y + 8, 5, 0, Math.PI * 2)
        c.fill()
        if (icon.level >= 2) {
          c.fillStyle = ink
          c.font = `bold 10px ${FONT}`
          c.fillText('z', x + 11, y + 4)
        }
        break
      case 'injury': // 십자
        c.fillRect(x + 6, y + 2, 4, 12)
        c.fillRect(x + 2, y + 6, 12, 4)
        break
      case 'special':
        if (icon.label === '일시정지') {
          c.fillRect(x + 4, y + 3, 3, 10)
          c.fillRect(x + 9, y + 3, 3, 10)
        } else {
          c.beginPath()
          c.arc(x + 8, y + 9, 4, 0, Math.PI * 2)
          c.fill()
        }
        break
    }
  }
}
