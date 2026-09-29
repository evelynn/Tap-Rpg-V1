// 진입점: 번들 읽기 → 저장에서 이어 가기(없으면 첫 실행) → 실시간 구동·그리기.
// 데스크톱(Tauri)에서는 테두리 없는 투명 창(D85)과 트레이, 저장 파일을 쓰고, 브라우저 시제품은 저장소를 쓴다.
import { Content, ageAt, createGameWorld, runOffline, runEvent, setAttitude, submitPendingAuto, summaryView, type SaveMeta, type World } from '@tap/core'
import { App } from './app'
import { attitudeNote } from './detail/model'
import { DetailWindow, button, h } from './detail/view'
import { ChoiceWindow } from './choice'
import { SuccessionWindow } from './succession'
import { SPEEDS } from './driver'
import { COL, WINDOW_SCALES, drawDue, surface, windowScale, windowWidth } from './layout'
import { Overlay } from './overlay'
import { Saver, loadGame, localBackend, tauriBackend, type Loaded, type SaveBackend } from './persist'
import { SUMMARY_MIN_SEC, SummaryWindow } from './summary'
import { DEFAULT_SETTINGS, SettingsWindow, readSettings, type Settings } from './settings'
import { DesktopShell, tauriApi } from './window'
import { FirstRunWindow, type FirstRunResult } from './firstrun'
import { GuideScheduler } from './guide'
import { QuickMenu } from './menu'
import { Panel } from './panel'
import { Renderer, type Images } from './render'
import { BACKGROUNDS, SHEETS, STRIPS } from './sprites'

const APP_VERSION = '0.1.0'

function randomSeed(): string {
  return [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function loadImage(src: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(undefined) // 없는 그림은 건너뛴다
    img.src = src
  })
}

// 첫 실행에서 고른 값으로 새 가문(12 §1, 03 §12). 개발용 주소 인자 ?name=&family=&seed= 도 같은 길로 온다
function newFamily(content: Content, r: FirstRunResult): World {
  const bg = content.list('background').find((b) => b.unlock === null)
  if (!bg) throw new Error('해금 없이 쓸 출신 배경이 없다')
  const w = createGameWorld(content, {
    familyName: r.family, familySeed: r.seed ?? randomSeed(), foundedUtc: Date.now(),
    character: { name: r.name, background: bg.id, appearance: r.appearance },
  })
  if (r.attitude && r.attitude !== w.state.policies.attitude) setAttitude(w, r.attitude)
  return w
}

