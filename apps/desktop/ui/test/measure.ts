// 11px 글자 폭 대역(canvas measureText 대신, 테스트 전용). Chromium(Windows, system-ui → 한글 Malgun Gothic)에서 잰
// 보통·굵게 값 중 큰 쪽이다: 한글 11.00, 공백 3.87, 숫자 6.38, 마침표·쉼표·가운뎃점 2.88, 영문 대 7.74·소 5.97, 그 밖 7.91
export function measure11(s: string): number {
  let w = 0
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    if ((c >= 0xac00 && c <= 0xd7a3) || (c >= 0x1100 && c <= 0x11ff) || (c >= 0x3130 && c <= 0x318f) || (c >= 0x2460 && c <= 0x24ff)) w += 11
    else if (ch === ' ') w += 3.87
    else if (/[0-9]/.test(ch)) w += 6.38
    else if (/[.,·:'']/.test(ch)) w += 2.88
    else if (/[A-Z]/.test(ch)) w += 7.74
    else if (/[a-z]/.test(ch)) w += 5.97
    else if (ch === '!') w += 3.56
    else if (ch === '?') w += 5.06
    else if (ch === '…') w += 9.71
    else w += 7.91
  }
  return w
}
