// 설정(03 §7, 400 × 480): 설치별 창 설정(13 §9 settings.json). 바꾸면 바로 적용하고 저장한다.
import { WINDOW_SCALES, windowWidth } from './layout'
import { button, h } from './detail/view'
import type { SavedPos } from './window'

export const TEXT_SCALES = [1, 1.25, 1.5] as const
export type Theme = 'light' | 'dark' | 'system'

export interface Settings {
  always_on_top: boolean
  position_locked: boolean
  click_through: boolean
  hide_on_fullscreen: boolean
  record_strip: boolean
  speech_bubble: boolean
  window_scale: number
  window_width: number
  text_scale: number
  high_contrast: boolean
  theme: Theme
  guides_done: boolean // 안내를 모두 보았는가(안내 다시 보기로 되돌린다, 03 §12)
  guides_seen: string[] // 이미 띄운 안내 id
  sound_enabled: boolean // 소리(03 §7). 음원이 아직 없어 켜도 소리는 나지 않는다
  sound_volume: number
  window_pos: SavedPos | null
}

export const DEFAULT_SETTINGS: Settings = {
  always_on_top: false, position_locked: false, click_through: false, hide_on_fullscreen: true,
  record_strip: true, speech_bubble: true, window_scale: 1, window_width: 768, text_scale: 1,
  high_contrast: false, theme: 'system', guides_done: false, guides_seen: [], sound_enabled: false, sound_volume: 40, window_pos: null,
}

// 옛 설정·손상된 값은 기본값으로(모르는 칸은 버린다)
export function readSettings(raw: unknown): Settings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const s = { ...DEFAULT_SETTINGS }
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const v = o[k]
    if (v === undefined) continue
    const d = DEFAULT_SETTINGS[k]
    if (typeof d === 'boolean' && typeof v === 'boolean') (s as Record<string, unknown>)[k] = v
    else if (typeof d === 'number' && typeof v === 'number' && Number.isFinite(v)) (s as Record<string, unknown>)[k] = v
  }
  if (o.theme === 'light' || o.theme === 'dark' || o.theme === 'system') s.theme = o.theme
  const p = o.window_pos as Record<string, unknown> | undefined
  if (p && typeof p.rx === 'number' && typeof p.rb === 'number') s.window_pos = { monitor: typeof p.monitor === 'string' ? p.monitor : null, rx: p.rx, rb: p.rb }
  if (Array.isArray(o.guides_seen)) s.guides_seen = o.guides_seen.filter((x): x is string => typeof x === 'string')
  s.window_width = windowWidth(s.window_width) // 손상된 값으로 거대한 캔버스를 만들지 않게
  s.sound_volume = Math.min(100, Math.max(0, Math.round(s.sound_volume)))
  if (!(WINDOW_SCALES as readonly number[]).includes(s.window_scale)) s.window_scale = 1
  if (!(TEXT_SCALES as readonly number[]).includes(s.text_scale)) s.text_scale = 1
  return s
}

export interface SettingsActions {
  change: (patch: Partial<Settings>) => void
  resetPosition: () => void
  resetSize: () => void
  replayGuides: () => void
  desktop: boolean // 데스크톱에서만 되는 항목(항상 위·클릭 통과·전체화면 숨김·위치)
}

