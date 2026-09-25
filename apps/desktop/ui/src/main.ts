// 브라우저 진입점: 번들 읽기 → 세계 만들기 → 실시간 구동·그리기. Tauri 2 껍데기도 이 dist를 그대로 싣는다(파일 시스템을 쓰지 않는다).
import { Content, ageAt, createGameWorld, type World } from '@tap/core'
import { App } from './app'
import { SPEEDS } from './driver'
import { surface } from './layout'
import { Panel } from './panel'
import { Renderer, type Images } from './render'
import { SHEETS, STRIPS } from './sprites'

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

// 주소 인자: ?name=모라&family=모래&seed=16진16자리&scale=1(개발용 정수 확대, 기본 1 = 100%)&grid=1(선명도 확인 격자)
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
  const u = Math.max(1, Math.floor(Number(q.get('scale') ?? 1)) || 1) // 개발용 확대는 정수배만. 기본 1 = 100%(D75)
  const grid = q.get('grid') === '1'
  const content = Content.fromBundle(await (await fetch('content.json')).json())

  const files = [...new Set([...Object.values(SHEETS).map((s) => s.file), ...Object.values(STRIPS)])]
  const loaded = await Promise.all(files.map((f) => loadImage(`sprites/${f}.png`)))
  const images: Images = Object.fromEntries(files.map((f, i) => [f, loaded[i]]))
  const sceneFiles = Object.fromEntries(Object.entries(STRIPS).filter(([k, f]) => k !== 'bg' && images[f]))
  const app = new App(newWorld(content, q), sceneFiles)
  ;(globalThis as { tapApp?: App }).tapApp = app // 개발용: 콘솔에서 세계·대기열을 들여다본다

  const win = document.getElementById('win')!
  win.style.setProperty('--u', String(u))
  const canvas = document.getElementById('art') as HTMLCanvasElement
  const panel = new Panel(document.getElementById('col')!, u)
  const scratch = document.createElement('canvas')
  scratch.width = 64
  scratch.height = 64
  // 캔버스 기억 크기 = 장치 픽셀, CSS 크기 = 장치 크기 / dpr. 표시 배율(dpr)이 바뀌면(다른 모니터, 확대) 다시 맞춘다
  let renderer!: Renderer
  const fit = (): void => {
    const s = surface(devicePixelRatio || 1, u)
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

  let last = performance.now()
  const frame = (now: number): void => {
    const dt = Math.min(250, Math.max(0, now - last)) // 백그라운드 탭에서 돌아왔을 때 한꺼번에 흘리지 않는다
    last = now
    const view = app.step(now, dt, dark.matches)
    renderer.draw(view)
    panel.update(view)
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
