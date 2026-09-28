// 기본 창 768 × 64 배치(03 §2.2, D75)와 픽셀 그림 정수 배율(03 §14). DOM 없이 계산만 한다.
// 기준은 Windows 표시 배율 100%(devicePixelRatio 1): 논리 1픽셀 = 화면 1픽셀, 그림은 배율 없이 1:1로 그린다.

export const WIN = { w: 768, h: 64 }
export const LAND = { x: 0, w: 496 } // 풍경(배경·캐릭터·적·장면)
export const COL = { x: 496, w: 272 } // 글자 칸(88% 판 위 DOM 글자)
export const GROUND_Y = 56
export const STRIP_W = 256 // 배경 띠 한 장 폭. 풍경 496을 가로로 이어 채운다
export const HERO_CX = 72 // 주인공 가로 중심
export const ENEMY_CX = 168 // 적 가로 중심(왼쪽을 봄)
export const SCENE = { x: 48, w: 128 } // 이벤트 장면·패널 자리. 장면 표의 x는 이 판 기준(24 → 창 72)

// 글자 칸 안쪽: 왼쪽 5는 풍경에서 판으로 넘어가는 그라데이션, 오른쪽 5는 여백. 작은 글자 2줄을 세로 가운데(위아래 17)에 둔다
export const TEXT = {
  x: COL.x + 5, // 501
  w: COL.w - 10, // 262
  font: 11, // 글자 크기(px, 100%)
  lineH: 13,
  row1: { y: 17 }, // 1줄: 이름·나이·상태·조건어(굵게, 왼쪽) + 아이콘·표식(오른쪽 끝)
  row2: { y: 34 }, // 2줄: 한 줄 기록 한 줄(접지 않는다)
  icons: { size: 12, gap: 2, markGap: 4, w: 84 }, // 아이콘 4칸(간격 2) + 4 + 중요 표식 + 2 + 태도 표식
  statusW: 175, // 1줄 글자 자리 = 262 − 아이콘·표식 84 − 사이 3
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
  artY: number // 그림 윗변(장치 픽셀). 남는 높이는 위쪽 하늘로 채우고 지면은 창 아래에 붙는다
  logicalW: number // 그림을 채울 논리 폭. 창이 768·k보다 넓으면 배경을 더 이어 그린다(늘이지 않는다)
}

export function surface(dpr: number, userScale = 1): Surface {
  const k = artScale(dpr, userScale)
  const devW = Math.round(WIN.w * userScale * dpr)
  const devH = Math.round(WIN.h * userScale * dpr)
  return { k, devW, devH, cssW: devW / dpr, cssH: devH / dpr, artY: devH - WIN.h * k, logicalW: Math.ceil(devW / k) }
}
