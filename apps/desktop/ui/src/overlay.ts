// 기록 띠와 말풍선(03 §2.7, D82): 일지를 열지 않아도 최근 일이 기본 창 위에 보인다.
// 계산(stripView·bubbleWorthy·BubbleQueue)은 DOM 없이 돌고, Overlay가 두 칸을 그린다.
import type { JournalEntry, World } from '@tap/core'
import { TAG_LABEL } from './detail/model'

export interface StripView { rows: { id: number; text: string }[]; detail: string }
export interface BubbleItem { id: number; line: string; detail: string }

export const STRIP_ROWS = 3
export const BUBBLE = { holdMs: 8000, minMs: 4000, queueMax: 3 } as const

// 위 3줄: 최근 기록(오래된 것 위), 아래: 가장 새 기록의 상세 문장
export function stripView(world: World): StripView {
  const recent = world.state.journal.slice(-STRIP_ROWS)
  return {
    rows: recent.map((e) => ({ id: e.id, text: `${e.age}세 [${TAG_LABEL[e.tag] ?? e.tag}] ${e.line}` })),
    detail: recent.at(-1)?.detail ?? '',
  }
}

// 말풍선에 띄울 기록: 중요 기록, 운명·연속 사건 결과, 희귀 이상 장비, 세대 교대
export function bubbleWorthy(e: Pick<JournalEntry, 'tag' | 'sub' | 'importance' | 'refs'>, eventCategory?: string): boolean {
  // last_chapter는 생애 끝 무렵 평범한 기록에도 붙어 대상에서 뺀다
  if (e.importance === 'major' || e.importance === 'family') return true
  if (eventCategory === 'fate' || eventCategory === 'chain') return true
  if (e.tag === 'gear' && e.sub === 'rare_gain') return true
  return e.tag === 'retire' || e.tag === 'death' || e.tag === 'succession'
}

// 8초 보이고, 기다리는 것은 최대 3개(넘치면 오래된 것부터 뺀다). 앞 것이 4초 이상 보였으면 다음 것으로 바꾼다
export class BubbleQueue {
  current: BubbleItem | null = null
  shownAt = 0
  readonly pending: BubbleItem[] = []

  push(item: BubbleItem): void {
    this.pending.push(item)
    while (this.pending.length > BUBBLE.queueMax) this.pending.shift()
  }

  update(now: number): void {
    if (this.current && now - this.shownAt >= BUBBLE.holdMs) this.current = null
    const due = !this.current || now - this.shownAt >= BUBBLE.minMs
    if (due && this.pending.length) {
      this.current = this.pending.shift()!
      this.shownAt = now
    }
  }
}

// 두 칸 그리기. 바뀐 것만 다시 쓴다
export class Overlay {
  private last = { strip: '', bubble: -1, cx: -1 }

  constructor(private readonly strip: HTMLElement, private readonly bubble: HTMLElement) {}

  update(sv: StripView, b: BubbleItem | null, heroCx: number, showStrip: boolean, showBubble: boolean): void {
    this.strip.hidden = !showStrip
    const key = JSON.stringify(sv)
    if (showStrip && key !== this.last.strip) {
      this.strip.replaceChildren(
        ...sv.rows.map((r) => Object.assign(document.createElement('div'), { className: 'row', textContent: r.text })),
        Object.assign(document.createElement('div'), { className: 'detail', textContent: sv.detail }),
      )
      this.last.strip = key
    }
    const shown = showBubble ? b : null
    this.bubble.hidden = !shown
    if (shown && (shown.id !== this.last.bubble || heroCx !== this.last.cx)) {
      const line = Object.assign(document.createElement('div'), { className: 'line', textContent: shown.line })
      this.bubble.replaceChildren(line, ...(shown.detail ? [Object.assign(document.createElement('div'), { className: 'detail', textContent: shown.detail })] : []))
      this.bubble.style.setProperty('--cx', String(heroCx))
      this.last.bubble = shown.id
      this.last.cx = heroCx
    }
  }
}
