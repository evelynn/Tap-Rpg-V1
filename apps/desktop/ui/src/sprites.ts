// 스프라이트 시트 규격과 동작 클립(15 §4·§7.1). 시트는 assets/ready 합성 시트다(README 표의 행·프레임 순서).
// 칸 번호는 시트 격자를 왼쪽 위부터 가로로 센 순번이다.

export interface Sheet {
  file: string // assets/ready/{file}.png
  w: number // 칸 폭
  h: number // 칸 높이
  cols: number
  footY: number // 칸 안 발바닥 기준선 y
  centerX: number // 칸 안 가로 중심 x
}

export interface Clip {
  sheet: string
  cells: readonly number[]
  ms: readonly number[]
  loop: boolean
  hold?: boolean // 1회 재생 뒤 마지막 프레임 유지(쓰러짐·퇴장·끝 유지 장면)
}

// 캐릭터 48 규격: 발바닥 y 44, 가로 중심 x 23(15 §1.1). 적은 칸 아래 여백이 4라 발바닥이 h - 4다(합격 그림 bbox 실측)
const chr = (file: string): Sheet => ({ file, w: 48, h: 48, cols: 6, footY: 44, centerX: 23 })
const enm = (file: string, w: number, h: number): Sheet => ({ file, w, h, cols: 4, footY: h - 4, centerX: w / 2 })

export const SHEETS: Record<string, Sheet> = {
  chr18: chr('chr_actions18_48'),
  chr11: chr('chr_actions11_48'),
  chr9: chr('chr_actions9_48'),
  walk: chr('chr_walk12_48'),
  rat: enm('enm_rat_48', 32, 24),
  wolf: enm('enm_wolf_48', 48, 32),
  bat: enm('enm_bat_48', 32, 32),
  kobold: enm('enm_kobold_48', 32, 48),
}

// 배경 띠·장면(흐르지 않는 한 장 또는 4프레임 가로 띠)
export const STRIPS = {
  bg: 'bg_h1_summer_day',
  ES01: 'es01_stranger_campfire',
  ES15: 'es15_end_of_life',
  ES18: 'es18_parent_letter',
} as const

export const MOTIONS = ['idle', 'walk', 'attack', 'hit', 'discover', 'sit_eat', 'sleep', 'interact', 'cheer', 'collapse', 'wait_book'] as const
export type Motion = (typeof MOTIONS)[number]

const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i)

// 15 §4 표의 프레임 시간
export const HERO_CLIPS: Record<Motion, Clip> = {
  idle: { sheet: 'chr18', cells: range(0, 4), ms: [220, 220, 220, 220], loop: true },
  attack: { sheet: 'chr18', cells: range(6, 6), ms: [100, 80, 60, 60, 120, 160], loop: false },
  sit_eat: { sheet: 'chr18', cells: range(12, 4), ms: [300, 300, 300, 300], loop: true },
  sleep: { sheet: 'chr18', cells: range(18, 4), ms: [450, 450, 450, 450], loop: true },
  hit: { sheet: 'chr11', cells: range(0, 3), ms: [70, 120, 160], loop: false },
  discover: { sheet: 'chr11', cells: range(6, 4), ms: [120, 120, 200, 400], loop: false },
  interact: { sheet: 'chr11', cells: range(12, 4), ms: [150, 150, 150, 250], loop: true },
  cheer: { sheet: 'chr9', cells: range(0, 4), ms: [120, 120, 180, 400], loop: false },
  collapse: { sheet: 'chr9', cells: range(6, 5), ms: [100, 120, 140, 200, 200], loop: false, hold: true },
  // 걷기 12칸 중 재생 6칸은 1·2·4·7·8·10번(assets/ready/README)
  walk: { sheet: 'walk', cells: [0, 1, 3, 6, 7, 9], ms: [110, 110, 110, 110, 110, 110], loop: true },
  // 선택 대기: 앉은 자세 1·3프레임, 4초마다 한 장(15 §4). 책 소품은 아직 없다
  wait_book: { sheet: 'chr18', cells: [12, 14], ms: [4000, 4000], loop: true },
}

export const ENEMY_MOTIONS = ['idle', 'move', 'attack', 'hit', 'exit'] as const
export type EnemyMotion = (typeof ENEMY_MOTIONS)[number]

// 15 §7.1. 박쥐 퇴장 4번째 칸은 빠져 있다(README 알려진 한계)
export function enemyClips(family: string): Record<EnemyMotion, Clip> {
  return {
    idle: { sheet: family, cells: range(0, 4), ms: [200, 200, 200, 200], loop: true },
    move: { sheet: family, cells: range(4, 4), ms: [120, 120, 120, 120], loop: true },
    attack: { sheet: family, cells: range(8, 4), ms: [100, 80, 100, 160], loop: false },
    hit: { sheet: family, cells: range(12, 2), ms: [70, 150], loop: false },
    exit: family === 'bat'
      ? { sheet: family, cells: range(16, 3), ms: [120, 120, 120], loop: false, hold: true }
      : { sheet: family, cells: range(16, 4), ms: [120, 120, 120, 120], loop: false, hold: true },
  }
}

// 시트가 있는 적 계열. 없는 계열은 가까운 계열로 대신 그린다
const FAMILY_FALLBACK: Record<string, string> = {
  bellwarden: 'kobold', // TODO EB03 부서진 종의 파수꾼 시트(15 §7.3)가 들어오면 뺀다
}

export function spriteFamily(family: string): string {
  if (['rat', 'wolf', 'bat', 'kobold'].includes(family)) return family
  return FAMILY_FALLBACK[family] ?? 'rat' // TODO 새 계열 시트
}

export interface Rect { sx: number; sy: number; w: number; h: number }

// 칸 번호 → 시트 안 사각형
export function cellRect(sheet: Sheet, cell: number): Rect {
  return { sx: (cell % sheet.cols) * sheet.w, sy: Math.floor(cell / sheet.cols) * sheet.h, w: sheet.w, h: sheet.h }
}
