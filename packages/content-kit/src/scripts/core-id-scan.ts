// 코어 코드에 특정 콘텐츠 ID가 문자열로 박혀 있는지 찾는다.
// 확장성 원칙: 규칙은 콘텐츠 ID가 아니라 데이터 속성(patrol_zone, lethal, first_sortie …)을 본다.
// 허용이 꼭 필요한 줄에는 `id-lint-allow` 주석을 붙인다.

// 앞뒤가 영숫자가 아니면 잡는다(mat_EN04처럼 밑줄 뒤도). 검증 규칙 코드(V##)는 목록에 넣지 않는다
const CONTENT_ID =
  /(?<![A-Za-z0-9])(T00|[HDA][1-9]|EN\d\d|EB\d\d|[WAJR]\d\d|CP\d\d|T[IAM]\d\d|L\d\d|C\d\d(?:-\d)?|F\d\d|S\d\d|N\d\d|E\d\d|X\d\d|AC\d\d|BK\d\d)(?![A-Za-z0-9])/
// 결정성 금지(ARCHITECTURE): 코어는 난수·현재 시각을 직접 읽지 않는다
const NONDETERMINISM = /\bMath\.random\b|\bnew Date\b|\bDate\.(?:now|parse)\b|\bperformance\./

export interface IdHit {
  file: string
  line: number
  id: string
  text: string
}

// 한 줄을 코드와 문자열 리터럴로 나눈다. 문자열 밖의 // 뒤는 주석이라 버린다
function splitLine(text: string): { code: string; strings: string[] } {
  let code = ''
  const strings: string[] = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (ch === '/' && text[i + 1] === '/') break
    if (ch !== "'" && ch !== '"' && ch !== '`') {
      code += ch
      continue
    }
    let s = ''
    for (i++; i < text.length && text[i] !== ch; i++) s += text[i] === '\\' ? text[i] + (text[++i] ?? '') : text[i]
    strings.push(s)
  }
  return { code, strings }
}

export function findCoreContentIds(file: string, source: string): IdHit[] {
  const hits: IdHit[] = []
  source.split(/\r?\n/).forEach((text, i) => {
    if (text.includes('id-lint-allow')) return
    for (const s of splitLine(text).strings) {
      const id = CONTENT_ID.exec(s)?.[1]
      if (id) hits.push({ file, line: i + 1, id, text: text.trim() })
    }
  })
  return hits
}

// 문자열·주석 밖 코드에서 Math.random·Date·performance 사용을 찾는다
export function findNondeterminism(file: string, source: string): IdHit[] {
  const hits: IdHit[] = []
  source.split(/\r?\n/).forEach((text, i) => {
    const m = NONDETERMINISM.exec(splitLine(text).code)
    if (m) hits.push({ file, line: i + 1, id: m[0], text: text.trim() })
  })
  return hits
}
