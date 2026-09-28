// 브라우저 진입점: 번들 읽기 → 세계 만들기 → 실시간 구동·그리기. Tauri 2 껍데기도 이 dist를 그대로 싣는다(파일 시스템을 쓰지 않는다).
import { Content, ageAt, createGameWorld, runOffline, runEvent, setAttitude, submitPendingAuto, summaryView, type SaveMeta, type World } from '@tap/core'
import { App } from './app'
import { attitudeNote } from './detail/model'
import { DetailWindow } from './detail/view'
import { ChoiceWindow } from './choice'
import { SuccessionWindow } from './succession'
import { SPEEDS } from './driver'
import { WINDOW_SCALES, drawDue, surface, windowScale, windowWidth, type WindowScale } from './layout'
import { Overlay } from './overlay'
import { Saver, loadGame, localBackend, tauriBackend, tauriInvoke, type SaveBackend } from './persist'
import { SUMMARY_MIN_SEC, SummaryWindow } from './summary'
import { QuickMenu } from './menu'
import { Panel } from './panel'
import { Renderer, type Images } from './render'
import { BACKGROUNDS, SHEETS, STRIPS } from './sprites'

const APP_VERSION = '0.1.0'

// 외형 ID는 화면 몫이다(tools/demo와 같은 임시 외형)
const APPEARANCE = { body: 'body_base', hair: 'HR03', hair_color: 'hair_chestnut', skin_tone: 'skin_02', decor: [], age_stage_override: null }

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

// 주소 인자: ?name=모라&family=모래&seed=16진16자리&scale=1|2|3(화면 배율을 이번만 덮어씀)&width=528~1536&grid=1(선명도 확인 격자)

// 창 설정은 설치별(13 §9 settings.json: window_scale·window_width·record_strip·speech_bubble).
// 데스크톱은 %APPDATA%\Tap\settings.json, 브라우저 시제품은 저장소
interface Settings { window_scale?: unknown; window_width?: unknown; record_strip?: unknown; speech_bubble?: unknown }
let settings: Settings = {}
let backend: SaveBackend = localBackend()
function saveSettings(v: Settings): void {
  settings = { ...settings, ...v }
  void backend.writeSettings(JSON.stringify(settings)).catch(() => { /* 이번 실행만 */ })
}
function newWorld(content: Content, q: URLSearchParams): World {
  const bg = content.list('background').find((b) => b.unlock === null)
  if (!bg) throw new Error('해금 없이 쓸 출신 배경이 없다')
  const seed = q.get('seed') ?? ''
  return createGameWorld(content, {
    familyName: q.get('family') ?? '모래',
    familySeed: /^[0-9a-f]{16}$/.test(seed) ? seed : randomSeed(),
    foundedUtc: Date.now(),
    character: { name: q.get('name') ?? '모라', background: bg.id, appearance: APPEARANCE },
  })
}

