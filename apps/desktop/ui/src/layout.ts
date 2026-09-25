// 기본 창 768 × 64 배치(03 §2.2, D75)와 픽셀 그림 정수 배율(03 §14). DOM 없이 계산만 한다.
// 기준은 Windows 표시 배율 100%(devicePixelRatio 1): 논리 1픽셀 = 화면 1픽셀, 그림은 배율 없이 1:1로 그린다.

export const WIN = { w: 768, h: 64 }
export const LAND = { x: 0, w: 576 } // 풍경(배경·캐릭터·적·장면)
export const COL = { x: 576, w: 192 } // 글자 칸(88% 판 위 DOM 글자)
export const GROUND_Y = 56
export const STRIP_W = 256 // 배경 띠 한 장 폭. 풍경 576을 가로로 이어 채운다
export const HERO_CX = 72 // 주인공 가로 중심
export const ENEMY_CX = 168 // 적 가로 중심(왼쪽을 봄)
export const SCENE = { x: 48, w: 128 } // 이벤트 장면·패널 자리. 장면 표의 x는 이 판 기준(24 → 창 72)

// 글자 칸 안쪽: 왼쪽 6은 풍경에서 판으로 넘어가는 그라데이션, 오른쪽 4는 여백
export const TEXT = {
  x: COL.x + 6,
  w: COL.w - 10, // 182
  font: 11, // 글자 크기(px, 100%)
  lineH: 13,
  status: { y: 2 }, // 1줄: 이름·나이·상태·조건어(굵게)
  icons: { y: 17, size: 12, gap: 3 }, // 상태 아이콘 4칸 + 표식
  record: { y: 32, lines: 2 }, // 한 줄 기록: 칸 폭을 넘으면 2줄로 접는다(자르지 않는다)
}
export const FONT_FAMILY = 'system-ui, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif'

// 그림 정수 배율 k: 표시 배율 × 개발용 확대를 아래로 내린 정수. 1 미만은 1
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

// 한 줄 기록을 폭 안에 맞춘다. 어절(띄어쓰기) 단위로 접고, maxLines를 넘으면 글자 단위로 다시 접는다.
// 11px 한글 한 자 = 11px(Chromium 실측)이라 28자(약 257px)는 182px 한 줄에 들어가지 않는다. 글자 단위 2줄은
// 줄마다 16자 이상 담아 28자를 늘 담는다
export function fitLines(text: string, maxW: number, measure: (s: string) => number, maxLines = 2): string[] {
  if (measure(text) <= maxW) return [text]
  const byWord = wrap(text.split(' '), ' ', maxW, measure)
  if (byWord.length <= maxLines) return byWord
  return wrap([...text], '', maxW, measure).map((l) => l.trim())
}

function wrap(parts: string[], sep: string, maxW: number, measure: (s: string) => number): string[] {
  const out: string[] = []
  let cur = ''
  for (const p of parts) {
    const next = cur ? cur + sep + p : p
    if (!cur || measure(next) <= maxW) cur = next
    else {
      out.push(cur)
      cur = p
    }
  }
  if (cur) out.push(cur)
  // 한 어절이 폭보다 길면 그 줄만 글자 단위로 다시 접는다
  return out.flatMap((l) => (sep && measure(l) > maxW ? wrap([...l], '', maxW, measure) : [l]))
}