// 주소 인자: ?new=1(새 가문, 첫 실행 창) ?name=모라&family=모래&seed=16진16자리(첫 실행 건너뜀) ?scale=1|2|3 ?width=528~1536
// ?dev=1(개발용 단추·정보 줄) ?auto=1(선택·계승 자동) ?grid=1(선명도 격자)
async function start(): Promise<void> {
  const q = new URLSearchParams(location.search)
  const tauri = tauriApi()
  const desktop = tauri !== null
  const backend: SaveBackend = tauri ? tauriBackend(tauri.core.invoke) : localBackend()
  let settings: Settings = DEFAULT_SETTINGS
  try { settings = readSettings(JSON.parse((await backend.readSettings()) ?? '{}')) } catch { settings = { ...DEFAULT_SETTINGS } }
  if (q.has('scale')) settings.window_scale = windowScale(q.get('scale'))
  if (q.has('width')) settings.window_width = windowWidth(q.get('width'))
  const saveSettings = (patch: Partial<Settings>): void => {
    settings = { ...settings, ...patch }
    void backend.writeSettings(JSON.stringify(settings)).catch(() => { /* 이번 실행만 */ })
  }
  const html = document.documentElement
  html.classList.toggle('desktop', desktop)
  html.classList.toggle('dev', !desktop || q.get('dev') === '1')

  const bundle = (await (await fetch('content.json')).json()) as { content_hash: string; packs: { id: string; version: string }[] }
  const content = Content.fromBundle(bundle as never)
  const meta = (): SaveMeta => ({ app_version: APP_VERSION, saved_at_utc: Date.now(), content_packs: bundle.packs, content_hash: bundle.content_hash })
  const files = [...new Set([...Object.values(SHEETS).map((s) => s.file), ...Object.values(STRIPS), ...BACKGROUNDS])]
  const pics = await Promise.all(files.map((f) => loadImage(`sprites/${f}.png`)))
  const images: Images = Object.fromEntries(files.map((f, i) => [f, pics[i]]))

  // 저장에서 이어 간다(13 §2·§8). 저장이 없으면(또는 ?new=1) 첫 실행 창(03 §12). ?seed= 이면 개발용 새 가문 바로 시작
  const direct = q.has('seed') || q.has('name')
  const loaded: Loaded = q.get('new') === '1' || direct ? { kind: 'none' } : await loadGame(backend, content, Date.now())
  if (loaded.kind === 'blocked') return blocked(loaded.message, tauri, backend)
  let world: World
  let isNew = false
  if (loaded.kind === 'ok') world = loaded.world
  else if (direct) {
    world = newFamily(content, { family: q.get('family') ?? '모래', name: q.get('name') ?? '모라', seed: /^[0-9a-f]{16}$/.test(q.get('seed') ?? '') ? q.get('seed')! : undefined, appearance: FirstRunWindow.defaultAppearance(), attitude: null })
    isNew = true
  } else {
    // 첫 실행 창(03 §12.1): 모니터 가운데, 포커스를 가져간다
    html.classList.add('booting')
    if (tauri) {
      const w = tauri.window.getCurrentWindow() as unknown as { setSize(s: unknown): Promise<void>; center(): Promise<void>; show(): Promise<void>; setFocus(): Promise<void> }
      await w.setSize(new tauri.dpi.LogicalSize(480 + 24, 560 + 24))
      await w.center()
      await w.show()
      await w.setFocus()
    }
    const r = await new FirstRunWindow(document.getElementById('firstrun')!, content, loaded.kind === 'fail' ? loaded.message : null, () => void backend.openFolder()).ask()
    world = newFamily(content, r)
    isNew = true
    html.classList.remove('booting')
  }
  boot({ q, tauri, desktop, backend, settings, saveSettings, content, meta, images, world, loaded, isNew })
}

// 열 수 없는 새 버전 기록(13 §8.7): 새 가문을 만들지 않고(덮어쓰지 않게) 안내와 폴더 열기·종료만 둔다
async function blocked(message: string, tauri: ReturnType<typeof tauriApi>, backend: SaveBackend): Promise<void> {
  const root = document.getElementById('firstrun')!
  document.documentElement.classList.add('booting')
  if (tauri) {
    const w = tauri.window.getCurrentWindow() as unknown as { setSize(s: unknown): Promise<void>; center(): Promise<void>; show(): Promise<void> }
    await w.setSize(new tauri.dpi.LogicalSize(480 + 24, 560 + 24))
    await w.center()
    await w.show()
  }
  root.hidden = false
  root.replaceChildren(
    h('div', { class: 'd-head' }, h('div', {}, '텝')),
    h('div', { class: 'd-body' }, h('div', {}, message)),
    h('div', { class: 'd-foot' }, h('div', { class: 'd-acts' },
      button('폴더 열기', () => void backend.openFolder()),
      tauri ? button('종료', () => void tauri.core.invoke('app_exit')) : null)))
}

interface Boot {
  q: URLSearchParams
  tauri: ReturnType<typeof tauriApi>
  desktop: boolean
  backend: SaveBackend
  settings: Settings
  saveSettings: (p: Partial<Settings>) => void
  content: Content
  meta: () => SaveMeta
  images: Images
  world: World
  loaded: Loaded
  isNew: boolean
}

