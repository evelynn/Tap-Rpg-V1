// 동작 재생기(15 §4): 동작 전환은 현재 프레임이 끝나는 순간에만 하고, 1회 동작은 끝까지 재생한 뒤 넘어간다.
// 1회 동작을 다 본 뒤에도 같은 동작을 원하면 다시 틀지 않고 쉬는 동작(대기)으로 둔다. 원하는 동작이 바뀌면 다시 튼다
import type { Clip } from './sprites'

export class Animator<M extends string> {
  motion: M
  frame = 0
  done = false // 유지(hold) 동작이 마지막 프레임에 멈췄다
  private t = 0
  private want: M
  private spent: M | null = null // 방금 끝낸 1회 동작

  constructor(private readonly clips: Record<M, Clip>, start: M, private readonly rest: M) {
    this.motion = start
    this.want = start
  }

  get clip(): Clip {
    return this.clips[this.motion]
  }

  get cell(): number {
    return this.clip.cells[this.frame]!
  }

  request(m: M): void {
    if (m !== this.want) this.spent = null
    this.want = m
  }

  update(dtMs: number): void {
    this.t += dtMs
    for (let guard = 0; guard < 64; guard++) {
      const c = this.clip
      if (this.done) {
        if (this.want === this.motion) {
          this.t = 0
          return
        }
        this.play(this.want)
        this.t = 0
        continue
      }
      const d = c.ms[this.frame]!
      if (this.t < d) return
      this.t -= d
      if (c.loop) {
        const next = this.want === this.spent ? this.rest : this.want
        if (next !== this.motion) this.play(next)
        else this.frame = (this.frame + 1) % c.cells.length
      } else if (this.frame < c.cells.length - 1) {
        this.frame++
      } else if (this.want !== this.motion) {
        this.play(this.want)
      } else if (c.hold) {
        this.done = true
        this.t = 0
      } else {
        this.spent = this.motion
        this.play(this.rest)
      }
    }
  }

  private play(m: M): void {
    this.motion = m
    this.frame = 0
    this.done = false
  }
}