export class SettingsWindow {
  constructor(private readonly root: HTMLElement, private readonly get: () => Settings, private readonly act: SettingsActions) {
    root.hidden = true
    root.tabIndex = -1
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.hide() })
  }

  get visible(): boolean {
    return !this.root.hidden
  }

  show(): void {
    const was = this.visible
    this.root.hidden = false
    this.render()
    if (!was) this.root.focus()
  }

  hide(): void {
    this.root.hidden = true
  }

  render(): void {
    if (!this.visible) return
    const s = this.get()
    const set = (patch: Partial<Settings>): void => { this.act.change(patch); this.render() }
    const toggle = (label: string, key: keyof Settings, note: string, enabled = true): HTMLElement =>
      h('div', { class: 'd-item' },
        h('div', { class: 'd-line' }, h('span', { class: 'd-label' }, label),
          h('span', { class: 'd-seg' }, button('켬', () => set({ [key]: true } as Partial<Settings>), { on: s[key] === true, disabled: !enabled }),
            button('끔', () => set({ [key]: false } as Partial<Settings>), { on: s[key] === false, disabled: !enabled }))),
        h('div', { class: 'd-note' }, note))
    const seg = <T extends number | string>(label: string, opts: readonly (readonly [T, string])[], cur: T, pick: (v: T) => void, note: string): HTMLElement =>
      h('div', { class: 'd-item' },
        h('div', { class: 'd-line' }, h('span', { class: 'd-label' }, label),
          h('span', { class: 'd-seg' }, ...opts.map(([v, t]) => button(t, () => { pick(v); this.render() }, { on: cur === v })))),
        h('div', { class: 'd-note' }, note))
    const d = this.act.desktop
    this.root.replaceChildren(
      h('div', { class: 'd-head' }, h('div', {}, '설정'), button('×', () => this.hide(), { title: '닫기 (Esc)' })),
      h('div', { class: 'd-body' },
        toggle('항상 위에 표시', 'always_on_top', '켜면 다른 창 위에 기본 창을 띄워 둡니다.', d),
        toggle('위치 잠금', 'position_locked', '켜면 끌어서 옮길 수 없습니다.', d),
        toggle('클릭 통과', 'click_through', '켜면 기본 창이 마우스를 받지 않습니다. 끄려면 알림 영역 아이콘 메뉴의 `클릭 통과 해제`를 누르세요.', d),
        toggle('전체화면 앱 실행 시 숨기기', 'hide_on_fullscreen', '게임이나 영상을 전체화면으로 보면 잠시 숨습니다.', d),
        toggle('소리', 'sound_enabled', '켜도 전투 소리는 20초에 한 번까지만 냅니다. (첫 데스크톱판에는 음원이 아직 없습니다.)'),
        toggle('기록 띠', 'record_strip', '기본 창 위에 최근 기록 세 줄과 상세 문장을 보여 줍니다.'),
        toggle('말풍선', 'speech_bubble', '중요한 일이 생기면 기본 창 위에 8초 동안 말풍선을 띄웁니다. 포커스를 가져가지 않습니다.'),
        seg('화면 배율', WINDOW_SCALES.map((v) => [v, `${v * 100}%`] as const), s.window_scale, (v) => this.act.change({ window_scale: v }), '기본 창을 그림과 글자까지 통째로 두 배, 세 배로 키웁니다. 그림은 번지지 않습니다.'),
        seg('글자 배율', TEXT_SCALES.map((v) => [v, `${v * 100}%`] as const), s.text_scale, (v) => this.act.change({ text_scale: v }), '기본 창과 상세 창의 글자 크기를 함께 바꿉니다.'),
        toggle('고대비', 'high_contrast', '배경 그림을 흐리게 하고 글자 판을 불투명하게 합니다.'),
        seg('테마', [['light', '밝게'], ['dark', '어둡게'], ['system', '시스템']] as const, s.theme, (v) => this.act.change({ theme: v }), ''),
        h('div', { class: 'd-item' }, h('div', { class: 'd-line' }, button('창 위치 초기화', () => this.act.resetPosition(), { disabled: !d })), h('div', { class: 'd-note' }, '기본 창을 작업 표시줄 오른쪽 위로 되돌립니다.')),
        h('div', { class: 'd-item' }, h('div', { class: 'd-line' }, button('창 크기 초기화', () => { this.act.resetSize(); this.render() })), h('div', { class: 'd-note' }, '화면 배율과 글자 배율을 100%로, 기본 창 너비를 768로 되돌립니다.')),
        h('div', { class: 'd-item' }, h('div', { class: 'd-line' }, button('안내 다시 보기', () => this.act.replayGuides())), h('div', { class: 'd-note' }, '첫 실행 안내를 다시 켭니다.'))),
      h('div', { class: 'd-foot' }, h('div', { class: 'd-dim' }, '텝은 네트워크에 연결하지 않습니다. 계정이 없고, 기록은 이 컴퓨터에만 저장합니다.')))
  }
}
