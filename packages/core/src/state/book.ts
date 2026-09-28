// 생애의 책 저장 모양(18 §7.1, 16 §5.3 life_record.book). 렌더링이 끝난 문장을 사본으로 두고 출처 기록 id를 함께 둔다.
// 봉인 뒤 바뀌는 칸은 opened·received_by·afterword 셋뿐이다(18 §7.2, book/seal.ts의 추가 전용 API).
import { z } from 'zod'
import { END_KINDS, SEASONS } from '../schema/index'
import { intV, nat, s, uid } from './common'

export const BOOK_CHAPTER_KEYS = ['ch1', 'ch2', 'ch3', 'ch4', 'moon', 'short', 'close', 'fallback'] as const
export const BOOK_BLOCK_KINDS = ['opener', 'entry', 'attitude', 'fork', 'quote_last', 'letter', 'closing'] as const
export const BOOK_EMBLEMS = ['lamp_lit', 'lamp_out', 'moon'] as const
export const BOOK_SPINES = ['thin', 'mid', 'thick'] as const

export const bookBlockSchema = s({
  kind: z.enum(BOOK_BLOCK_KINDS),
  text: z.string().optional(), // 한 덩어리 문장(기록·태도·여는·닫는·인용 줄)
  lines: z.array(z.string()).optional(), // 줄마다 나뉜 블록(갈림길 상자·편지)
  src: z.array(nat), // 출처 journal_entry id
})
export type BookBlock = z.infer<typeof bookBlockSchema>

export const bookChapterSchema = s({
  key: z.enum(BOOK_CHAPTER_KEYS),
  head: z.string(), // `1장 · 새내기` · `맺는 장 · 마지막 귀환` · `짧은 길` · `적힌 것들`
  subtitle: z.string(), // 맺는 장·최소 책은 빈 문자열
  age_from: intV,
  age_to: intV, // 같으면 화면은 `{end}세` 하나로 쓴다(18 §3.4)
  blocks: z.array(bookBlockSchema),
})
export type BookChapter = z.infer<typeof bookChapterSchema>

export const bookSchema = s({
  gen_version: intV.min(1),
  binder: z.string(),
  back: z.tuple([z.string(), z.string(), z.string()]),
  opened: z.boolean(),
  fallback: z.boolean(),
  diag: z.array(z.string()),
  cover: s({
    family: z.string(),
    volume: intV.min(1),
    title: z.string(),
    subtitle: z.string(), // `{start}~{end}세 · {end_word}`
    end_kind: z.enum(END_KINDS),
    emblem: z.enum(BOOK_EMBLEMS),
    spine: z.enum(BOOK_SPINES),
  }),
  epigraph: s({ text: z.string(), speaker: z.string().nullable(), src_id: nat.nullable() }),
  chapters: z.array(bookChapterSchema),
  appendix: s({ people: z.array(z.string()), left: z.array(z.string()), walk: z.array(z.string()) }),
  afterword: s({
    kind: z.enum(['closing_letter', 'moon_letter']),
    heir_name: z.string(),
    age: intV,
    season: z.enum(SEASONS),
    text: z.string(),
  }).nullable(),
  received_by: s({ gen: intV.min(1), char_uid: uid, name: z.string(), old_name: z.string().nullable() }).nullable(),
})
export type Book = z.infer<typeof bookSchema>
export type BookAfterword = NonNullable<Book['afterword']>
export type BookReceivedBy = NonNullable<Book['received_by']>

// life_record.book 칸. 형식이 어긋난 책도 저장을 거부하지 않고 그대로 읽는다(18 §6.3 B15: 저장값을 고치지 않고
// 읽을 수 있는 부분만 보이며 진단 로그를 남긴다). 그래서 모르는 모양은 느슨한 객체로 받고 isBook으로 가린다
export const storedBookSchema = z.union([bookSchema, z.looseObject({})]).nullable()

export const isBook = (v: unknown): v is Book => bookSchema.safeParse(v).success
