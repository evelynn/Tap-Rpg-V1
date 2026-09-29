// 소품 연출(03 §15, 15 §9.2, D76·D89): 판정 주사위와 떨어진 꾸러미. 그림은 v07 codex 소품(sprites.ts PROPS).
import type { JournalEntry } from '@tap/core'
import type { PROPS } from './sprites'

export interface PropDraw {
  prop: keyof typeof PROPS
  cell: number
  cx: number // 창 좌표 가로 중심
  dy: number // 칸 위쪽 = 지면 + dy(위가 음수)
}

export const DICE_SPIN_MS = 90 // 굴림 2프레임 90ms
export const DICE_ROLL_MS = 720 // 4번(0.72초)
export const DICE_FACE_MS = 1300 // 결과 면 1.3초
// 주사위 칸 위쪽: 주인공 머리(지면 − 40) 위 4, 그림 아래끝이 칸 21행이라 − 44 − 21
export const DICE_DY = -65
// 꾸러미 칸 위쪽: 그림 아래끝(칸 20행)이 지면에 닿게
export const BUNDLE_DY = -21
const OK = new Set(['crit_success', 'success', 'partial'])

// 최후 판정과 운명·연속 사건(사건 id F·C) 판정에서만(03 §15). 일반 전투·일상 판정은 쓰지 않는다
export function diceWorthy(e: Pick<JournalEntry, 'check' | 'sub' | 'refs'>): boolean {
  return !!e.check && (e.sub === 'final_check' || /^[FC]/.test(e.refs?.event_id ?? ''))
}

// 굴림(칸 0·1 번갈아) → 결과 면(성공·부분 성공 = 밝은 면 2, 실패 = 금 간 면 3) → 사라짐(null)
export function diceCell(elapsed: number, ok: boolean, reduced = false): number | null {
  if (elapsed < 0 || elapsed >= DICE_ROLL_MS + DICE_FACE_MS) return null
  if (elapsed < DICE_ROLL_MS && !reduced) return Math.floor(elapsed / DICE_SPIN_MS) % 2
  return ok ? 2 : 3
}

export class DiceTracker {
  private cur: { start: number; ok: boolean } | null = null

  push(e: Pick<JournalEntry, 'check' | 'sub' | 'refs'>, now: number): void {
    if (diceWorthy(e)) this.cur = { start: now, ok: OK.has(e.check!.result) }
  }

  cell(now: number, reduced = false): number | null {
    if (!this.cur) return null
    const c = diceCell(now - this.cur.start, this.cur.ok, reduced)
    if (c === null) this.cur = null
    return c
  }
}

// 꾸러미: 떨어짐(칸 0) 200ms 뒤 놓임(칸 1)
export const bundleCell = (elapsed: number): number => (elapsed < 200 ? 0 : 1)
