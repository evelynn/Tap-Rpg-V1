// 수치 보조(08 §3.1). rules·items 어느 쪽에서도 쓰므로 의존이 없는 가장 아래에 둔다.

// 부동소수 잡음을 없앤 반올림(08 §3.1: 5 × 1.3 = 6.5 → 7)
export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5 + 1e-9)
}
