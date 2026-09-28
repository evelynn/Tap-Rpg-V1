// 글자 칸(x 496~767, 03 §2.2, D75): 88% 판 위에 DOM 글자로 쓴다. 픽셀 그림 캔버스에 그리지 않고 그림 배율로 키우지도
// 않으므로 글자는 장치 픽셀에서 선명하다. 작은 글자 2줄: 1줄 이름·상태(굵게) + 오른쪽 아이콘(12 × 12 4칸)·표식, 2줄 한 줄 기록.
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

export class Panel {
  private readonly status: HTMLElement
  private readonly icons: HTMLElement
  private readonly record: HTMLElement
  private readonly measure: CanvasRenderingContext2D
  private last = { status: '', icons: '', line: '\u0000', dark: false }

  // u: 화면 배율(D81, CSS 변수 --u와 같은 값). 글자 폭을 잴 때 곱한다(글자는 늘 장치 픽셀로 그린다)
  constructor(private readonly root: HTMLElement, private u: number) {
    root.innerHTML = '<div class="plate"></div><div class="status"></div><div class="icons"></div><div class="record" aria-live="off"></div>'
    this.status = root.querySelector('.status')!
    this.icons = root.querySelector('.icons')!
    this.record = root.querySelector('.record')!
    this.measure = document.createElement('canvas').getContext('2d')!
    this.measure.font = `${TEXT.font * u}px ${FONT_FAMILY}`
  }

  setScale(u: number): void {
    this.u = u
    this.measure.font = `${TEXT.font * u}px ${FONT_FAMILY}`
  }

  update(v: FrameView): void {
    const ink = v.dark ? '#F4EFE6' : '#2B2233'
    if (v.dark !== this.last.dark) this.root.classList.toggle('dark', v.dark)
    if (v.status !== this.last.status) this.status.textContent = v.status
    const iconKey = JSON.stringify([v.icons, v.mark, v.attitude, v.dark])
    if (iconKey !== this.last.icons) this.icons.innerHTML = this.iconRow(v, ink)
    if (v.line !== this.last.line) {
      // 기록은 한 줄로만 보인다(접거나 자르지 않는다). 폭 262를 넘는 기록은 시험이 잡아야 하므로 여기서는 알리기만 한다
      this.record.textContent = v.line
      this.record.title = v.line
      const w = this.measure.measureText(v.line).width / this.u
      if (w > TEXT.w) console.warn(`[텝] 한 줄 기록이 글자 칸 폭 ${TEXT.w}을 넘는다(${w.toFixed(1)}px): ${v.line}`)
    }
    this.last = { status: v.status, icons: iconKey, line: v.line, dark: v.dark }
  }

  private iconRow(v: FrameView, ink: string): string {
    const s = TEXT.icons.size
    const cells = v.icons.map((i) => `<svg xmlns="${SVG}" viewBox="0 0 ${s} ${s}" class="ico"${i.label ? ` aria-label="${i.label}"><title>${i.label}</title>` : ' aria-hidden="true">'}${iconSvg(i, ink)}</svg>`)
    // 표식이 없어도 자리를 비워 둬 아이콘이 움직이지 않는다(03 §2.2)
    const mark = v.mark
      ? `<span class="mark ${v.mark}" title="${v.mark === 'choice' ? '중요한 선택 1건이 기다리고 있습니다' : '계승을 기다리고 있습니다'}">${v.mark === 'choice' ? '1' : '✿'}</span>`
      : '<span class="mark none" aria-hidden="true"></span>'
    return `${cells.join('')}${mark}<span class="attitude" title="현재 태도: ${v.attitude}">${v.attitude.slice(0, 1)}</span>`
  }
}
