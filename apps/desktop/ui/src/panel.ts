// 상태 칩(03 §2.2, D91): 풍경 오른쪽 아래 반투명 둥근 칩에 DOM 글자로 쓴다. 픽셀 그림 캔버스에 그리지 않고 그림 배율로 키우지도
// 않으므로 글자는 장치 픽셀에서 선명하다. 작은 글자 2줄: 1줄 상태 기호·이름·상태(굵게) + 아이콘(12 × 12)·표식 하나, 2줄 한 줄 기록.
import { FONT_FAMILY, TEXT } from './layout'
import type { FrameView } from './render'
import type { Icon } from './status'

const SVG = 'http://www.w3.org/2000/svg'

// 아이콘 그림이 아직 없어 칸마다 다른 자리 도형(모양·색 구분)을 12 × 12 벡터로 그린다
function iconSvg(icon: Icon, ink: string): string {
  const c = icon.color
  if (!c) return ''
  switch (icon.slot) {
    case 'hp': { // 채운 높이로 단계를 보인다(가득·3/4·절반·빈)
      const fill = [10, 7, 5, 0][icon.level] ?? 0
      return `<rect x="1" y="1" width="10" height="10" fill="none" stroke="${c}" stroke-width="1.5"/><rect x="1" y="${11 - fill}" width="10" height="${fill}" fill="${c}"/>`
    }
    case 'fatigue': // 원, 지침·탈진은 z
      return `<circle cx="6" cy="6" r="4.5" fill="${c}"/>${icon.level >= 2 ? `<text x="8" y="5" font-size="6" font-weight="bold" fill="${ink}">z</text>` : ''}`
    case 'injury': // 십자
      return `<rect x="4.5" y="1" width="3" height="10" fill="${c}"/><rect x="1" y="4.5" width="10" height="3" fill="${c}"/>`
    case 'special':
      return icon.label === '일시정지'
        ? `<rect x="3" y="2" width="2" height="8" fill="${c}"/><rect x="7" y="2" width="2" height="8" fill="${c}"/>`
        : `<circle cx="6" cy="6.5" r="3.5" fill="${c}"/>`
  }
}

// v07 12 × 12 그림(sprites/ui_icons_12.png) 한 칸. 화면 배율(정수)로만 키운다(번지지 않게, D75)
export const ICON_STYLE = (cell: number): string => `background-position: calc(${-(cell % 6) * 12}px * var(--u, 1)) calc(${-Math.floor(cell / 6) * 12}px * var(--u, 1))`
const STATE_ICON_ROOM = 160 // 상태 기호(12 + 사이 3)를 넣고도 글자가 175 안에 드는 폭

export class Panel {
  private readonly status: HTMLElement
  private readonly statusIcon: HTMLElement
  private readonly statusText: HTMLElement
  private readonly measureBold: CanvasRenderingContext2D
  private readonly icons: HTMLElement
  private readonly record: HTMLElement
  private readonly measure: CanvasRenderingContext2D
  private last: { status: string; stateIcon: number | null; icons: string; line: string; dark: boolean } = { status: '', stateIcon: -1, icons: '', line: '\u0000', dark: false }

  // u: 화면 배율(D81, CSS 변수 --u와 같은 값). 글자 폭을 잴 때 곱한다(글자는 늘 장치 픽셀로 그린다)
  constructor(private readonly root: HTMLElement, private u: number) {
    root.innerHTML = '<div class="row1"><div class="status"><span class="sico" aria-hidden="true"></span><span class="stxt"></span></div><div class="icons"></div></div><div class="record" aria-live="off"></div>'
    this.status = root.querySelector('.status')!
    this.statusIcon = root.querySelector('.sico')!
    this.statusText = root.querySelector('.stxt')!
    this.measureBold = document.createElement('canvas').getContext('2d')!
    this.measureBold.font = `bold ${TEXT.font * u}px ${FONT_FAMILY}`
    this.icons = root.querySelector('.icons')!
    this.record = root.querySelector('.record')!
    this.measure = document.createElement('canvas').getContext('2d')!
    this.measure.font = `${TEXT.font * u}px ${FONT_FAMILY}`
  }

  setScale(u: number): void {
    this.u = u
    this.measure.font = `${TEXT.font * u}px ${FONT_FAMILY}`
    this.measureBold.font = `bold ${TEXT.font * u}px ${FONT_FAMILY}`
  }

  update(v: FrameView): void {
    const ink = v.dark ? '#F4EFE6' : '#2B2233'
    if (v.dark !== this.last.dark) this.root.classList.toggle('dark', v.dark)
    if (v.status !== this.last.status || v.stateIcon !== this.last.stateIcon) {
      this.statusText.textContent = v.status
      // 03 §4.1 상태 기호는 줄 앞에. 가장 긴 이름·조건어로 글자가 160을 넘으면 기호를 빼 글자를 지킨다(I97)
      const fits = this.measureBold.measureText(v.status).width / this.u <= STATE_ICON_ROOM
      this.statusIcon.hidden = v.stateIcon === null || !fits
      if (v.stateIcon !== null) this.statusIcon.setAttribute('style', ICON_STYLE(v.stateIcon))
    }
    const iconKey = JSON.stringify([v.icons, v.mark, v.attitude, v.dark])
    if (iconKey !== this.last.icons) this.icons.innerHTML = this.iconRow(v, ink)
    if (v.line !== this.last.line) {
      // 기록은 한 줄로만 보인다(접지 않는다). 폭 262를 넘는 기록은 시험이 잡아야 하므로 여기서는 알리기만 한다
      this.record.textContent = v.line
      this.record.title = v.line
      const w = this.measure.measureText(v.line).width / this.u
      if (w > TEXT.w) console.warn(`[텝] 한 줄 기록이 상태 칩 폭 ${TEXT.w}을 넘는다(${w.toFixed(1)}px): ${v.line}`)
    }
    this.last = { status: v.status, stateIcon: v.stateIcon, icons: iconKey, line: v.line, dark: v.dark }
  }

  private iconRow(v: FrameView, ink: string): string {
    const s = TEXT.icons.size
    // 일시정지는 v07 그림(세로 막대 두 개), 나머지 칸은 그림이 아직 없어 자리 도형
    const cells = v.icons.filter((i) => i.color || i.label === '일시정지').map((i) => i.label === '일시정지'
      ? `<span class="ico bmp" role="img" aria-label="${i.label}" title="${i.label}" style="${ICON_STYLE(11)}"></span>`
      : `<svg xmlns="${SVG}" viewBox="0 0 ${s} ${s}" class="ico"${i.label ? ` aria-label="${i.label}"><title>${i.label}</title>` : ' aria-hidden="true">'}${iconSvg(i, ink)}</svg>`)
    // 표식은 칩 오른쪽 끝에 하나(D91): 대기 중이면 봉인된 두루마리·펼친 책(v07 그림, 03 §4.2), 아니면 태도 첫 글자
    const mark = v.mark
      ? `<span class="mark bmp ${v.mark}" role="img" aria-label="${v.mark === 'choice' ? '중요한 선택 1건' : '계승 대기'}" title="${v.mark === 'choice' ? '중요한 선택 1건이 기다리고 있습니다' : '계승을 기다리고 있습니다'}" style="${ICON_STYLE(v.mark === 'choice' ? 9 : 10)}"></span>`
      : `<span class="attitude" title="현재 태도: ${v.attitude}">${v.attitude.slice(0, 1)}</span>`
    return `${cells.join('')}${mark}`
  }
}
