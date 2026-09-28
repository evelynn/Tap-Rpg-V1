// 브라우저 진입점: 번들 읽기 → 세계 만들기 → 실시간 구동·그리기. Tauri 2 껍데기도 이 dist를 그대로 싣는다(파일 시스템을 쓰지 않는다).
import { Content, ageAt, createGameWorld, setAttitude, type World } from '@tap/core'
import { App } from './app'
import { attitudeNote } from './detail/model'
import { DetailWindow } from './detail/view'
import { SPEEDS } from './driver'
import { drawDue, surface } from './layout'
import { QuickMenu } from './menu'
import { Panel } from './panel'
import { Renderer, type Images } from './render'
import { BACKGROUNDS, SHEETS, STRIPS } from './sprites'

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

  const files = [...new Set([...Object.values(SHEETS).map((s) => s.file), ...Object.values(STRIPS), ...BACKGROUNDS])]
  const loaded = await Promise.all(files.map((f) => loadImage(`sprites/${f}.png`)))
  const images: Images = Object.fromEntries(files.map((f, i) => [f, loaded[i]]))
  const sceneFiles = Object.fromEntries(Object.entries(STRIPS).filter(([k, f]) => k !== 'bg' && images[f]))
  const app = new App(newWorld(content, q), sceneFiles, new Set(BACKGROUNDS.filter((f) => images[f])))
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

  // 상세 창(03 §5): 풍경·한 줄 기록 → 일지, 이름·상태 줄·아이콘 → 인물, 태도 표식 → 태도 빠른 메뉴(03 §2.6)
  const detail = new DetailWindow(document.getElementById('detail')!, app.world, (t) => app.note(t), () => app.driver.setPaused(!app.driver.paused))
  const menu = new QuickMenu(document.getElementById('menu')!)
  canvas.onclick = () => detail.show('일지')
  const col = document.getElementById('col')!
  col.addEventListener('click', (e) => {
    const t = e.target as HTMLElement
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
  setInterval(() => detail.render(), 1000) // 열려 있을 때만 다시 그린다

  // 진행은 매 프레임, 그리기는 초당 최대 30번(drawDue). 숨어 있으면 브라우저가 프레임을 멈추므로
  // 1초마다 진행만 한다(그리기 0, 03 §10·D76)
  let last = performance.now()
  let lastDraw = -Infinity
  const advance = (now: number, cap: number) => {
    const dt = Math.min(cap, Math.max(0, now - last))
    last = now
    return app.step(now, dt, dark.matches)
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
