// PCG32(XSH RR): 64비트 상태·증분, 32비트 출력. 표준 pcg32_random_r / pcg32_srandom_r / pcg32_boundedrand_r와 같다.

const MULT = 6364136223846793005n
const MASK64 = 0xffffffffffffffffn
const U32 = 0x100000000

// 저장 형식: 16자리 16진 문자열(16 §5.8)
export interface Pcg32State {
  state: string
  inc: string
}

export class Pcg32 {
  private state: bigint
  private readonly inc: bigint

  private constructor(state: bigint, inc: bigint) {
    this.state = state
    this.inc = inc
  }

  // pcg32_srandom(initstate, initseq): inc = initseq<<1|1
  static seed(initstate: bigint, initseq: bigint): Pcg32 {
    const rng = new Pcg32(0n, ((initseq << 1n) | 1n) & MASK64)
    rng.nextU32()
    rng.state = (rng.state + initstate) & MASK64
    rng.nextU32()
    return rng
  }

  static fromState(s: Pcg32State): Pcg32 {
    const inc = parseHex64(s.inc)
    if ((inc & 1n) === 0n) throw new Error(`pcg32 inc는 홀수여야 한다: ${s.inc}`)
    return new Pcg32(parseHex64(s.state), inc)
  }

  toState(): Pcg32State {
    return { state: hex64(this.state), inc: hex64(this.inc) }
  }

  nextU32(): number {
    const old = this.state
    this.state = (old * MULT + this.inc) & MASK64
    const xorshifted = Number((((old >> 18n) ^ old) >> 27n) & 0xffffffffn)
    const rot = Number(old >> 59n)
    return ((xorshifted >>> rot) | (xorshifted << (-rot & 31))) >>> 0
  }

  // [0, n) 무편향 정수. n은 1 ~ 2^32−1 정수.
  bounded(n: number): number {
    if (!Number.isInteger(n) || n < 1 || n >= U32) throw new RangeError(`bounded: n=${n}`)
    const threshold = (U32 - n) % n
    for (;;) {
      const r = this.nextU32()
      if (r >= threshold) return r % n
    }
  }

  // [min, max] 양 끝 포함
  int(min: number, max: number): number {
    return min + this.bounded(max - min + 1)
  }

  d20(): number {
    return this.int(1, 20)
  }

  // p와 상관없이 항상 1회 소비한다
  chance(p: number): boolean {
    return this.nextU32() / U32 < p
  }

  // 음이 아닌 정수 가중치로 색인을 고른다
  weightedIndex(weights: readonly number[]): number {
    let total = 0
    for (const w of weights) {
      if (!Number.isInteger(w) || w < 0) throw new RangeError(`weightedIndex: 가중치 ${w}`)
      total += w
    }
    let r = this.bounded(total)
    for (let i = 0; ; i++) {
      r -= weights[i]!
      if (r < 0) return i
    }
  }

  pick<T>(items: readonly T[]): T {
    return items[this.bounded(items.length)] as T
  }
}

function parseHex64(s: string): bigint {
  if (!/^[0-9a-fA-F]{16}$/.test(s)) throw new Error(`pcg32 상태는 16자리 16진이어야 한다: ${s}`)
  return BigInt(`0x${s}`)
}

function hex64(v: bigint): string {
  return v.toString(16).padStart(16, '0')
}
