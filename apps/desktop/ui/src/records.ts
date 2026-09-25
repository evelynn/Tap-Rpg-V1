// 한 줄 기록 교체(03 §2.5, 14 §2): 최소 4초, A 등급([중요]·[사망]·[은퇴]·[계승])은 8초.
// 대기열 최대 5개. A는 맨 앞에 끼어들고 B는 C·D보다 앞선다. 넘치면 등급이 낮고 오래된 기록부터 뺀다(일지에는 모두 남는다).
// 새 기록이 없으면 마지막 기록을 계속 보인다

export type Grade = 'A' | 'B' | 'C' | 'D'

export interface LineItem {
  id: number
  text: string
  grade: Grade
  eventId?: string
}

export interface LineRules {
  minSec: number // balance.ui.line_min_sec
  importantSec: number // balance.ui.important_line_sec
  queueMax: number // balance.ui.line_queue_max
}

const RANK: Record<Grade, number> = { A: 0, B: 1, C: 2, D: 3 }

export class LineQueue {
  current: LineItem | null = null
  shownAt = 0
  readonly pending: LineItem[] = []

  constructor(private readonly rules: LineRules) {}

  holdMs(item: LineItem): number {
    return (item.grade === 'A' ? this.rules.importantSec : this.rules.minSec) * 1000
  }

  push(item: LineItem): void {
    // A는 앞선 A 뒤, B는 C·D 앞, C·D는 맨 뒤
    const at = item.grade === 'A' || item.grade === 'B'
      ? this.pending.findIndex((p) => RANK[p.grade] > RANK[item.grade])
      : -1
    if (at < 0) this.pending.push(item)
    else this.pending.splice(at, 0, item)
    while (this.pending.length > this.rules.queueMax) this.dropOne()
  }

  // 표시 중인 기록이 없거나 표시 시간이 다 찼고, 기다리는 기록이 있으면 바꾼다. 바뀌었으면 true
  update(now: number): boolean {
    if (this.current && now - this.shownAt < this.holdMs(this.current)) return false
    if (this.pending.length === 0) return false
    this.next(now)
    return true
  }

  private next(now: number): void {
    this.current = this.pending.shift() ?? null
    this.shownAt = now
  }

  // 가장 낮은 등급 중 가장 오래된(id가 작은) 기록을 뺀다
  private dropOne(): void {
    let worst = 0
    for (let i = 1; i < this.pending.length; i++) {
      const a = this.pending[i]!
      const b = this.pending[worst]!
      if (RANK[a.grade] > RANK[b.grade] || (RANK[a.grade] === RANK[b.grade] && a.id < b.id)) worst = i
    }
    this.pending.splice(worst, 1)
  }
}