async function start(): Promise<void> {
  const q = new URLSearchParams(location.search)
  const invoke = tauriInvoke()
  backend = invoke ? tauriBackend(invoke) : localBackend()
  try { settings = JSON.parse((await backend.readSettings()) ?? '{}') as Settings } catch { settings = {} }
  const saved = settings
  let u: WindowScale = windowScale(q.get('scale') ?? saved.window_scale) // 화면 배율 100/200/300%(D81). 기본 1 = 100%(D75)
  let width = windowWidth(q.get('width') ?? saved.window_width) // 기본 창 너비(D82)
  let showStrip = saved.record_strip !== false // 기록 띠·말풍선은 기본 켬(03 §2.7)
  let showBubble = saved.speech_bubble !== false
  const grid = q.get('grid') === '1'
  const bundle = (await (await fetch('content.json')).json()) as { content_hash: string; packs: { id: string; version: string }[] }
  const content = Content.fromBundle(bundle as never)
  const meta = (): SaveMeta => ({ app_version: APP_VERSION, saved_at_utc: Date.now(), content_packs: bundle.packs, content_hash: bundle.content_hash })
  // 저장에서 이어 간다(13 §2·§8). ?new=1 이거나 ?seed= 가 있으면 개발용으로 새 가문(저장을 덮어쓴다)
  const fresh = q.get('new') === '1' || q.has('seed')
  const loaded = fresh ? { kind: 'none' as const } : await loadGame(backend, content, Date.now())
  const startNotes: string[] = []
  if (loaded.kind === 'fail') startNotes.push(loaded.message)
  if (loaded.kind === 'ok') {
    if (loaded.recovered) startNotes.push(`최근 정상 기록(${new Date(loaded.savedAt).toLocaleString('ko-KR')})으로 복구했습니다.`)
    if (loaded.readOnly) startNotes.push('더 새로운 버전에서 만든 기록입니다. 이 버전에서는 읽기만 하고 저장하지 않습니다.')
    if (loaded.offlineFailed) startNotes.push('지난 이야기를 정리하지 못해 오프라인 진행 없이 시작합니다.')
  }

  const files = [...new Set([...Object.values(SHEETS).map((s) => s.file), ...Object.values(STRIPS), ...BACKGROUNDS])]
  const pics = await Promise.all(files.map((f) => loadImage(`sprites/${f}.png`)))
  const images: Images = Object.fromEntries(files.map((f, i) => [f, pics[i]]))
  const sceneFiles = Object.fromEntries(Object.entries(STRIPS).filter(([k, f]) => k !== 'bg' && images[f]))
  const app = new App(loaded.kind === 'ok' ? loaded.world : newWorld(content, q), sceneFiles, new Set(BACKGROUNDS.filter((f) => images[f])), q.get('auto') === '1') // ?auto=1: 선택·계승 자동(개발용)
  ;(globalThis as { tapApp?: App }).tapApp = app // 개발용: 콘솔에서 세계·대기열을 들여다본다
  // 개발용: 사건을 강제로 띄운다(예: tapDev.event('F03', 'A4'))
  ;(globalThis as { tapDev?: unknown }).tapDev = {
    event: (id: string, place: string) => runEvent(app.world, id, { place, force: true }, app.world.ports),
    // 생애가 끝나 계승 대기가 될 때까지 선택은 자동으로 풀며 흘린다
    toSuccession: () => {
      const w = app.world
      for (let i = 0; i < 40000 && w.state.current_activity.state !== 'awaiting_succession'; i++) {
        if (w.state.pending_choice) submitPendingAuto(w)
        else w.advance(600)
      }
      return w.state.current_activity.state
    },
  }

  app.width = width
  const win = document.getElementById('win')!
  const stack = document.getElementById('stack')!
  stack.style.setProperty('--u', String(u))
  stack.style.setProperty('--w', String(width))
  stack.classList.toggle('nostrip', !showStrip)
  const overlay = new Overlay(document.getElementById('strip')!, document.getElementById('bubble')!)
  const canvas = document.getElementById('art') as HTMLCanvasElement
  const panel = new Panel(document.getElementById('col')!, u)
  const scratch = document.createElement('canvas')
  scratch.width = 1024 // 흰빛 덮기(인물 칸)와 띠 맨 윗줄 하늘색 재기(띠 폭)에 같이 쓴다
  scratch.height = 64
  // 캔버스 기억 크기 = 장치 픽셀, CSS 크기 = 장치 크기 / dpr. 표시 배율(dpr)이 바뀌면(다른 모니터, 확대) 다시 맞춘다
  let renderer!: Renderer
  const fit = (): void => {
    const s = surface(devicePixelRatio || 1, u, width)
    canvas.width = s.devW
    canvas.height = s.devH
    canvas.style.width = `${s.cssW}px`
    canvas.style.height = `${s.cssH}px`
    renderer = new Renderer(canvas.getContext('2d')!, images, s, scratch.getContext('2d'), grid)
    canvas.dataset.k = String(s.k)
  }
  const watchDpr = (): void => {
    matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener('change', () => { fit(); watchDpr() }, { once: true })
  }
  fit()
  watchDpr()
  // 화면 배율을 바꾸면 창·글자 칸·캔버스를 그 자리에서 다시 맞추고 기억한다(03 §14, D81)
  const setScale = (s: WindowScale): void => {
    if (s === u) return
    u = s
    stack.style.setProperty('--u', String(u))
    panel.setScale(u)
    fit()
    saveSettings({ window_scale: u })
  }
  // 창 너비(03 §2.8, D82): 기본 창 오른쪽 끝을 끌어 528~1536으로. 끄는 동안 다시 맞추고 놓으면 기억한다
  const setWidth = (w: number): void => {
    width = windowWidth(w)
    app.width = width
    stack.style.setProperty('--w', String(width))
    fit()
  }
  const grip = document.getElementById('grip')!
  grip.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    grip.setPointerCapture(e.pointerId)
    const x0 = e.clientX
    const w0 = width
    const move = (ev: PointerEvent): void => setWidth(w0 + (ev.clientX - x0) / u)
    const up = (): void => {
      grip.removeEventListener('pointermove', move)
      saveSettings({ window_width: width })
    }
    grip.addEventListener('pointermove', move)
    grip.addEventListener('pointerup', up, { once: true })
  })
  grip.addEventListener('click', (e) => e.stopPropagation())
  const dark = matchMedia('(prefers-color-scheme: dark)')

  // 개발용 조작(배속·멈춤)
  const info = document.getElementById('info')!
  const controls = document.getElementById('controls')!
  for (const s of SPEEDS) {
    const b = document.createElement('button')
    b.textContent = `×${s}`
    b.onclick = () => { app.driver.speed = s }
    controls.append(b)
  }
  const pause = document.createElement('button')
  controls.append(pause)
  pause.onclick = () => app.driver.setPaused(!app.driver.paused)

  // 상세 창(03 §5): 풍경·한 줄 기록 → 일지, 이름·상태 줄·아이콘 → 인물, 태도 표식 → 태도 빠른 메뉴(03 §2.6)
  const detail = new DetailWindow(document.getElementById('detail')!, app.world, (t) => app.note(t), () => app.driver.setPaused(!app.driver.paused))
  const menu = new QuickMenu(document.getElementById('menu')!)
  // 운명 선택 창(03 §6)·계승 화면(03 §8): 중요 선택·계승 대기 표식을 누르면 연다(스스로 열지 않는다, 03 §1)
  const choice = new ChoiceWindow(document.getElementById('choice')!, app.world, () => detail.render())
  const succession = new SuccessionWindow(document.getElementById('succession')!, app.world, () => detail.render())
  detail.onSuccession = () => succession.show()

  // 저장(13 §8.1): 30초마다, 행동 적용 뒤(2초에 한 번까지), 귀환·큰 선택·생애 끝·계승은 백업과 함께, 종료 때
  const saver = new Saver(backend, () => app.world, meta)
  saver.readOnly = loaded.kind === 'ok' && loaded.readOnly
  setInterval(() => void saver.request(), content.balance.offline.autosave_sec * 1000)
  let lastState = app.world.state.current_activity.state
  const afterStep = (now: number): void => {
    const st = app.world.state.current_activity.state
    const lifeTurn = app.lastTick.some((e) => e.tag === 'retire' || e.tag === 'death' || e.tag === 'succession')
    if (lifeTurn) void saver.request({ backup: true, force: true })
    else if (st !== lastState && (st === 'town_prep' || st === 'awaiting_choice' || st === 'awaiting_succession')) void saver.request({ backup: true })
    else if (app.lastTick.length) saver.requestThrottled(now)
    lastState = st
  }
  const quit = async (): Promise<void> => {
    await saver.flush()
    if (invoke) await invoke('app_exit')
  }
  ;(globalThis as { __TAURI__?: { event?: { listen(e: string, f: () => void): Promise<unknown> } } }).__TAURI__?.event?.listen('tap://quit', () => void quit())
  addEventListener('pagehide', () => void saver.request())

  // 복귀 요약(03 §9): 시작 때 10분 넘게 정산했으면 연다. 알림(복구·읽기 전용)만 있어도 연다
  const summaryWin = new SummaryWindow(document.getElementById('summary')!, {
    journal: () => detail.show('일지'), book: () => detail.show('가문'), choice: () => choice.show(), succession: () => succession.show(),
  })
  const sum = loaded.kind === 'ok' ? loaded.summary : null
  if ((sum && sum.settled_sec >= SUMMARY_MIN_SEC) || startNotes.length) summaryWin.show(sum ? summaryView(app.world, sum) : null, startNotes)
  else if (sum) app.note('ⓘ 자리를 비운 동안의 일을 정리했습니다')
  if (loaded.kind !== 'ok') void saver.request({ backup: true }) // 새 가문은 바로 한 번 남긴다
  canvas.onclick = () => detail.show('일지')
  document.getElementById('strip')!.onclick = () => detail.show('일지')
  document.getElementById('bubble')!.onclick = () => detail.show('일지')
  // 우클릭 메뉴(03 §2.6). 시제품은 창 조작(축소 창·위치 잠금·설정·숨기기)이 없어 그 항목은 뺀다
  win.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    e.stopPropagation()
    menu.openAt(e.clientX, e.clientY, [
      { label: '상세 창 열기', run: () => detail.show('일지') },
      { label: app.driver.paused ? '다시 진행' : '일시정지', run: () => app.driver.setPaused(!app.driver.paused) },
      'sep',
      { label: '기록 띠', checked: showStrip, run: () => { showStrip = !showStrip; stack.classList.toggle('nostrip', !showStrip); saveSettings({ record_strip: showStrip }) } },
      { label: '말풍선', checked: showBubble, run: () => { showBubble = !showBubble; saveSettings({ speech_bubble: showBubble }) } },
      'sep',
      ...WINDOW_SCALES.map((s) => ({ label: `화면 배율 ${s * 100}%`, checked: s === u, run: () => setScale(s) })),
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
        ...[...w.content.list('attitude')].sort((a, b) => a.order - b.order).map((a) => ({
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

  // 진행은 매 프레임, 그리기는 초당 최대 30번(drawDue). 숨어 있으면 브라우저가 프레임을 멈추므로
  // 1초마다 진행만 한다(그리기 0, 03 §10·D76)
  let last = performance.now()
  let lastDraw = -Infinity
  const advance = (now: number, cap: number) => {
    const gap = now - last
    // 잠자기·30초 넘게 멈춘 틱은 오프라인과 같은 규칙으로 정산한다(13 §7)
    if (gap >= 30000 && !app.driver.paused && app.world.state.current_activity.state !== 'paused') {
      try {
        const r = runOffline(app.world, { now_utc: Date.now(), saved_at_utc: Date.now() - gap })
        if (r.summary) app.note('ⓘ 자리를 비운 동안의 일을 정리했습니다')
      } catch (e) { console.error('[텝] 실행 중 정산 실패', e) }
      void saver.request({ backup: true })
    }
    const dt = Math.min(cap, Math.max(0, gap))
    last = now
    const view = app.step(now, dt, dark.matches)
    afterStep(now)
    return view
  }
  setInterval(() => { if (document.hidden) advance(performance.now(), 1000) }, 1000)
  const frame = (now: number): void => {
    const view = advance(now, 250) // 숨김에서 돌아왔을 때 한꺼번에 흘리지 않는다
    if (!drawDue(now, lastDraw)) {
      requestAnimationFrame(frame)
      return
    }
    lastDraw = now
    renderer.draw(view)
    panel.update(view)
    overlay.update(view.strip, view.bubble, view.heroCx, showStrip, showBubble)
    const ch = app.world.state.character
    pause.textContent = app.driver.paused ? '다시 진행' : '일시정지'
    info.textContent = ch
      ? `${ch.generation}대 · 유효 진행 ${ch.eff_min.toFixed(1)}분 · ${ageAt(ch.eff_min, content.balance.time)}세 · ${app.world.state.current_activity.state} · ×${app.driver.speed} · 대기열 ${app.lines.pending.length} · dpr ${devicePixelRatio} · 그림 ×${canvas.dataset.k}`
      : '인물 없음'
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  fitNativeWindow()
}

// 데스크톱 exe(Tauri)에서는 창 크기를 내용에 맞춘다: 빈 영역을 남기지 않고, 상세 창을 열면 늘고 닫으면 줄어든다
function fitNativeWindow(): void {
  const tauri = (globalThis as { __TAURI__?: { window: { getCurrentWindow(): { setSize(s: unknown): Promise<void> } }; dpi: { LogicalSize: new (w: number, h: number) => unknown } } }).__TAURI__
  if (!tauri) return
  const root = document.getElementById('app')!
  const margin = 16 // body 여백(index.html)
  let last = ''
  new ResizeObserver(() => {
    const r = root.getBoundingClientRect()
    const w = Math.ceil(r.width) + margin * 2
    const h = Math.ceil(r.height) + margin * 2
    if (`${w}x${h}` === last) return
    last = `${w}x${h}`
    void tauri.window.getCurrentWindow().setSize(new tauri.dpi.LogicalSize(w, h)).catch(() => { /* 권한이 없으면 그대로 */ })
  }).observe(root)
}

start().catch((e: unknown) => {
  document.body.append(`시작하지 못했다: ${e instanceof Error ? e.message : String(e)}`)
  console.error(e)
})
