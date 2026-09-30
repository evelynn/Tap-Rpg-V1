// 기본 창 768 × 128 배치(03 §2.2, D75·D84)와 픽셀 그림 정수 배율(03 §14). DOM 없이 계산만 한다.
// 기준은 Windows 표시 배율 100%(devicePixelRatio 1): 논리 1픽셀 = 화면 1픽셀, 그림은 배율 없이 1:1로 그린다.

export const WIN = { w: 768, h: 128 } // 기본 너비·높이(너비는 D82로 조절, 높이는 원본 도트 배경이 잘리지 않게 128, D84)
export const LAND = { x: 0, w: 496 } // 인물 무리 구역(캐릭터·적·장면). 배경 띠는 창 전체 폭에 그린다(D91)
export const COL = { x: 496, w: 272 } // 상태 칩 구역(D91): 오른쪽 아래 반투명 칩이 놓이는 자리. 불투명 판은 없다
// 지면 기준선(D84): 띠를 창 아래에 붙이고, 지면은 띠 높이의 56/64 지점 → 창 y = 128 − round(띠 높이 / 8)
export const groundOf = (stripH: number): number => WIN.h - Math.round(stripH / 8)
export const STRIP_W = 256 // 배경 띠 한 장 폭. 풍경 496을 가로로 이어 채운다
export const SCENE_W = 128 // 이벤트 장면·패널 자리 폭. 장면 표의 x는 이 판 기준(24 → 주인공 자리)

// 기본 창 너비(03 §2.8, D82): 528~1536, 기본 768. 칩 구역 272는 오른쪽에 붙고 인물 무리 구역만 바뀐다
export const WIDTH = { min: 528, max: 1536, def: 768 } as const
export function windowWidth(v: unknown): number {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && v !== null && v !== '' ? Math.min(WIDTH.max, Math.max(WIDTH.min, n)) : WIDTH.def
}

// 인물 무리·장면 판은 풍경 가운데(03 §2.2, D82): 판 x P = round(L/2) − 64, 주인공 P + 24, 적 P + 120
export interface Stage { landW: number; sceneX: number; heroCx: number; enemyCx: number }
// colW: 칩 구역 폭(글자 배율 100/125/150%면 272/340/408, 03 §14)
export function stageOf(width: number, colW: number = COL.w): Stage {
  const landW = width - colW
  const sceneX = Math.round(landW / 2) - SCENE_W / 2
  return { landW, sceneX, heroCx: sceneX + 24, enemyCx: sceneX + 120 }
}

// 상태 칩(D91) 안 글자: 칩은 창 오른쪽 아래(여백 4)에 글자 폭만큼, 안쪽 여백 가로 5·세로 3. 작은 글자 2줄
export const TEXT = {
  x: COL.x + 5, // 501
  w: COL.w - 10, // 262
  font: 11, // 글자 크기(px, 100%)
  lineH: 13,
  row1: { y: 95 }, // 1줄: 상태 기호·이름·나이·상태·조건어(굵게, 왼쪽) + 아이콘·표식(오른쪽 끝)
  row2: { y: 108 }, // 2줄: 한 줄 기록 한 줄(접지 않는다)
  icons: { size: 12, gap: 2, markGap: 4, w: 70 }, // 아이콘 최대 4칸(간격 2) + 4 + 표식 하나(대기 중이면 두루마리·책, 아니면 태도 첫 글자)
  statusW: 175, // 1줄 글자 자리(가장 긴 이름·조건어). 175 + 사이 3 + 아이콘·표식 70 ≤ 262
}
// 상태 칩 사각형(D91, 화면 배율 100% 논리 픽셀). textW: 두 줄 가운데 넓은 쪽 글자 폭, lines: 기록이 비면 1, t: 글자 배율.
// 글자가 가장 길어도(262·t) 칩 왼쪽 끝이 장면 판 오른쪽 끝보다 오른쪽이라 인물 무리를 가리지 않는다
export const CHIP = { margin: 4, padX: 5, padY: 3 }
export function chipRect(width: number, textW: number, t = 1, lines: 1 | 2 = 2): { x: number; y: number; w: number; h: number } {
  const w = Math.ceil(Math.min(textW, TEXT.w * t) + 2 * CHIP.padX * t)
  const h = Math.ceil((lines * TEXT.lineH + 2 * CHIP.padY) * t)
  return { x: width - CHIP.margin - w, y: WIN.h - CHIP.margin - h, w, h }
}
export const FONT_FAMILY = 'system-ui, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif'

// 그리기 상한(01 §16, 03 §10, D76): 보일 때 초당 최대 30번. 화면 주사율이 60이면 두 번에 한 번 그린다.
// 1ms 여유는 주사 간격 떨림(16.6 ± 0.x) 때문에 두 간격(33.3)이 30번 경계에 걸려 한 번 더 건너뛰지 않게 한다
export const DRAW_MIN_MS = 1000 / 30 - 1

export function drawDue(now: number, lastDraw: number): boolean {
  return now - lastDraw >= DRAW_MIN_MS
}

// 화면 배율(03 §7·§14, D81): 기본 창 전체(그림·글자 칸)를 정수배로 키운다. 그 밖의 값은 100%
export const WINDOW_SCALES = [1, 2, 3] as const
export type WindowScale = (typeof WINDOW_SCALES)[number]
export function windowScale(v: unknown): WindowScale {
  const n = Number(v)
  return (WINDOW_SCALES as readonly number[]).includes(n) ? (n as WindowScale) : 1
}

// 그림 정수 배율 k: 표시 배율 × 화면 배율을 아래로 내린 정수. 1 미만은 1
export function artScale(dpr: number, userScale = 1): number {
  return Math.max(1, Math.floor(dpr * userScale + 1e-9))
}

export interface Surface {
  k: number // 그림 정수 배율
  devW: number // 캔버스 기억 크기(장치 픽셀)
  devH: number
  cssW: number // 캔버스 CSS 크기 = 장치 크기 / dpr(브라우저가 다시 늘이거나 줄이지 않는다)
  cssH: number
  artY: number // 그림 윗변(장치 픽셀). 남는 높이는 비워 두고(투명, D91) 지면은 창 아래에 붙는다
  logicalW: number // 그림을 채울 논리 폭. 창이 768·k보다 넓으면 배경을 더 이어 그린다(늘이지 않는다)
}

// width: 기본 창 너비(D82, 100% 기준 논리 픽셀)
export function surface(dpr: number, userScale = 1, width: number = WIN.w): Surface {
  const k = artScale(dpr, userScale)
  const devW = Math.round(width * userScale * dpr)
  const devH = Math.round(WIN.h * userScale * dpr)
  return { k, devW, devH, cssW: devW / dpr, cssH: devH / dpr, artY: devH - WIN.h * k, logicalW: Math.ceil(devW / k) }
}
