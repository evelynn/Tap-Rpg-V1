// 데스크톱 투명 창 껍데기(03 §10, D85). 운영체제 창 하나에 판(기본 창·기록 띠·열린 창)을 띄우고,
// 창 크기는 판을 감싸는 최소 크기, 기본 창 왼쪽 아래를 고정점으로 위로 자란다. 판 밖 투명한 곳은 마우스를 통과시킨다.
// 브라우저 시제품에서는 쓰지 않는다(__TAURI__가 없으면 만들지 않는다).

interface Pos { x: number; y: number }
interface Size { width: number; height: number }
interface Monitor { name: string | null; position: Pos; size: Size; scaleFactor: number; workArea?: { position: Pos; size: Size } }
interface TauriWindow {
  setSize(s: unknown): Promise<void>
  setPosition(p: unknown): Promise<void>
  outerPosition(): Promise<Pos>
  scaleFactor(): Promise<number>
  startDragging(): Promise<void>
  setAlwaysOnTop(v: boolean): Promise<void>
  setIgnoreCursorEvents(v: boolean): Promise<void>
  show(): Promise<void>
  hide(): Promise<void>
  isVisible(): Promise<boolean>
  onMoved(f: (e: { payload: Pos }) => void): Promise<unknown>
}
export interface TauriApi {
  window: {
    getCurrentWindow(): TauriWindow
    availableMonitors(): Promise<Monitor[]>
    primaryMonitor(): Promise<Monitor | null>
    cursorPosition(): Promise<Pos>
  }
  dpi: { LogicalSize: new (w: number, h: number) => unknown; LogicalPosition: new (x: number, y: number) => unknown }
  event: { listen(e: string, f: (e: { payload: unknown }) => void): Promise<unknown> }
  core: { invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> }
}

export const tauriApi = (): TauriApi | null => {
  const t = (globalThis as { __TAURI__?: TauriApi }).__TAURI__
  return t?.window ? t : null
}

export const MAGNET = 12 // 가장자리 자석(03 §10)
export const MARGIN = { right: 16, bottom: 8 } // 기본 위치 여백
export const PAD = 0 // 판 그림자 자리는 #app 안쪽 여백(index.html 6)이 맡는다. 창은 #app 크기 그대로

// 저장하는 위치(03 §10 다중 모니터): 모니터 이름 + 작업 영역 기준 상대 좌표(기본 창 왼쪽, 아래)
export interface SavedPos { monitor: string | null; rx: number; rb: number }

export interface Rect { x: number; y: number; w: number; h: number }
const area = (m: Monitor): Rect => {
  const s = m.scaleFactor || 1
  const a = m.workArea ?? { position: m.position, size: { width: m.size.width, height: m.size.height - 48 * s } }
  return { x: a.position.x / s, y: a.position.y / s, w: a.size.width / s, h: a.size.height / s }
}

// 기본 위치: 작업 영역 오른쪽 아래(오른쪽 16, 작업 표시줄 위 8)
export function defaultAnchor(wa: Rect, basicW: number): Pos {
  return { x: wa.x + wa.w - MARGIN.right - basicW, y: wa.y + wa.h - MARGIN.bottom }
}

// 자석: 기본 창 가장자리가 작업 영역 가장자리에서 12 안이면 붙인다. anchor = 기본 창 왼쪽 아래
export function magnet(anchor: Pos, basic: Size, wa: Rect): Pos {
  let { x, y } = anchor
  if (Math.abs(x - wa.x) < MAGNET) x = wa.x
  if (Math.abs(wa.x + wa.w - (x + basic.width)) < MAGNET) x = wa.x + wa.w - basic.width
  if (Math.abs(wa.y + wa.h - y) < MAGNET) y = wa.y + wa.h
  if (Math.abs(y - basic.height - wa.y) < MAGNET) y = wa.y + basic.height
  return { x, y }
}

// 작업 영역 밖으로 16 넘게 나간 기본 창은 안으로 끌어들인다(03 §10)
export function clampInto(anchor: Pos, basic: Size, wa: Rect): Pos {
  const x = Math.min(Math.max(anchor.x, wa.x - 16), wa.x + wa.w - basic.width + 16)
  const y = Math.min(Math.max(anchor.y, wa.y + basic.height - 16), wa.y + wa.h + 16)
  const out = anchor.x < wa.x - 16 || anchor.x + basic.width > wa.x + wa.w + 16 || anchor.y > wa.y + wa.h + 16 || anchor.y - basic.height < wa.y - 16
  return out ? { x: Math.min(Math.max(anchor.x, wa.x), wa.x + wa.w - basic.width), y: Math.min(Math.max(anchor.y, wa.y + basic.height), wa.y + wa.h) } : { x, y }
}

