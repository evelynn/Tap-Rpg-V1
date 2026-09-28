// 이벤트 장면(15 §9.3, D63): 사건의 한 줄 기록이 처음 보일 때부터 최대 8초, 그사이 새 한 줄 기록이 오면 그때까지
// 풍경 x 48~175에 128 × 64 4프레임 장면을 그리고(밖은 어둡게), 주인공을 표의 x(장면 판 기준 인물 가로 중심)와 동작으로 얹는다.
import type { Motion } from './sprites'

export interface SceneRow {
  scene: string
  hero: { x: number; motion: Motion } | null // null = 주인공을 얹지 않는다(ES15)
  hold: boolean // 끝 유지: 4프레임째에서 멈춘다
}

export const SCENE_FRAME_MS = 250
export const SCENE_FRAMES = 4
export const SCENE_MAX_MS = 8000

// 15 §9.3 표(사건 id → 장면). 사건 데이터에 scene 칸이 아직 없어 표를 옮겨 둔다
export const SCENES: Record<string, SceneRow> = {
  L09: { scene: 'ES01', hero: { x: 24, motion: 'sit_eat' }, hold: false },
  L23: { scene: 'ES02', hero: { x: 30, motion: 'cheer' }, hold: false },
  'C01-1': { scene: 'ES03', hero: { x: 28, motion: 'interact' }, hold: false },
  'C01-2': { scene: 'ES04', hero: { x: 30, motion: 'idle' }, hold: false },
  'C01-3': { scene: 'ES05', hero: { x: 24, motion: 'discover' }, hold: false },
  'C02-1': { scene: 'ES06', hero: { x: 28, motion: 'discover' }, hold: false },
  'C02-2': { scene: 'ES07', hero: { x: 20, motion: 'walk' }, hold: false },
  'C02-3': { scene: 'ES08', hero: { x: 34, motion: 'interact' }, hold: false },
  F01: { scene: 'ES09', hero: { x: 30, motion: 'idle' }, hold: true },
  F02: { scene: 'ES10', hero: { x: 22, motion: 'discover' }, hold: false },
  F03: { scene: 'ES11', hero: { x: 26, motion: 'idle' }, hold: false },
  S01: { scene: 'ES12', hero: { x: 40, motion: 'idle' }, hold: false },
  S02: { scene: 'ES13', hero: { x: 36, motion: 'cheer' }, hold: false },
  S03: { scene: 'ES14', hero: { x: 30, motion: 'idle' }, hold: false },
  S04: { scene: 'ES15', hero: null, hold: true },
  S05: { scene: 'ES16', hero: { x: 30, motion: 'wait_book' }, hold: false },
  S06: { scene: 'ES17', hero: { x: 32, motion: 'interact' }, hold: false },
  S07: { scene: 'ES18', hero: { x: 30, motion: 'interact' }, hold: false },
  S08: { scene: 'ES19', hero: { x: 34, motion: 'sleep' }, hold: true },
  // ES20(EB03 부서진 종의 파수꾼 관문 첫 격파): 사건이 아니라 전투 기록이라 앱이 그 기록에 이 키를 단다(app.ts GATE_SCENE)
  EB03_first: { scene: 'ES20', hero: { x: 30, motion: 'cheer' }, hold: false },
}

export function sceneFor(eventId: string | undefined, available: ReadonlySet<string>): SceneRow | null {
  const row = eventId ? SCENES[eventId] : undefined
  return row && available.has(row.scene) ? row : null
}

// 반복 장면은 250ms × 4 주기, 끝 유지 장면은 4프레임째에서 멈춘다
export function sceneFrame(row: SceneRow, elapsedMs: number): number {
  const f = Math.floor(elapsedMs / SCENE_FRAME_MS)
  return row.hold ? Math.min(f, SCENE_FRAMES - 1) : f % SCENE_FRAMES
}

export interface ActiveScene {
  row: SceneRow
  startedAt: number
}

// 한 줄 기록이 바뀔 때마다 부른다. 같은 장면의 기록이 이어지면 처음 시각을 그대로 둔다
export class SceneTracker {
  active: ActiveScene | null = null

  constructor(private readonly available: ReadonlySet<string>) {}

  onLine(eventId: string | undefined, now: number): void {
    const row = sceneFor(eventId, this.available)
    if (!row) this.active = null
    else if (this.active?.row.scene !== row.scene || now - this.active.startedAt >= SCENE_MAX_MS) this.active = { row, startedAt: now }
  }

  at(now: number): { row: SceneRow; frame: number } | null {
    if (!this.active || now - this.active.startedAt >= SCENE_MAX_MS) return null
    return { row: this.active.row, frame: sceneFrame(this.active.row, now - this.active.startedAt) }
  }
}
