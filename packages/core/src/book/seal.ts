// 봉인과 덧붙임(18 §2.1-3·4, §7.2). 봉인 뒤 바뀌는 칸은 opened·received_by·afterword 셋이며 각각 1회만 바뀐다.
// 코드는 이 세 칸의 추가 전용 API만 둔다. 지난 책은 다시 엮지 않는다.
import type { Content } from '../content/index'
import { characterOf, type RuleContext } from '../rules/context'
import { isBook, type Book, type BookAfterword, type BookReceivedBy } from '../state/book'
import type { LifeRecord } from '../state/family'
import type { ItemInstance } from '../state/inventory'
import type { JournalDraft } from '../state/journal'
import { renderTemplate } from '../text/index'
import { compileBook } from './compile'
import { bookInput } from './input'
import { bkId } from './text'

// 저장된 책(형식이 맞을 때만). 형식이 어긋난 옛 책은 null(18 §6.3 B15: 화면이 읽을 수 있는 부분만 보인다)
export const bookOf = (record: Pick<LifeRecord, 'book'>): Book | null => (isBook(record.book) ? record.book : null)

// 책 보기(본문 쪽)를 처음 열었을 때 false → true. 바뀌었으면 true
export function markBookOpened(book: Book): boolean {
  if (book.opened) return false
  book.opened = true
  return true
}

// 5단계 `출발` 확정 때 1회(18 §7.2). 이미 있으면 바꾸지 않는다
export function setBookReceivedBy(book: Book, by: BookReceivedBy): boolean {
  if (book.received_by !== null) return false
  book.received_by = { ...by }
  return true
}

// 후기(18 §3.6): 은퇴 책의 마지막 편지, 긴 잠 책의 달그늘 편지. 사망 책에는 없다. 1회만
export function setBookAfterword(book: Book, aw: BookAfterword): boolean {
  if (book.afterword !== null || book.cover.end_kind === 'died') return false
  if ((aw.kind === 'closing_letter') !== (book.cover.end_kind === 'retired')) return false
  book.afterword = { ...aw }
  return true
}

// 계승 2단계 3번(18 §2.1): 엮고 검사·수리해 봉인한다. 엮기는 스스로 예외 경계를 갖지만(최소 책), 입력 모으기에서
// 난 예외도 계승을 막지 않도록 여기서 한 번 더 감싼다
export function bindBook(ctx: RuleContext, record: LifeRecord, keepsakes: readonly Pick<ItemInstance, 'def_id' | 'prefix'>[]): Book | null {
  try {
    return compileBook(bookInput(ctx, record, { keepsakes }))
  } catch {
    return null
  }
}

// 2단계 4번 책 기록 BK33·BK34([가문], 가문 보존). 문장 틀이 없으면 쓰지 않는다
export function bookJournal(ctx: RuleContext, book: Book): JournalDraft | null {
  const { content } = ctx
  const line = textOf(content, bkId(33))
  const detail = textOf(content, bkId(34))
  if (line === null || detail === null) return null
  return {
    tag: 'house',
    importance: 'family',
    line: renderTemplate(line, {}),
    detail: renderTemplate(detail, { binder: book.binder, name: characterOf(ctx).name }),
  }
}

const textOf = (content: Content, id: string): string | null => (content.has('text', id) ? content.get('text', id).variants[0]! : null)
