// 세계 구동: 실시간 × 배속만큼 유효 진행 시간을 흘리고 새 기록을 돌려준다.
// 운명 선택 창·계승 화면이 아직 없어 선택 대기·계승 대기는 잠시 보여 준 뒤 자동으로 처리한다(시제품 한정).
import { pendingSuccession, submitPendingAuto, succeed, type JournalEntry, type World } from '@tap/core'

export const SPEEDS = [1, 10, 60, 600] as const
export const AUTO_WAIT_MS = 8000 // 선택·계승 대기 표시(×1 기준, 배속만큼 짧아진다)
const MIN_WAIT_MS = 300
const CHUNK_SEC = 60 // advance 한 번에 흘리는 최대 유효 진행 초

export class Driver {
  speed = 1
  private waitMs = 0
  private lastId = 0

  constructor(readonly world: World) {}

  get paused(): boolean {
    return this.world.state.current_activity.state === 'paused'
  }

  setPaused(on: boolean): void {
    if (on) this.world.pause()
    else this.world.resume()
  }

  // dtMs 실시간만큼 진행한다
  tick(dtMs: number): JournalEntry[] {
    const w = this.world
    if (this.paused) return []
    if (w.state.pending_choice || w.state.current_activity.state === 'awaiting_succession') {
      this.waitMs += dtMs
      if (this.waitMs >= Math.max(MIN_WAIT_MS, AUTO_WAIT_MS / this.speed)) {
        this.waitMs = 0
        if (w.state.pending_choice) submitPendingAuto(w)
        else if (pendingSuccession(w)) succeed(w)
      }
      return this.fresh()
    }
    this.waitMs = 0
    let left = (dtMs / 1000) * this.speed
    while (left > 0 && w.clockRunning) {
      const step = Math.min(CHUNK_SEC, left)
      const moved = w.advance(step)
      left -= step
      if (moved < step) break
    }
    return this.fresh()
  }

  // 새 기록(id는 가문 전체 일련번호라 커지기만 한다)
  private fresh(): JournalEntry[] {
    const out = this.world.state.journal.filter((e) => e.id > this.lastId).sort((a, b) => a.id - b.id)
    if (out.length) this.lastId = out[out.length - 1]!.id
    return out
  }
}