export interface ShellHooks {
  basic: () => HTMLElement // 기본 창(#win) — 고정점과 자석 기준
  root: HTMLElement // 판을 모두 담는 #app
  onTray: (id: string) => void
  loadPos: () => SavedPos | null
  savePos: (p: SavedPos) => void
  hideOnFullscreen: () => boolean
  clickThrough: () => boolean
  locked: () => boolean
}

export class DesktopShell {
  private readonly win: TauriWindow
  private anchor: Pos = { x: 0, y: 0 } // 기본 창 왼쪽 아래(논리 좌표)
  private size: Size = { width: 0, height: 0 }
  private moving = false // 우리가 setPosition 중이면 onMoved를 끌기로 보지 않는다
  private moveTimer = 0
  private ignoring: boolean | null = null
  private userHidden = false
  private fullscreenHidden = false
  visible = true

  constructor(private readonly t: TauriApi, private readonly h: ShellHooks) {
    this.win = t.window.getCurrentWindow()
  }

  async init(): Promise<void> {
    await this.fit(true)
    await this.place(await this.restoredAnchor())
    await this.win.show()
    new ResizeObserver(() => void this.fit(false)).observe(this.h.root)
    void this.win.onMoved(() => this.onMoved())
    void this.t.event.listen('tap://tray', (e) => this.h.onTray(String(e.payload)))
    void this.t.event.listen('tap://fullscreen', (e) => void this.onFullscreen(e.payload === true))
    setInterval(() => void this.passThrough(), 100)
  }

  // 판 크기에 창을 맞추고 고정점(기본 창 왼쪽 아래)을 지킨다
  private async fit(first: boolean): Promise<void> {
    const r = this.h.root.getBoundingClientRect()
    const size = { width: Math.ceil(r.width) + PAD * 2, height: Math.ceil(r.height) + PAD * 2 }
    if (size.width === this.size.width && size.height === this.size.height) return
    this.size = size
    await this.win.setSize(new this.t.dpi.LogicalSize(size.width, size.height))
    if (!first) await this.place(this.anchor)
  }

  // 기본 창의 창 안 위치(왼쪽 아래)
  private basicOffset(): Pos {
    const root = this.h.root.getBoundingClientRect()
    const b = this.h.basic().getBoundingClientRect()
    return { x: b.left - root.left + PAD, y: b.bottom - root.top + PAD }
  }

  private basicSize(): Size {
    const b = this.h.basic().getBoundingClientRect()
    return { width: b.width, height: b.height }
  }

  private async place(anchor: Pos): Promise<void> {
    this.anchor = anchor
    void this.limitPanels(anchor)
    const off = this.basicOffset()
    this.moving = true
    await this.win.setPosition(new this.t.dpi.LogicalPosition(Math.round(anchor.x - off.x), Math.round(anchor.y - off.y)))
    setTimeout(() => { this.moving = false }, 200)
  }

  // 열린 판이 화면 위로 넘치지 않게 판 최대 높이를 고정점 위 남은 공간으로(글자 배율 zoom으로 나눈다)
  private async limitPanels(anchor: Pos): Promise<void> {
    const ms = await this.monitors()
    const m = ms.find((x) => { const a = area(x); return anchor.x >= a.x - 1 && anchor.x < a.x + a.w && anchor.y > a.y && anchor.y <= a.y + a.h + 1 }) ?? ms[0]
    const wa = m ? area(m) : await this.primaryArea()
    const stack = document.getElementById('stack')!.getBoundingClientRect().height
    const t = Number(getComputedStyle(document.documentElement).getPropertyValue('--t')) || 1
    const room = anchor.y - wa.y - stack - 24
    document.documentElement.style.setProperty('--panel-max', `${Math.max(200, Math.floor(room / t))}px`)
  }

  private async monitors(): Promise<Monitor[]> {
    try { return await this.t.window.availableMonitors() } catch { return [] }
  }

  private async primaryArea(): Promise<Rect> {
    const p = (await this.t.window.primaryMonitor()) ?? (await this.monitors())[0]
    return p ? area(p) : { x: 0, y: 0, w: screen.availWidth, h: screen.availHeight }
  }

  private async restoredAnchor(): Promise<Pos> {
    const saved = this.h.loadPos()
    const ms = await this.monitors()
    const m = saved && ms.find((x) => x.name === saved.monitor)
    if (saved && m) {
      const wa = area(m)
      return clampInto({ x: wa.x + saved.rx * wa.w, y: wa.y + saved.rb * wa.h }, this.basicSize(), wa)
    }
    return defaultAnchor(await this.primaryArea(), this.basicSize().width)
  }

