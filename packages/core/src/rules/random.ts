// 규칙 층이 쓰는 난수 인터페이스. Pcg32가 그대로 맞고, 테스트는 고정 난수를 넣을 수 있다.
import type { Pcg32 } from '../rng/index'

export type Rng = Pick<Pcg32, 'nextU32' | 'bounded' | 'int' | 'd20' | 'chance' | 'weightedIndex' | 'pick'>

const U32 = 0x100000000

// 실수 가중치 추첨(05 §2.2·§4.2 능력치 분배). 가중치와 상관없이 u32를 1개 쓴다.
// r = u32 / 2^32 × 합, 누적 가중치가 r을 넘는 첫 색인. 가중치 0인 항목은 뽑히지 않는다
export function weightedPick(rng: Rng, weights: readonly number[]): number {
  let total = 0
  for (const w of weights) {
    if (!(w >= 0) || !Number.isFinite(w)) throw new RangeError(`weightedPick: 가중치 ${w}`)
    total += w
  }
  if (total <= 0) throw new RangeError('weightedPick: 가중치 합이 0이다')
  const r = (rng.nextU32() / U32) * total
  let acc = 0
  let last = -1
  for (let i = 0; i < weights.length; i++) {
    if (weights[i]! <= 0) continue
    acc += weights[i]!
    last = i
    if (r < acc) return i
  }
  return last // 부동소수 누적 오차로 끝까지 온 경우
}
