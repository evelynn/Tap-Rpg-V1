// 생애의 책 글자 도구(18 §2.4·§5.2·§6.1): 고유어 나이, 계절 이름, 책의 틀 문자열, 금지 표현 검사.
// 문장 틀 BK01~BK34는 콘텐츠(text book.bk01~bk34)이고, 여기 있는 것은 18 §5.4의 "책의 틀 문자열"(UI 문자열)뿐이다.
import { registerTextSlot, type SEASONS } from '../schema/index'

type Season = (typeof SEASONS)[number]

// 문장 틀 슬롯(16 V22: text book.bk01~book.bk34)
export const bkId = (n: number): string => `book.bk${String(n).padStart(2, '0')}`
for (let n = 1; n <= 34; n++) registerTextSlot(bkId(n), '생애의 책(18 §5.4)')

// 18 §5.4 책의 틀 문자열
export const FRAME = {
  stages: ['새내기', '전성기', '숙련기', '노년기', '달그늘의 밤'] as const, // 단계 이름(마지막 = 변이 장)
  endWord: { retired: '은퇴', early: '조기 은퇴', died: '돌아오지 않음', long_sleep: '긴 잠' } as const,
  closingHead: '맺는 장',
  fallbackHead: '적힌 것들',
  fork: '갈림길',
  notTaken: '가지 않은 길',
  byPolicy: '미리 정한 방침에 따라 골랐다',
  byPolicyMark: '(미리 정한 방침에 따라)',
  left: '남긴 것',
  curse: '저주도 함께 전해졌다',
  keepsakes: '기념품 선반으로',
  achievements: '가문 업적',
  ordinals: ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째', '열째'] as const,
  child: '아이',
  sameYear: '그해',
  retiredAs: '은퇴 뒤',
} as const

export const SEASON_WORDS: Readonly<Record<Season, string>> = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' }

const TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'] as const
const ONES = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'] as const

// 18 §5.2 {age_word}: 18 `열여덟 살`, 20 `스무 살`, 100 `백 살`, 118 `백열여덟 살`
export function ageWord(age: number): string {
  const two = (n: number): string => (n === 20 ? '스무' : TENS[Math.floor(n / 10)]! + ONES[n % 10]!)
  const body = age >= 100 ? `백${two(age % 100)}` : two(age)
  return `${body} 살`
}

// 18 §2.4: NFC, 글자 수는 코드 포인트(공백·문장부호 포함)
export const nfc = (s: string): string => s.normalize('NFC')
export const len = (s: string): number => [...s].length

// 이 글자로 끝나면 `.`을 붙이지 않는다(18 §5.1: 문장부호나 닫는 따옴표)
const END_PUNCT = /[.!?…"'”’」』)]$/u
export const sentence = (line: string): string => (END_PUNCT.test(line) ? line : `${line}.`)

// 따옴표 안을 뺀 문자열(BC4의 "따옴표 밖")
const QUOTED = /"[^"]*"|“[^”]*”|'[^']*'|‘[^’]*’/g
const outsideQuotes = (s: string): string => s.replace(QUOTED, '')

// 18 §6.1 BC4 패턴(NFC 문자열에 정규식)
const BANNED = /피가 튀|뼈가 부러|죽였|죽이|처치|시신|당신 때문|방치해|운도 없|바보|대박|ㅋ|개이득|레전드|[★♥]|!!|퀘스트|보상 획득|쓸모없/u
const RULE_WORDS = /주사위 \d|난이도 \d|= \d|HP|확률|가중치|퇴각 기준/u
const RAW_BRACE = /\{/
const YEAR = /\d{3,4}년/u

// 걸리면 걸린 조각을, 통과면 null. letterOnly = 편지·후기(치환되지 않은 `{`만 본다)
export function bc4Hit(text: string, letterOnly = false): string | null {
  const t = nfc(text)
  if (RAW_BRACE.test(t)) return '{'
  if (letterOnly) return null
  const hit = BANNED.exec(t) ?? RULE_WORDS.exec(t) ?? YEAR.exec(t)
  if (hit) return hit[0]
  const out = outsideQuotes(t)
  if (out.includes('당신')) return '당신'
  if (out.includes('!')) return '!'
  return null
}

// 18 §3.2·§4.1 큰따옴표 인용 쌍과 첫 인용 내용
const QUOTE_PAIR = /"([^"]+)"|“([^”]+)”/
export const firstQuote = (s: string): string | null => {
  const m = QUOTE_PAIR.exec(s)
  return m ? (m[1] ?? m[2] ?? null) : null
}

// BC2: 공백·문장부호를 뺀 텍스트
export const bareText = (s: string): string => nfc(s).replace(/[\s\p{P}\p{S}]/gu, '')
