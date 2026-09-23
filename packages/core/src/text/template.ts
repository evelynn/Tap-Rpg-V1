// 문장 템플릿(16 §1.4): {var}, {var:받침형/무받침형}, {{ }} 이스케이프. 받침 판정은 14 §6을 따른다.

type Batchim = 'final' | 'none' | 'rieul' | 'unknown' // 받침 있음·없음·ㄹ 받침·판정 불가(병기형)

// 조사 쌍 9종(16 §1.4.2)
const PARTICLES = new Map<string, Readonly<Record<Batchim, string>>>([
  ['이/가', { final: '이', none: '가', rieul: '이', unknown: '이(가)' }],
  ['은/는', { final: '은', none: '는', rieul: '은', unknown: '은(는)' }],
  ['을/를', { final: '을', none: '를', rieul: '을', unknown: '을(를)' }],
  ['과/와', { final: '과', none: '와', rieul: '과', unknown: '과(와)' }],
  ['으로/로', { final: '으로', none: '로', rieul: '로', unknown: '(으)로' }],
  ['아/야', { final: '아', none: '야', rieul: '아', unknown: '아(야)' }],
  ['이랑/랑', { final: '이랑', none: '랑', rieul: '이랑', unknown: '(이)랑' }],
  ['이나/나', { final: '이나', none: '나', rieul: '이나', unknown: '(이)나' }],
  ['이라/라', { final: '이라', none: '라', rieul: '이라', unknown: '(이)라' }],
])

// 판정에서 건너뛰는 끝 글자: 공백·닫는 괄호·따옴표·문장부호
const SKIP = /[\s)\]}>」』》〉】〕'"‘’“”.,!?;:…~·]/u

export type TemplateValues = Readonly<Record<string, string | number>>

interface Slot {
  name: string
  particle: Readonly<Record<Batchim, string>> | null
}

function batchimOf(value: string): Batchim {
  const chars = [...value]
  let i = chars.length - 1
  while (i >= 0 && SKIP.test(chars[i]!)) i--
  const ch = chars[i]
  if (ch === undefined) return 'unknown'
  const code = ch.codePointAt(0)!
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28
    return jong === 0 ? 'none' : jong === 8 ? 'rieul' : 'final'
  }
  // 숫자는 읽는 소리: 1·7·8 = ㄹ, 2·4·5·9 = 없음, 3·6·0 = 있음
  if (/[0-9]/.test(ch)) return '178'.includes(ch) ? 'rieul' : '2459'.includes(ch) ? 'none' : 'final'
  const c = ch.toLowerCase()
  if (/^[aeiouywr]$/.test(c)) return 'none'
  if (c === 'l') return 'rieul'
  if (c === 'm' || c === 'n') return 'final'
  return 'unknown'
}

// 문법 오류(중괄호 짝, 빈 변수 이름, 등록되지 않은 조사 쌍)는 예외
function parse(template: string): (string | Slot)[] {
  const parts: (string | Slot)[] = []
  let text = ''
  let i = 0
  while (i < template.length) {
    const ch = template[i]
    if ((ch === '{' || ch === '}') && template[i + 1] === ch) {
      text += ch
      i += 2
      continue
    }
    if (ch === '}') throw new Error(`템플릿 중괄호 짝이 맞지 않는다: ${template}`)
    if (ch !== '{') {
      text += ch
      i++
      continue
    }
    const end = template.indexOf('}', i)
    const body = template.slice(i + 1, end)
    if (end < 0 || body.includes('{')) throw new Error(`템플릿 중괄호 짝이 맞지 않는다: ${template}`)
    const colon = body.indexOf(':')
    const name = colon < 0 ? body : body.slice(0, colon)
    if (!/^\S+$/.test(name)) throw new Error(`템플릿 변수 이름이 잘못되었다: {${body}}`)
    let particle: Slot['particle'] = null
    if (colon >= 0) {
      particle = PARTICLES.get(body.slice(colon + 1)) ?? null
      if (!particle) throw new Error(`등록되지 않은 조사 쌍: {${body}}`)
    }
    if (text) parts.push(text)
    text = ''
    parts.push({ name, particle })
    i = end + 1
  }
  if (text) parts.push(text)
  return parts
}

// 값이 없거나, 숫자가 유한수가 아니거나, 빈 값에 조사를 붙이면 예외다(빈 값이면 조사가 병기형 "을(를)"로 남는다)
export function renderTemplate(template: string, values: TemplateValues): string {
  return parse(template)
    .map((p) => {
      if (typeof p === 'string') return p
      const raw = Object.hasOwn(values, p.name) ? values[p.name] : undefined
      if (raw === undefined || raw === null) throw new Error(`템플릿 변수 값이 없다: {${p.name}} — ${template}`)
      if (typeof raw === 'number' && !Number.isFinite(raw)) throw new Error(`템플릿 변수 값이 수가 아니다: {${p.name}}=${raw} — ${template}`)
      const v = String(raw)
      if (p.particle && v === '') throw new Error(`빈 값에 조사를 붙였다: {${p.name}} — ${template}`)
      return p.particle ? v + p.particle[batchimOf(v)] : v
    })
    .join('')
}

// 템플릿이 쓰는 변수 이름(처음 나온 순서, 중복 없음). 콘텐츠 검사 V5용.
export function templateVars(template: string): string[] {
  return [...new Set(parse(template).flatMap((p) => (typeof p === 'string' ? [] : [p.name])))]
}
