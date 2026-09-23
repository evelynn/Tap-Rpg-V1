// 정규 JSON(13 §8.2 "직렬화(키 순서 고정)"). 객체 키를 사전순으로 정렬하고 공백 없이 쓴다.
// 같은 저장 값이면 언제나 같은 바이트가 나와야 체크섬이 맞는다.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>
    const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`
  }
  // undefined·함수는 JSON.stringify가 undefined를 돌려주므로 null로 적는다(배열 구멍과 같은 처리)
  return JSON.stringify(value) ?? 'null'
}
