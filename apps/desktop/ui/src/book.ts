// 생애의 책 보기(03 §5.5 서가, §5.6 책 보기, 18 §3·§8). 책은 코어가 엮어 life_record.book에 봉인한다(18 §7).
// 쪽 나누기는 DOM 없이 계산한다(bookPages): 한 쪽은 약 18줄 × 34자(100%), 블록은 쪽 사이에서 나누지 않고
// 장과 부분(표지·속표지·차례·맺는 장·부록·후기)은 새 쪽에서 시작한다. 한 쪽보다 긴 블록만 줄 단위로 잇는다.
import { bookOf, type LifeRecord } from '@tap/core'
import { button, h } from './detail/view'

// 18 §7.1 저장 모양 중 화면이 읽는 칸(코어 Book과 같은 모양, 모르는 칸은 무시)
export interface BookBlock { kind: string; text?: string; lines?: string[]; src?: number[] }
export interface BookChapter { key: string; head: string; subtitle: string; age_from: number; age_to: number; blocks: BookBlock[] }
export interface BookLike {
  opened?: boolean
  fallback?: boolean
  back?: string[]
  cover: { family: string; volume: number; title: string; subtitle: string; end_kind: string; emblem: string; spine: string }
  epigraph?: { text: string; speaker: string | null } | null
  binder?: string
  chapters: BookChapter[]
  appendix?: { people: string[]; left: string[]; walk: string[] }
  afterword?: { text: string } | null
  received_by?: { name: string; old_name: string | null } | null
}

export const PAGE = { lines: 18, chars: 34 } as const
const ages = (a: number, b: number): string => (a === b ? `${a}세` : `${a}~${b}세`)

// 한 줄 = 화면의 한 문단(줄바꿈은 화면이 어절 단위로 한다). rows는 쪽 나누기용 추정 줄 수
export type Line = { text: string; cls?: string; rows: number }
export interface Page { lines: Line[]; part: string }

export const EMBLEM: Record<string, string> = { lamp_lit: '●', lamp_out: '○', moon: '☾' } // 켜진 등불·꺼진 등불·초승달. 그림 부품(15 §11)이 오기 전 글자 표식
export const END_WORD: Record<string, string> = { retired: '은퇴', died: '돌아오지 않음', long_sleep: '긴 잠' }

const rowsOf = (text: string, chars: number): number => Math.max(1, Math.ceil([...text].length / chars))
const line = (text: string, chars: number, cls?: string): Line => ({ text, rows: rowsOf(text, chars), ...(cls ? { cls } : {}) })

// 한 쪽보다 긴 문단만 어절 경계에서 나눈다
function splitLong(l: Line, maxRows: number, chars: number): Line[] {
  if (l.rows <= maxRows) return [l]
  const words = l.text.split(' ')
  const out: Line[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (rowsOf(next, chars) > maxRows && cur) { out.push({ ...l, text: cur, rows: rowsOf(cur, chars) }); cur = w } else cur = next
  }
  if (cur) out.push({ ...l, text: cur, rows: rowsOf(cur, chars) })
  return out
}

function blockLines(b: BookBlock, chars: number): Line[] {
  const cls = b.kind === 'fork' ? 'fork' : b.kind === 'letter' ? 'letter' : b.kind === 'quote_last' ? 'quote' : b.kind === 'attitude' ? 'attitude' : b.kind === 'opener' ? 'opener' : undefined
  const texts = b.lines ?? (b.text !== undefined ? [b.text] : [])
  const width = cls === 'fork' || cls === 'letter' || cls === 'quote' ? chars - 2 : chars
  return texts.flatMap((t) => t.split(/\n/)).map((t) => line(t, width, cls))
}

// 부분마다 새 쪽, 블록은 쪽 사이에서 나누지 않되 한 쪽보다 길면 문단 단위로 잇는다. 블록 사이 반 줄(8)
export function bookPages(book: BookLike, page: { lines: number; chars: number } = PAGE): Page[] {
  const pages: Page[] = []
  const part = (name: string, blocks: Line[][]): void => {
    let cur: Line[] = []
    let used = 0
    const flush = (): void => { if (cur.length) { pages.push({ lines: cur, part: name }); cur = []; used = 0 } }
    for (const b of blocks) {
      const size = b.reduce((n, l) => n + l.rows, 0)
      if (cur.length && used + size + 0.5 > page.lines) flush()
      let first = true
      for (const l0 of b) {
        for (const l of splitLong(l0, page.lines, page.chars)) {
          if (cur.length && used + l.rows > page.lines) flush()
          cur.push(first && cur.length ? { ...l, cls: `${l.cls ?? ''} gap`.trim() } : l)
          used += l.rows + (first && cur.length > 1 ? 0.5 : 0)
          first = false
        }
      }
    }
    flush()
    if (!pages.some((p) => p.part === name)) pages.push({ lines: [line('', page.chars)], part: name })
  }
  const ch0 = page.chars
  const c = book.cover
  part('표지', [[line(`${c.family} 가문 · 제${c.volume}권`, ch0, 'dim')], [line(`「${c.title}」`, ch0, 'title')], [line(`${c.subtitle}  ${EMBLEM[c.emblem] ?? ''}`, ch0, 'dim')]])
  const ep: Line[][] = []
  if (book.epigraph?.text) ep.push([line(book.epigraph.text, ch0, 'quote'), ...(book.epigraph.speaker ? [line(`— ${book.epigraph.speaker}`, ch0, 'dim')] : [])])
  if (book.received_by) ep.push([line(`받은 사람 · ${book.received_by.name}${book.received_by.old_name ? `(${book.received_by.old_name})` : ''}`, ch0, 'dim')])
  if (book.binder) ep.push([line(`엮은 사람 · ${book.binder}`, ch0, 'dim')])
  part('속표지', ep)
  part('차례', [book.chapters.map((ch) => line(`${ch.head}${ch.subtitle ? ` — ${ch.subtitle}` : ''} · ${ages(ch.age_from, ch.age_to)}`, ch0)),
    [line('부록 · 함께 걸은 사람들 · 남긴 것 · 걸어온 길', ch0, 'dim'), ...(book.afterword ? [line('후기', ch0, 'dim')] : [])]])
  for (const ch of book.chapters) {
    part(ch.head, [[line(ch.head, ch0, 'head'), ...(ch.subtitle ? [line(ch.subtitle, ch0, 'dim')] : []), line(ages(ch.age_from, ch.age_to), ch0, 'dim')],
      ...ch.blocks.map((b) => blockLines(b, ch0))])
  }
  const a = book.appendix
  if (a) {
    part('부록', [[line('함께 걸은 사람들', ch0, 'head'), ...a.people.map((p) => line(p, ch0))],
      [line('남긴 것', ch0, 'head'), ...a.left.map((p) => line(p, ch0))],
      [line('걸어온 길', ch0, 'head'), ...a.walk.map((p) => line(p, ch0))]])
  }
  if (book.afterword?.text) part('후기', [[line('후기', ch0, 'head'), ...book.afterword.text.split(/\n/).map((t) => line(t, ch0 - 2, 'letter'))]])
  return pages
}

