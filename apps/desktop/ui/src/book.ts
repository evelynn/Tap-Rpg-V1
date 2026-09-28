// 생애의 책 보기(03 §5.5 서가, §5.6 책 보기, 18 §3·§8). 책은 코어가 엮어 life_record.book에 봉인한다(18 §7).
// 쪽 나누기는 DOM 없이 계산한다(bookPages): 한 쪽은 약 18줄 × 34자(100%), 블록은 쪽 사이에서 나누지 않고
// 장과 부분(표지·속표지·차례·맺는 장·부록·후기)은 새 쪽에서 시작한다. 한 쪽보다 긴 블록만 줄 단위로 잇는다.
import type { LifeRecord } from '@tap/core'
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

export type Line = { text: string; cls?: string }
export interface Page { lines: Line[]; part: string }

export const EMBLEM: Record<string, string> = { lamp_lit: '●', lamp_out: '○', moon: '☾' } // 켜진 등불·꺼진 등불·초승달. 그림 부품(15 §11)이 오기 전 글자 표식
export const END_WORD: Record<string, string> = { retired: '은퇴', died: '돌아오지 않음', long_sleep: '긴 잠' }

const wrap = (text: string, chars: number): string[] => {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let rest = [...para]
    if (!rest.length) { out.push(''); continue }
    while (rest.length) {
      out.push(rest.slice(0, chars).join(''))
      rest = rest.slice(chars)
    }
  }
  return out
}

function blockLines(b: BookBlock, chars: number): Line[] {
  const cls = b.kind === 'fork' ? 'fork' : b.kind === 'letter' ? 'letter' : b.kind === 'quote_last' ? 'quote' : b.kind === 'attitude' ? 'attitude' : b.kind === 'opener' ? 'opener' : undefined
  const texts = b.lines ?? (b.text !== undefined ? [b.text] : [])
  const width = cls === 'fork' || cls === 'letter' || cls === 'quote' ? chars - 2 : chars
  return texts.flatMap((t) => wrap(t, width)).map((text) => ({ text, ...(cls ? { cls } : {}) }))
}

// 부분마다 새 쪽, 블록은 나누지 않되 한 쪽보다 길면 줄 단위로 잇는다. 블록 사이 한 줄
export function bookPages(book: BookLike, page: { lines: number; chars: number } = PAGE): Page[] {
  const pages: Page[] = []
  const part = (name: string, blocks: Line[][]): void => {
    let cur: Line[] = []
    const flush = (): void => { if (cur.length) { pages.push({ lines: cur, part: name }); cur = [] } }
    for (const b of blocks) {
      const need = b.length + (cur.length ? 1 : 0)
      if (cur.length && cur.length + need > page.lines) flush()
      if (cur.length) cur.push({ text: '' })
      for (const l of b) {
        if (cur.length >= page.lines) flush()
        cur.push(l)
      }
    }
    flush()
    if (!pages.some((p) => p.part === name)) pages.push({ lines: [{ text: '' }], part: name })
  }
  const c = book.cover
  part('표지', [[{ text: `${c.family} 가문 · 제${c.volume}권`, cls: 'dim' }], [{ text: `「${c.title}」`, cls: 'title' }], [{ text: `${c.subtitle}  ${EMBLEM[c.emblem] ?? ''}`, cls: 'dim' }]])
  const ep: Line[][] = []
  if (book.epigraph?.text) ep.push([...wrap(book.epigraph.text, page.chars).map((t) => ({ text: t, cls: 'quote' })), ...(book.epigraph.speaker ? [{ text: `— ${book.epigraph.speaker}`, cls: 'dim' }] : [])])
  if (book.received_by) ep.push([{ text: `받은 사람 · ${book.received_by.name}${book.received_by.old_name ? `(${book.received_by.old_name})` : ''}`, cls: 'dim' }])
  if (book.binder) ep.push([{ text: `엮은 사람 · ${book.binder}`, cls: 'dim' }])
  part('속표지', ep)
  part('차례', [book.chapters.map((ch) => ({ text: `${ch.head}${ch.subtitle ? ` — ${ch.subtitle}` : ''} · ${ch.age_from}~${ch.age_to}세` })),
    [{ text: '부록 · 함께 걸은 사람들 · 남긴 것 · 걸어온 길', cls: 'dim' }, ...(book.afterword ? [{ text: '후기', cls: 'dim' }] : [])]])
  for (const ch of book.chapters) {
    part(ch.head, [[{ text: ch.head, cls: 'head' }, ...(ch.subtitle ? [{ text: ch.subtitle, cls: 'dim' }] : []), { text: `${ch.age_from}~${ch.age_to}세`, cls: 'dim' }],
      ...ch.blocks.map((b) => blockLines(b, page.chars))])
  }
  const a = book.appendix
  if (a) {
    part('부록', [[{ text: '함께 걸은 사람들', cls: 'head' }, ...a.people.flatMap((p) => wrap(p, page.chars).map((text) => ({ text })))],
      [{ text: '남긴 것', cls: 'head' }, ...a.left.flatMap((p) => wrap(p, page.chars).map((text) => ({ text })))],
      [{ text: '걸어온 길', cls: 'head' }, ...a.walk.flatMap((p) => wrap(p, page.chars).map((text) => ({ text })))]])
  }
  if (book.afterword?.text) part('후기', [[{ text: '후기', cls: 'head' }, ...wrap(book.afterword.text, page.chars - 2).map((text) => ({ text, cls: 'letter' }))]])
  return pages
}

export const asBook = (r: LifeRecord): BookLike | null => {
  const b = r.book as unknown as BookLike | null
  return b && b.cover && Array.isArray(b.chapters) ? b : null
}

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