  // 끌기 끝(움직임이 300ms 멈춤): 고정점을 새 자리로, 자석을 적용하고 위치를 기억한다
  private onMoved(): void {
    if (this.moving) return
    clearTimeout(this.moveTimer)
    this.moveTimer = window.setTimeout(() => void this.settleMove(), 300)
  }

  private async settleMove(): Promise<void> {
    const pos = await this.win.outerPosition()
    const s = await this.win.scaleFactor()
    const off = this.basicOffset()
    const anchor = { x: pos.x / s + off.x, y: pos.y / s + off.y }
    const ms = await this.monitors()
    const m = ms.find((x) => {
      const a = area(x)
      return anchor.x >= a.x - 1 && anchor.x < a.x + a.w && anchor.y > a.y && anchor.y <= a.y + a.h + 1
    }) ?? ms[0]
    const wa = m ? area(m) : await this.primaryArea()
    const snapped = magnet(anchor, this.basicSize(), wa)
    if (snapped.x !== anchor.x || snapped.y !== anchor.y) await this.place(snapped)
    else this.anchor = anchor
    this.h.savePos({ monitor: m?.name ?? null, rx: (this.anchor.x - wa.x) / wa.w, rb: (this.anchor.y - wa.y) / wa.h })
  }

  // 판을 누르고 4 넘게 움직이면 창을 끈다(위치 잠금이면 무시). 끌었으면 이어지는 클릭은 버린다
  enableDrag(el: HTMLElement): void {
    let start: Pos | null = null
    let dragged = false
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      start = { x: e.clientX, y: e.clientY }
      dragged = false
    })
    el.addEventListener('pointermove', (e) => {
      if (!start || this.h.locked() || (e.buttons & 1) === 0) return
      if (Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) > 4) {
        start = null
        dragged = true
        void this.win.startDragging()
      }
    })
    el.addEventListener('pointerup', () => { start = null })
    el.addEventListener('click', (e) => {
      if (dragged) {
        e.stopImmediatePropagation()
        e.preventDefault()
        dragged = false
      }
    }, true)
  }

  // 판 밖 투명한 곳·클릭 통과 켬이면 마우스를 통과시킨다. 통과 중에는 화면이 마우스를 못 받으므로 커서 위치를 물어 본다
  private async passThrough(): Promise<void> {
    if (!this.visible) return
    let ignore = this.h.clickThrough()
    if (!ignore) {
      try {
        const c = await this.t.window.cursorPosition()
        const p = await this.win.outerPosition()
        const s = await this.win.scaleFactor()
        const x = (c.x - p.x) / s
        const y = (c.y - p.y) / s
        const inside = x >= 0 && y >= 0 && x < this.size.width && y < this.size.height
        const hit = inside ? document.elementFromPoint(x, y) : null
        ignore = inside && (!hit || hit === document.documentElement || hit === document.body || hit.id === 'app' || hit.id === 'stack')
      } catch { ignore = false }
    }
    if (ignore !== this.ignoring) {
      this.ignoring = ignore
      await this.win.setIgnoreCursorEvents(ignore)
    }
  }

  async setOnTop(v: boolean): Promise<void> {
    await this.win.setAlwaysOnTop(v)
  }

  async show(): Promise<void> {
    this.userHidden = false
    this.visible = true
    await this.win.show()
  }

  async hide(): Promise<void> {
    this.userHidden = true
    this.visible = false
    await this.win.hide()
  }

  async toggle(): Promise<void> {
    if (await this.win.isVisible()) await this.hide()
    else await this.show()
  }

  async resetPosition(): Promise<void> {
    const a = defaultAnchor(await this.primaryArea(), this.basicSize().width)
    await this.place(a)
    const wa = await this.primaryArea()
    this.h.savePos({ monitor: (await this.t.window.primaryMonitor())?.name ?? null, rx: (a.x - wa.x) / wa.w, rb: (a.y - wa.y) / wa.h })
  }

  // 전체화면 앱이 모니터를 덮으면 숨고, 끝나면 1초 뒤 다시 보인다(사용자가 숨긴 창은 그대로)
  private async onFullscreen(on: boolean): Promise<void> {
    if (on && this.h.hideOnFullscreen() && !this.userHidden) {
      this.fullscreenHidden = true
      this.visible = false
      await this.win.hide()
    } else if (!on && this.fullscreenHidden) {
      this.fullscreenHidden = false
      setTimeout(() => { if (!this.userHidden) { this.visible = true; void this.win.show() } }, 1000)
    }
  }
}