export const asBook = (r: LifeRecord): BookLike | null => bookOf(r) as BookLike | null


// 서가 머리줄(18 §3.1): 1대 「제목」 · 18~68세 · 은퇴 · 새 책
export const shelfHead = (r: LifeRecord, b: BookLike): string =>
  `${r.gen}대 「${b.cover.title}」 · ${b.cover.subtitle}${b.opened ? '' : ' · 새 책'}`

// 서가(03 §5.5): 대수 순 책등, 끝에 지금 인물의 `쓰는 중`
export function shelfView(records: readonly LifeRecord[], writing: string | null, open: (gen: number) => void, toJournal: () => void): HTMLElement {
  const head = h('div', { class: 'd-shelf-head d-dim' }, records.length ? '책등을 누르면 책을 펼칩니다.' : '아직 끝난 생애가 없습니다.')
  const row = h('div', { class: 'd-shelf', role: 'list' })
  for (const r of records) {
    const b = asBook(r)
    if (!b) continue
    const spine = h('div', { class: `d-spine ${b.cover.spine} ${b.cover.end_kind}${b.opened ? '' : ' unread'}`, role: 'listitem', tabindex: '0', title: shelfHead(r, b) },
      h('div', { class: 'd-emblem' }, EMBLEM[b.cover.emblem] ?? ''), h('div', { class: 'd-spine-name' }, [...r.name].slice(0, 6).join('')))
    spine.onmouseenter = () => { head.textContent = shelfHead(r, b) }
    spine.onfocus = () => { head.textContent = shelfHead(r, b) }
    spine.onclick = () => open(r.gen)
    spine.onkeydown = (e) => { if (e.key === 'Enter') open(r.gen) }
    row.append(spine)
  }
  if (writing) {
    const w = h('div', { class: 'd-spine writing', role: 'listitem', tabindex: '0', title: `${writing} · 쓰는 중` }, h('div', { class: 'd-spine-name' }, '쓰는 중'))
    w.onclick = toJournal
    row.append(w)
  }
  return h('div', { class: 'd-sec' }, head, row, h('div', { class: 'd-shelf-board' }))
}

// 책 보기(03 §5.6): 머리줄 · 한 쪽 · 아래줄. 쪽 번호는 1부터
export class BookViewer {
  page = 0
  private pages: Page[]

  constructor(readonly gen: number, private readonly book: BookLike, private readonly back: () => void, private readonly onOpenBody: () => void, private readonly rerender: () => void, private readonly backLabel = '‹ 서가', pageSize = PAGE) {
    this.pages = bookPages(book, pageSize)
  }

  get count(): number { return this.pages.length }

  go(n: number): void {
    this.page = Math.max(0, Math.min(this.pages.length - 1, n))
    if (this.pages[this.page]?.part !== '표지' && !this.book.opened) this.onOpenBody() // 본문 쪽을 처음 열 때 opened(18 §7.2)
    this.rerender()
  }

  key(e: KeyboardEvent): boolean {
    const k = e.key
    if (k === 'ArrowRight' || k === 'PageDown') this.go(this.page + 1)
    else if (k === 'ArrowLeft' || k === 'PageUp') this.go(this.page - 1)
    else if (k === 'Home') this.go(0)
    else if (k === 'End') this.go(this.pages.length - 1)
    else if (k === 'Escape') this.back()
    else return false
    return true
  }

  view(): HTMLElement[] {
    const p = this.pages[this.page]!
    const toc = this.pages.findIndex((x) => x.part === '차례')
    const head = h('div', { class: 'd-book-head' }, button(this.backLabel, () => this.back()), h('div', { class: 'd-strong' }, `「${this.book.cover.title}」`), button('차례', () => this.go(toc)))
    const body = h('div', { class: 'd-book-page', role: 'document' }, ...p.lines.map((l) => h('div', { class: `d-book-line${l.cls ? ` ${l.cls}` : ''}` }, l.text || ' ')))
    const foot = h('div', { class: 'd-book-foot' }, button('◂', () => this.go(this.page - 1), { disabled: this.page === 0 }), h('span', {}, `${this.page + 1} / ${this.pages.length}`), button('▸', () => this.go(this.page + 1), { disabled: this.page >= this.pages.length - 1 }))
    return [head, body, foot]
  }
}