function boot(b: Boot): void {
  const { q, tauri, desktop, content, images, loaded } = b
  const get = (): Settings => b.settings
  const set = (patch: Partial<Settings>): void => {
    b.saveSettings(patch)
    b.settings = { ...b.settings, ...patch }
    apply()
  }
  const startNotes: string[] = []
  if (loaded.kind === 'ok') {
    if (loaded.recovered) startNotes.push(`최근 정상 기록(${new Date(loaded.savedAt).toLocaleString('ko-KR')})으로 복구했습니다.`)
    if (loaded.readOnly) startNotes.push('더 새로운 버전에서 만든 기록입니다. 이 버전에서는 읽기만 하고 저장하지 않습니다.')
    if (loaded.offlineFailed) startNotes.push('지난 이야기를 정리하지 못해 오프라인 진행 없이 시작합니다.')
  }

  const sceneFiles = Object.fromEntries(Object.entries(STRIPS).filter(([k, f]) => k !== 'bg' && images[f]))
  const app = new App(b.world, sceneFiles, new Set(BACKGROUNDS.filter((f) => images[f])), q.get('auto') === '1') // ?auto=1: 선택·계승 자동(개발용)
  ;(globalThis as { tapApp?: App }).tapApp = app // 개발용: 콘솔에서 세계·대기열을 들여다본다
  ;(globalThis as { tapDev?: unknown }).tapDev = {
    event: (id: string, place: string) => runEvent(app.world, id, { place, force: true }, app.world.ports),
    toSuccession: () => {
      const w = app.world
      for (let i = 0; i < 40000 && w.state.current_activity.state !== 'awaiting_succession'; i++) {
        if (w.state.pending_choice) submitPendingAuto(w)
        else w.advance(600)
      }
      return w.state.current_activity.state
    },
  }

  const html = document.documentElement
  const win = document.getElementById('win')!
  const stack = document.getElementById('stack')!
  const overlay = new Overlay(document.getElementById('strip')!, document.getElementById('bubble')!)
  const canvas = document.getElementById('art') as HTMLCanvasElement
  const panel = new Panel(document.getElementById('col')!, 1)
  const scratch = document.createElement('canvas')
  scratch.width = 1024 // 흰빛 덮기(인물 칸)와 띠 맨 윗줄 하늘색 재기(띠 폭)에 같이 쓴다
  scratch.height = 64
  const media = matchMedia('(prefers-color-scheme: dark)')
  const isDark = (): boolean => b.settings.theme === 'dark' || (b.settings.theme === 'system' && media.matches)
  let renderer!: Renderer
  let fitKey = ''
  // 설정을 화면에 적용: 배율·너비·글자 배율·테마·고대비(03 §7·§14). 캔버스 기억 크기 = 장치 픽셀
  const apply = (): void => {
    const s = b.settings
    const colW = Math.round(COL.w * s.text_scale)
    const total = s.window_width + colW - COL.w
    app.width = total
    app.colW = colW
    html.style.setProperty('--t', String(s.text_scale))
    stack.style.setProperty('--u', String(s.window_scale))
    stack.style.setProperty('--w', String(total))
    stack.classList.toggle('nostrip', !s.record_strip)
    html.classList.toggle('dark', isDark())
    html.classList.toggle('hc', s.high_contrast)
    html.classList.toggle('through', s.click_through && desktop)
    panel.setScale(s.window_scale * s.text_scale)
    const key = `${devicePixelRatio}|${s.window_scale}|${total}`
    if (key !== fitKey) {
      fitKey = key
      const sf = surface(devicePixelRatio || 1, s.window_scale, total)
      canvas.width = sf.devW
      canvas.height = sf.devH
      canvas.style.width = `${sf.cssW}px`
      canvas.style.height = `${sf.cssH}px`
      renderer = new Renderer(canvas.getContext('2d')!, images, sf, scratch.getContext('2d'), q.get('grid') === '1')
      canvas.dataset.k = String(sf.k)
    }
  }
  const watchDpr = (): void => {
    matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener('change', () => { apply(); watchDpr() }, { once: true })
  }
  apply()
  watchDpr()
  media.addEventListener('change', apply)

  // 창 너비(03 §2.8, D82): 기본 창 오른쪽 끝을 끌어 528~1536으로. 끄는 동안 다시 맞추고 놓으면 기억한다
  const grip = document.getElementById('grip')!
  grip.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    grip.setPointerCapture(e.pointerId)
    const x0 = e.clientX
    const w0 = b.settings.window_width
    const move = (ev: PointerEvent): void => {
      b.settings = { ...b.settings, window_width: windowWidth(w0 + (ev.clientX - x0) / b.settings.window_scale) }
      apply()
    }
    const up = (): void => {
      grip.removeEventListener('pointermove', move)
      set({ window_width: b.settings.window_width })
    }
    grip.addEventListener('pointermove', move)
    grip.addEventListener('pointerup', up, { once: true })
  })
  grip.addEventListener('click', (e) => e.stopPropagation())

  // 개발용 조작(배속·멈춤). 데스크톱에서는 ?dev=1일 때만 보인다
  const info = document.getElementById('info')!
  const controls = document.getElementById('controls')!
  for (const s of SPEEDS) {
    const bt = document.createElement('button')
    bt.textContent = `×${s}`
    bt.onclick = () => { app.driver.speed = s }
    controls.append(bt)
  }
  const pause = document.createElement('button')
  controls.append(pause)
  pause.onclick = () => app.driver.setPaused(!app.driver.paused)

  // 상세 창(03 §5)·운명 선택(03 §6)·계승(03 §8)·설정(03 §7)·복귀 요약(03 §9): 투명 창 안의 떠 있는 판(D85)
  const detail = new DetailWindow(document.getElementById('detail')!, app.world, (t) => app.note(t), () => app.driver.setPaused(!app.driver.paused))
  const menuEl = document.getElementById('menu')!
  if (desktop) document.getElementById('stack')!.after(menuEl) // 투명 창은 #app 크기만 감싸므로 메뉴도 판으로, 기본 창 바로 위(D85)
  const menu = new QuickMenu(menuEl)
  const choice = new ChoiceWindow(document.getElementById('choice')!, app.world, () => detail.render())
  const succession = new SuccessionWindow(document.getElementById('succession')!, app.world, () => detail.render())
  detail.onSuccession = () => succession.show()
  detail.onSettings = () => settingsWin.show()

  // 저장(13 §8.1): 30초마다, 행동 적용 뒤(2초에 한 번까지), 귀환·큰 선택·생애 끝·계승은 백업과 함께, 종료 때
  const saver = new Saver(b.backend, () => app.world, b.meta)
  saver.readOnly = loaded.kind === 'ok' && loaded.readOnly
  setInterval(() => void saver.request(), content.balance.offline.autosave_sec * 1000)
  let lastState = app.world.state.current_activity.state
  const afterStep = (): void => {
    const st = app.world.state.current_activity.state
    const lifeTurn = app.lastTick.some((e) => e.tag === 'retire' || e.tag === 'death' || e.tag === 'succession')
    if (lifeTurn) void saver.request({ backup: true, force: true })
    else if (st !== lastState && (st === 'town_prep' || st === 'awaiting_choice' || st === 'awaiting_succession')) void saver.request({ backup: true })
    else if (app.lastTick.length) saver.requestThrottled()
    lastState = st
  }
  const quit = async (): Promise<void> => {
    await saver.flush()
    if (tauri) await tauri.core.invoke('app_exit')
  }
  addEventListener('pagehide', () => void saver.request())
  if (b.isNew) void saver.request({ backup: true }) // 새 가문은 바로 한 번 남긴다

  // 안내(03 §11.2·§12.2): 첫 가문 첫 인물만, 8초·60초 간격
  const guide = new GuideScheduler(content, (t) => app.note(t), () => b.settings.guides_done, () => set({ guides_done: true }), b.settings.guides_seen, (ids) => b.saveSettings({ guides_seen: ids }))

  const settingsWin = new SettingsWindow(document.getElementById('settings')!, get, {
    change: (patch) => {
      set(patch)
      if ('always_on_top' in patch) void shell?.setOnTop(!!patch.always_on_top)
    },
    resetPosition: () => { set({ position_locked: false }); void shell?.resetPosition() },
    resetSize: () => set({ window_scale: 1, text_scale: 1, window_width: 768 }),
    replayGuides: () => { set({ guides_done: false, guides_seen: [] }); guide.replay() },
    desktop,
  })

  const summaryWin = new SummaryWindow(document.getElementById('summary')!, {
    journal: () => detail.show('일지'), book: () => detail.openBook(), choice: () => choice.show(), succession: () => succession.show(),
  })
  const sum = loaded.kind === 'ok' ? loaded.summary : null
  if ((sum && sum.settled_sec >= SUMMARY_MIN_SEC) || startNotes.length) summaryWin.show(sum ? summaryView(app.world, sum) : null, startNotes)
  else if (sum && sum.settled_sec > 0) app.note('ⓘ 자리를 비운 동안의 일을 정리했습니다')

  // 데스크톱 투명 창(D85): 판 크기에 창을 맞추고 기본 창 자리를 지킨다. 트레이 메뉴(03 §10)
  let shell: DesktopShell | null = null
  if (tauri) {
    shell = new DesktopShell(tauri, {
      basic: () => win, root: document.getElementById('app')!,
      loadPos: () => b.settings.window_pos, savePos: (p) => b.saveSettings({ window_pos: p }),
      hideOnFullscreen: () => b.settings.hide_on_fullscreen, clickThrough: () => b.settings.click_through,
      locked: () => b.settings.position_locked,
      onTray: (id) => {
        switch (id) {
          case 'show': void shell!.show(); break
          case 'hide': void shell!.hide(); break
          case 'toggle': void shell!.toggle(); break
          case 'detail': void shell!.show(); detail.show('일지'); break
          case 'pause': app.driver.setPaused(!app.driver.paused); break
          case 'clickthrough_off': set({ click_through: false }); break
          case 'lock': set({ position_locked: !b.settings.position_locked }); settingsWin.render(); break
          case 'ontop': set({ always_on_top: !b.settings.always_on_top }); void shell!.setOnTop(b.settings.always_on_top); settingsWin.render(); break
          case 'reset_pos': set({ position_locked: false }); void shell!.resetPosition(); break
          case 'reset_size': set({ window_scale: 1, text_scale: 1, window_width: 768 }); settingsWin.render(); break
          case 'settings': void shell!.show(); settingsWin.show(); break
          case 'quit': void quit(); break
        }
      },
    })
    for (const el of [canvas, document.getElementById('strip')!]) shell.enableDrag(el)
    void shell.init().then(() => shell!.setOnTop(b.settings.always_on_top))
  }

  canvas.onclick = () => detail.show('일지')
  document.getElementById('strip')!.onclick = () => detail.show('일지')
  document.getElementById('bubble')!.onclick = () => detail.show('일지')
  // 우클릭 메뉴(03 §2.6). 축소 창은 첫 데스크톱판 범위 밖(D85)
  win.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const s = b.settings
    menu.openAt(e.clientX, e.clientY, [
      { label: '상세 창 열기', run: () => detail.show('일지') },
      { label: app.driver.paused ? '다시 진행' : '일시정지', run: () => app.driver.setPaused(!app.driver.paused) },
      ...(desktop ? [{ label: '위치 잠금', checked: s.position_locked, run: () => set({ position_locked: !s.position_locked }) }] : []),
      'sep',
      { label: '기록 띠', checked: s.record_strip, run: () => set({ record_strip: !s.record_strip }) },
      { label: '말풍선', checked: s.speech_bubble, run: () => set({ speech_bubble: !s.speech_bubble }) },
      'sep',
      ...WINDOW_SCALES.map((v) => ({ label: `화면 배율 ${v * 100}%`, checked: v === s.window_scale, run: () => set({ window_scale: v }) })),
      'sep',
      { label: '설정', run: () => settingsWin.show() },
      ...(desktop ? [{ label: '숨기기', run: () => void shell?.hide() }] : []),
    ])
  })
  const col = document.getElementById('col')!
  col.addEventListener('click', (e) => {
    const t = e.target as HTMLElement
    if (t.closest('.mark.choice')) {
      e.stopPropagation()
      choice.show()
      return
    }
    if (t.closest('.mark.succession')) {
      e.stopPropagation()
      succession.show()
      return
    }
    const mark = t.closest<HTMLElement>('.attitude')
    if (mark) {
      e.stopPropagation() // 문서 클릭이 막 연 메뉴를 닫지 않게
      const w = app.world
      const cur = w.state.policies.attitude
      menu.open(mark, [
        ...[...w.content.list('attitude')].sort((a, c) => a.order - c.order).map((a) => ({
          label: a.name, checked: a.id === cur,
          run: () => {
            if (a.id === cur) return
            setAttitude(w, a.id)
            app.note(attitudeNote(a.name))
            detail.render()
          },
        })),
        'sep',
        { label: '방침 더 보기…', run: () => detail.show('방침') },
      ])
    }
    else if (t.closest('.status, .icons')) detail.show('인물')
    else if (t.closest('.record')) detail.show('일지')
  })
  setInterval(() => { detail.render(); choice.render() }, 1000) // 열려 있을 때만 다시 그린다
  // 선택 대기는 트레이 설명 글로도 알린다(03 §10, 점 그림은 그림 요청 뒤)
  let tip = ''
  setInterval(() => {
    const t = app.world.state.pending_choice ? '텝 · 중요한 선택 1건이 기다리고 있습니다' : app.world.state.current_activity.state === 'awaiting_succession' ? '텝 · 계승을 기다리고 있습니다' : '텝'
    if (t !== tip && tauri) { tip = t; void tauri.core.invoke('tray_tooltip', { text: t }) }
  }, 2000)

  // 진행은 매 프레임, 그리기는 초당 최대 30번(drawDue). 숨어 있거나 프레임이 멈추면 1초마다 진행만 한다(그리기 0, 03 §10)
  let last = performance.now()
  let lastDraw = -Infinity
  let lastFrame = performance.now()
  const advance = (now: number, cap: number) => {
    const gap = now - last
    // 잠자기·30초 넘게 멈춘 틱은 오프라인과 같은 규칙으로 정산한다(13 §7)
    if (gap >= 30000 && !app.driver.paused && app.world.state.current_activity.state !== 'paused') {
      try {
        const r = runOffline(app.world, { now_utc: Date.now(), saved_at_utc: Date.now() - gap })
        if (r.summary && r.summary.settled_sec > 0) app.note('ⓘ 자리를 비운 동안의 일을 정리했습니다')
      } catch (e) { console.error('[텝] 실행 중 정산 실패', e) }
      void saver.request({ backup: true })
    }
    const dt = Math.min(cap, Math.max(0, gap))
    last = now
    const view = app.step(now, dt, isDark())
    afterStep()
    guide.tick(app.world, now)
    return view
  }
  setInterval(() => { if (performance.now() - lastFrame > 1000) advance(performance.now(), 1000) }, 1000)
  const frame = (now: number): void => {
    lastFrame = now
    const view = advance(now, 250) // 숨김에서 돌아왔을 때 한꺼번에 흘리지 않는다
    if (!drawDue(now, lastDraw) || (shell && !shell.visible)) {
      requestAnimationFrame(frame)
      return
    }
    lastDraw = now
    renderer.draw(view)
    panel.update(view)
    overlay.update(view.strip, view.bubble, view.heroCx, b.settings.record_strip, b.settings.speech_bubble)
    const ch = app.world.state.character
    pause.textContent = app.driver.paused ? '다시 진행' : '일시정지'
    info.textContent = ch
      ? `${ch.generation}대 · 유효 진행 ${ch.eff_min.toFixed(1)}분 · ${ageAt(ch.eff_min, content.balance.time)}세 · ${app.world.state.current_activity.state} · ×${app.driver.speed} · 대기열 ${app.lines.pending.length} · dpr ${devicePixelRatio} · 그림 ×${canvas.dataset.k}`
      : '인물 없음'
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

start().catch((e: unknown) => {
  document.body.append(`시작하지 못했다: ${e instanceof Error ? e.message : String(e)}`)
  console.error(e)
})
