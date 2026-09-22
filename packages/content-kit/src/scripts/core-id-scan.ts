// 코어 코드에 특정 콘텐츠 ID가 문자열로 박혀 있는지 찾는다.
// 확장성 원칙: 규칙은 콘텐츠 ID가 아니라 데이터 속성(patrol_zone, lethal, first_sortie …)을 본다.
// 허용이 꼭 필요한 줄에는 `id-lint-allow` 주석을 붙인다.

const CONTENT_ID =
  /\b(T00|[HDA][1-9]|EN\d\d|EB\d\d|[WAJR]\d\d|CP\d\d|T[IAM]\d\d|L\d\d|C\d\d(?:-\d)?|F\d\d|S\d\d|N\d\d)\b/
const STRING_LITERAL = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g

export interface IdHit {
  file: string
  line: number
  id: string
  text: string
}

export function findCoreContentIds(file: string, source: string): IdHit[] {
  const hits: IdHit[] = []
  source.split(/\r?\n/).forEach((text, i) => {
    if (text.includes('id-lint-allow')) return
    const code = text.replace(/\/\/.*$/, '')
    for (const m of code.matchAll(STRING_LITERAL)) {
      const id = CONTENT_ID.exec(m[2] ?? '')?.[1]
      if (id) hits.push({ file, line: i + 1, id, text: text.trim() })
    }
  })
  return hits
}
