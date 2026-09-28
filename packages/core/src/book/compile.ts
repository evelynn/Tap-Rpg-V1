// 생애의 책 엮기(18 §3~§6): 선별(select.ts) → 장 만들기·합치기(§4.5) → 줄이기(trim) → 블록 변환(§5) →
// 검사·수리 BC1~BC8(§6.1·§6.2, 한 번에 하나, 최대 64회) → 최소 책. compileBook 전체를 예외 경계로 감싼다(§6.2).
// 순수 함수다: 입력 S(BookInput)만 읽고 난수·시계를 읽지 않는다. 같은 입력이면 같은 책이 나온다(§12).
import { utf8 } from '../rng/sha256'
import { canonicalJson } from '../save/canonical'
import type { Book, BookBlock, BookChapter } from '../state/book'
import { renderTemplate } from '../text/index'
import type { BookInput } from './input'
import { byTime, effc, kindOf, select, type Mark, type Rec, type Selection } from './select'
import { FRAME, SEASON_WORDS, ageWord, bareText, bc4Hit, bkId, firstQuote, len, nfc, sentence } from './text'

// 18 §3.7 분량 상한
export const BOOK_LIMITS = {
  chapterBlocks: 10, bookBlocks: 36, block: 120, bk: 60, title: 18, subtitle: 16, epigraph: 80, back: 40,
  body: 3600, appendix: 1500, bytes: 20 * 1024, afterwordReserve: 1200, repairs: 64,
  people: 12, left: 10, walk: 14,
} as const
const SPINE_EDGES: readonly [number, 'thin' | 'mid'][] = [[1200, 'thin'], [2400, 'mid']]

interface BlkBase {
  mand: boolean
  score: number
  exempt: Set<string>
  nohead: boolean
  out: string[] // 렌더 결과(기록·태도 1줄, 상자 여러 줄)
  body: string // 나이 머리를 뺀 본문(BC2·BC7)
}
interface EntryBlk extends BlkBase { kind: 'entry'; rec: Rec; form: 0 | 1 | 2; detailOnly: boolean } // form 0 §5.1 · 1 detail만 · 2 line 형태
interface ForkBlk extends BlkBase { kind: 'fork'; rec: Rec; follow: Rec[]; level: 0 | 1 | 2 } // level 1 = 4번 줄 뺌, 2 = 3·4번 줄 뺌
interface AttBlk extends BlkBase { kind: 'attitude'; mark: Mark }
type Blk = EntryBlk | ForkBlk | AttBlk

interface ChapEnd {
  quote: Rec | null
  tail: EntryBlk[]
  letter: Rec | null
  closingOn: boolean
  mergedOld: boolean
  oldFrom: number
}
interface Chap {
  key: BookChapter['key']
  stage: number // 0~3 단계, 4 = 달그늘의 밤, -1 = 맺는 장
  effFrom: number
  effTo: number
  ageFrom: number
  ageTo: number
  blocks: Blk[]
  openerOn: boolean
  end: ChapEnd | null
}
interface Model {
  chapters: Chap[]
  exempt: Set<string>
  diag: string[]
}

const BODY_KEYS: readonly string[] = ['ch1', 'ch2', 'ch3', 'ch4', 'moon']
const isBody = (c: Chap): boolean => BODY_KEYS.includes(c.key)
const keyOf = (b: Blk): { eff_min: number; id: number } => (b.kind === 'attitude' ? { eff_min: b.mark.eff_min, id: -1 } : { eff_min: b.rec.eff_min, id: b.rec.id })
const blkCmp = (a: Blk, b: Blk): number => byTime(keyOf(a), keyOf(b))
const ageSeason = (b: Blk): { age: number; season: Rec['season'] } => (b.kind === 'attitude' ? b.mark : b.rec)
const counted = (c: Chap): Blk[] => [...c.blocks, ...(c.end?.tail ?? [])]

// ── 입력 도우미 ──

function bk(input: BookInput, n: number, values: Record<string, string | number> = {}): string {
  const t = input.texts[bkId(n)]
  if (t === undefined) throw new Error(`문장 틀 ${bkId(n)}이 없다`)
  return nfc(renderTemplate(t, { name: input.name, binder: input.binder, ...values }))
}

const endWord = (input: BookInput): string =>
  input.end_kind === 'retired' ? (input.early ? FRAME.endWord.early : FRAME.endWord.retired) : FRAME.endWord[input.end_kind]

const endNo = (input: BookInput): 0 | 1 | 2 => (input.end_kind === 'retired' ? 0 : input.end_kind === 'died' ? 1 : 2)

// ── 모델 만들기 ──

function newEntry(sel: Selection, rec: Rec, mand: boolean, opts: { nohead?: boolean; detailOnly?: boolean } = {}): EntryBlk {
  return { kind: 'entry', rec, mand, score: sel.score.get(rec.id) ?? 1, exempt: new Set(), nohead: opts.nohead ?? false, out: [], body: '', form: 0, detailOnly: opts.detailOnly ?? false }
}

function buildModel(input: BookInput, sel: Selection): Model {
  const recById = new Map(sel.S.map((e) => [e.id, e]))
  const chapters: Chap[] = sel.chapters.map((c) => ({
    key: c.key, stage: c.stage, effFrom: c.effFrom, effTo: c.effTo, ageFrom: c.ageFrom, ageTo: c.ageTo, blocks: [], openerOn: true, end: null,
  }))
  const chapFor = (eff: number, age: number): Chap => chapters.find((c) => c.key === sel.chapOf(eff, age)) ?? chapters[0]!
  for (const id of [...sel.mand, ...sel.chosen]) {
    const rec = recById.get(id)
    if (rec) chapFor(rec.eff_min, rec.age).blocks.push(newEntry(sel, rec, sel.mand.has(id)))
  }
  for (const [id, follow] of sel.forks) {
    const rec = recById.get(id)!
    chapFor(rec.eff_min, rec.age).blocks.push({
      kind: 'fork', rec, follow, mand: true, score: sel.score.get(id) ?? 1, exempt: new Set(), nohead: true, out: [], body: '', level: 0,
    })
  }
  for (const mark of sel.marks) {
    chapFor(mark.eff_min, mark.age).blocks.push({ kind: 'attitude', mark, mand: true, score: 0, exempt: new Set(), nohead: true, out: [], body: '' })
  }
  for (const c of chapters) c.blocks.sort(blkCmp)

  const closing: Chap = {
    key: 'close', stage: -1, effFrom: sel.endEff, effTo: sel.endEff, ageFrom: input.end_age, ageTo: input.end_age,
    blocks: sel.lastYear.map((r) => newEntry(sel, r, true)),
    openerOn: false,
    end: {
      quote: sel.quote,
      tail: sel.tail.map((r, i) => newEntry(sel, r, true, { nohead: true, detailOnly: i === 0 && sel.tailFirstDetail })),
      letter: sel.letter,
      closingOn: true,
      mergedOld: false,
      oldFrom: input.stage_ages[2],
    },
  }

  // 18 §4.5 합치기
  let body = chapters
  const ch4 = body.find((c) => c.key === 'ch4')
  if (ch4 && ch4.blocks.length < 3) {
    closing.blocks = [...ch4.blocks, ...closing.blocks].sort(blkCmp)
    closing.end!.mergedOld = true
    closing.end!.oldFrom = ch4.ageFrom
    body = body.filter((c) => c !== ch4)
  }
  for (;;) {
    const i = body.findIndex((c) => c.blocks.length < 2)
    if (i < 0 || body.length < 2) break
    body = mergeChapters(body, body[i]!, body[i + 1] ?? body[i - 1]!)
  }
  const total = body.reduce((n, c) => n + c.blocks.length, 0)
  const model: Model = { chapters: [...body, closing], exempt: new Set(), diag: [] }
  if (total < 4) {
    const short: Chap = {
      key: 'short', stage: body[0]?.stage ?? 0, effFrom: 0, effTo: sel.endEff, ageFrom: input.time.start_age, ageTo: input.end_age,
      blocks: [...body.flatMap((c) => c.blocks), ...closing.blocks].sort(blkCmp), openerOn: true, end: closing.end,
    }
    model.chapters = [short]
  }
  trim(model)
  return model
}

// 장 둘을 하나로(18 §4.5-2·BC1): 단계 이름·여는 문장·기본 부제는 블록이 많은 쪽(동률이면 앞 장), 나이 구간은 두 장을 합한다
function mergeChapters(list: Chap[], from: Chap, into: Chap): Chap[] {
  const [a, b] = list.indexOf(from) < list.indexOf(into) ? [from, into] : [into, from]
  const win = b.blocks.length > a.blocks.length ? b : a
  const merged: Chap = {
    ...win, effFrom: Math.min(a.effFrom, b.effFrom), effTo: Math.max(a.effTo, b.effTo),
    ageFrom: Math.min(a.ageFrom, b.ageFrom), ageTo: Math.max(a.ageTo, b.ageTo), blocks: [...a.blocks, ...b.blocks].sort(blkCmp),
  }
  return list.filter((c) => c !== b).map((c) => (c === a ? merged : c))
}

// trim: 장 > max(10, 필수_c) 또는 책 > max(36, 필수)이면 비필수를 점수 낮은 것, 같으면 늦은 것부터 뺀다(18 §4.4)
function trim(m: Model): void {
  for (const c of m.chapters) {
    while (counted(c).length > Math.max(BOOK_LIMITS.chapterBlocks, counted(c).filter((b) => b.mand).length)) if (!removeLowest(m, c)) break
  }
  const all = (): Blk[] => m.chapters.flatMap(counted)
  while (all().length > Math.max(BOOK_LIMITS.bookBlocks, all().filter((b) => b.mand).length)) if (!removeLowest(m, null)) break
}

function removeLowest(m: Model, scope: Chap | null): boolean {
  const pool = (scope ? [scope] : m.chapters).flatMap((c) => c.blocks.filter((b) => !b.mand).map((b) => ({ c, b })))
  if (!pool.length) return false
  pool.sort((x, y) => x.b.score - y.b.score || blkCmp(y.b, x.b))
  const { c, b } = pool[0]!
  c.blocks = c.blocks.filter((x) => x !== b)
  return true
}

function removeBlock(m: Model, b: Blk): void {
  for (const c of m.chapters) {
    c.blocks = c.blocks.filter((x) => x !== b)
    if (c.end) c.end.tail = c.end.tail.filter((x) => x !== b)
  }
}

// 필수만으로 본문 합계를 넘을 때: 상자 4번 줄 → 3번 줄 → 필수 기록 블록 line 형태(18 §6.1 BC3), 늦은 것부터
function shrinkMandatory(m: Model): boolean {
  const all = m.chapters.flatMap(counted).reverse()
  const f0 = all.find((b): b is ForkBlk => b.kind === 'fork' && b.level === 0 && b.follow.length > 0)
  if (f0) {
    f0.level = 1
    return true
  }
  const f1 = all.find((b): b is ForkBlk => b.kind === 'fork' && b.level < 2 && !!b.rec.detail)
  if (f1) {
    f1.level = 2
    return true
  }
  const e = all.find((b): b is EntryBlk => b.kind === 'entry' && b.form < 2 && b.body !== sentence(nfc(b.rec.line)))
  if (e) {
    e.form = 2
    return true
  }
  return false
}

// ── 블록 변환(18 §5) ──

const LINE_ONLY = (r: Rec): boolean =>
  r.tag === 'check' || r.tag === 'injury' || (r.tag === 'trait' && r.sub === 'trait_react') || (r.tag === 'growth' && r.sub === 'age')

// 18 §5.1: detail / detail + 공백 + line. / line. 120자를 넘으면 detail만, 그래도 넘으면 line.
function entryBody(input: BookInput, b: EntryBlk, head: string): string {
  const r = b.rec
  const lineForm = sentence(nfc(r.line))
  if (!r.detail || LINE_ONLY(r)) return lineForm
  const detail = nfc(r.detail)
  const extra = input.proper_names.some((n) => r.line.includes(n) && !r.detail!.includes(n))
  const forms = [b.detailOnly || !extra ? detail : `${detail} ${lineForm}`, detail, lineForm]
  for (let f = b.form; f < 3; f++) if (len(head + forms[f]!) <= BOOK_LIMITS.block) return forms[f]!
  return lineForm
}

function entryForms(r: Rec): string[] {
  const lineForm = sentence(nfc(r.line))
  if (!r.detail) return [lineForm]
  const detail = nfc(r.detail)
  return [detail, `${detail} ${lineForm}`, lineForm]
}

function forkLines(input: BookInput, b: ForkBlk): string[] {
  const r = b.rec
  const name = r.refs?.event_id !== undefined ? (input.events[r.refs.event_id]?.name ?? '') : ''
  const out = [`${FRAME.fork} · ${name} · ${ageWord(r.age)} ${SEASON_WORDS[r.season]}`, sentence(nfc(r.line))]
  if (b.level < 2 && r.detail && r.tag !== 'check' && !r.check && len(r.detail) <= BOOK_LIMITS.block) out.push(nfc(r.detail))
  if (b.level < 1) {
    for (const f of b.follow) {
      const text = entryBody(input, newFollow(f), '')
      if (len(text) <= BOOK_LIMITS.block) out.push(text)
    }
  }
  const nt = r.refs?.not_taken ?? []
  if (nt.length) out.push(`${FRAME.notTaken} · ${nt.map(nfc).join(' · ')}`)
  if (r.refs?.by_policy && !out.slice(1, 3).some((l) => l.includes(FRAME.byPolicyMark))) out.push(FRAME.byPolicy)
  return out
}

const newFollow = (rec: Rec): EntryBlk =>
  ({ kind: 'entry', rec, mand: true, score: 0, exempt: new Set(), nohead: true, out: [], body: '', form: 0, detailOnly: false })

// 여는 문장의 주된 태도: 그 장에서 가장 오래 유지된 태도, 동률이면 장 끝의 태도(18 §5.4)
function dominantCol(input: BookInput, sel: Selection, c: Chap): number {
  const dur = new Map<string, number>()
  let last: string | null = null
  for (const s of sel.segs) {
    const d = Math.min(s.to, c.effTo) - Math.max(s.from, c.effFrom)
    if (d <= 0 && !(s.from <= c.effFrom && c.effFrom <= s.to)) continue
    dur.set(s.attitude, (dur.get(s.attitude) ?? 0) + Math.max(0, d))
    last = s.attitude
  }
  let best: string | null = null
  for (const [a, d] of dur) if (best === null || d > dur.get(best)! || (d === dur.get(best)! && a === last)) best = a
  return best !== null ? (input.attitude_cols[best] ?? 0) : 0
}

interface Rendered {
  book: Book
  openers: Map<Chap, string>
  closings: Map<Chap, string>
  bodyChars: number
  epigraphSrc: number | null
}

function renderChapter(input: BookInput, sel: Selection, c: Chap, n: number, subtitle: string, r: Rendered): BookChapter {
  const blocks: BookBlock[] = []
  if (c.openerOn && c.stage >= 0 && (isBody(c) || c.key === 'short')) {
    const text = c.stage === 4 ? bk(input, 13) : bk(input, 1 + c.stage * 3 + dominantCol(input, sel, c))
    r.openers.set(c, text)
    blocks.push({ kind: 'opener', text, src: [] })
  }
  let prev: { age: number; season: Rec['season'] } | null = null
  for (const b of c.blocks) {
    const { age, season } = ageSeason(b)
    if (b.kind === 'entry') {
      const noHead = b.nohead || (b.rec.tag === 'growth' && b.rec.sub === 'age')
      const full = `${ageWord(age)} ${SEASON_WORDS[season]}, `
      const head = noHead ? '' : !prev ? full : prev.age === age && prev.season === season ? '' : prev.age === age ? `${FRAME.sameYear} ${SEASON_WORDS[season]}, ` : full
      b.body = entryBody(input, b, head)
      b.out = [head + b.body]
      blocks.push({ kind: 'entry', text: b.out[0]!, src: [b.rec.id] })
    } else if (b.kind === 'fork') {
      b.out = forkLines(input, b)
      b.body = b.out.join(' ')
      blocks.push({ kind: 'fork', lines: [...b.out], src: [b.rec.id, ...(b.level < 1 ? b.follow.map((f) => f.id) : [])] })
    } else {
      const col = input.attitude_cols[b.mark.attitude] ?? 0
      b.body = bk(input, 14 + col, { age_word: ageWord(age), season: SEASON_WORDS[season] })
      b.out = [b.body]
      blocks.push({ kind: 'attitude', text: b.body, src: [] })
    }
    prev = { age, season }
  }
  const end = c.end
  if (end) {
    if (end.quote) blocks.push({ kind: 'quote_last', text: sentence(nfc(end.quote.line)), src: [end.quote.id] })
    for (const t of end.tail) {
      t.body = entryBody(input, t, '')
      t.out = [t.body]
      blocks.push({ kind: 'entry', text: t.body, src: [t.rec.id] })
    }
    if (end.letter?.detail) blocks.push({ kind: 'letter', lines: nfc(end.letter.detail).split('\n'), src: [end.letter.id] })
    if (end.closingOn) {
      const text = c.key === 'short' && input.end_kind === 'retired' ? bk(input, 24) : bk(input, 21 + endNo(input))
      r.closings.set(c, text)
      blocks.push({ kind: 'closing', text, src: [] })
    }
  }
  const head = c.key === 'close' ? `${FRAME.closingHead} · ${bk(input, 17 + endNo(input))}`
    : c.key === 'short' ? bk(input, 20)
    : `${n}장 · ${FRAME.stages[c.stage] ?? FRAME.stages[0]}`
  let ageFrom = c.ageFrom
  if (c.key === 'close') {
    const firstBlock = c.blocks[0]
    ageFrom = end?.mergedOld ? end.oldFrom : firstBlock ? ageSeason(firstBlock).age : input.end_age
  }
  return { key: c.key, head, subtitle, age_from: ageFrom, age_to: c.key === 'close' || c.key === 'short' ? input.end_age : c.ageTo, blocks }
}

// 장 부제(18 §3.2): 6순위 중 처음 해당하고, 16자 이하이며, 이 책에서 아직 쓰지 않은 것
function subtitleOf(input: BookInput, sel: Selection, c: Chap, used: Set<string>): string {
  const recs = c.blocks.flatMap((b) => (b.kind === 'entry' ? [b.rec] : b.kind === 'fork' ? [b.rec, ...b.follow] : []))
  const evName = (r: Rec): string => (r.refs?.event_id !== undefined ? (input.events[r.refs.event_id]?.name ?? '') : '')
  const byKind = (kinds: readonly string[]) => recs.filter((r) => { const k = kindOf(input, r); return k !== undefined && kinds.includes(k) }).map(evName)
  const places = recs.map((r) => r.refs?.location_id).filter((x): x is string => x !== undefined)
  const counts = new Map<string, number>()
  for (const p of places) counts.set(p, (counts.get(p) ?? 0) + 1)
  let most: string | null = null
  for (const p of places) if ((counts.get(p) ?? 0) >= 2 && (most === null || counts.get(p)! > counts.get(most)!)) most = p
  const stageDefault = c.stage >= 0 ? [bk(input, 28 + Math.min(c.stage, 4))] : []
  const ranks: string[][] = [
    byKind(['chain_fork', 'chain_last']),
    byKind(['fate']),
    recs.filter((r) => r.tag === 'discovery' && r.sub === 'family_first' && r.refs?.location_id).map((r) => input.place_names[r.refs!.location_id!] ?? ''),
    input.spec_label && recs.some((r) => r.id === sel.lastSpec) ? [`${input.spec_label}의 길`] : [],
    most ? [input.place_names[most] ?? ''] : [],
    stageDefault,
  ]
  for (const list of ranks) {
    for (const raw of list) {
      const s = nfc(raw)
      if (s && len(s) <= BOOK_LIMITS.subtitle && !used.has(s)) {
        used.add(s)
        return s
      }
    }
  }
  return ''
}

// 제사(18 §3.2): 본문 장 블록(상자 안 포함)의 큰따옴표 인용을 점수 높은 순, 동률이면 늦은 순으로. 80자 이하 첫 인용
function epigraphOf(input: BookInput, sel: Selection, m: Model): Book['epigraph'] {
  const recs = m.chapters.filter((c) => isBody(c) || c.key === 'short').flatMap((c) => c.blocks)
    .flatMap((b) => (b.kind === 'entry' ? [b.rec] : b.kind === 'fork' ? [b.rec, ...b.follow] : []))
  const sorted = [...recs].sort((a, b) => (sel.score.get(b.id) ?? 1) - (sel.score.get(a.id) ?? 1) || byTime(b, a))
  for (const r of sorted) {
    const q = r.detail ? firstQuote(nfc(r.detail)) : null
    if (q === null || len(q) > BOOK_LIMITS.epigraph) continue
    const text = `"${q}"`
    if (bc4Hit(text)) continue
    const npc = r.refs?.npc_id
    return { text, speaker: npc !== undefined ? (input.npc_names[npc] ?? null) : null, src_id: r.id }
  }
  return { text: bk(input, 25 + endNo(input)), speaker: null, src_id: null }
}

// 뒷표지 3줄(18 §3.1). 2줄: 가장 늦은 갈림길 결과 → 제사 출처가 아닌 최고 점수 본문 블록 → BM1의 line
function backLines(input: BookInput, l2: string): Book['back'] {
  const l1 = `${input.generation}대 ${input.name} · ${input.time.start_age}~${input.end_age}세 · ${endWord(input)}`
  const names = input.relic_names
  let l3 = `${FRAME.left}: ${names.length ? names.join(', ') : input.empty_pack}`
  if (len(l3) > BOOK_LIMITS.back && names.length) l3 = `${FRAME.left}: ${names[0]}`
  return [l1, nfc(l2), l3]
}

function backOf(input: BookInput, sel: Selection, m: Model, epigraphSrc: number | null): Book['back'] {
  const blocks = m.chapters.flatMap((c) => c.blocks)
  const forks = blocks.filter((b): b is ForkBlk => b.kind === 'fork').sort((a, b) => b.rec.id - a.rec.id)
  const entries = m.chapters.filter((c) => isBody(c) || c.key === 'short').flatMap((c) => c.blocks)
    .filter((b): b is EntryBlk => b.kind === 'entry' && b.rec.id !== epigraphSrc)
    .sort((a, b) => b.score - a.score || byTime(a.rec, b.rec))
  const bm1 = sel.S.find((e) => e.id === sel.bm1[0])
  return backLines(input, forks[0]?.rec.line ?? entries[0]?.rec.line ?? bm1?.line ?? '')
}

// 부록(18 §3.5): 데이터를 그대로 옮긴다. 줄 수·글자 수가 넘으면 인연 기록은 늦은 것부터, 가문 업적은 번호가 큰 것부터 뺀다
function appendixOf(input: BookInput, diag: string[]): Book['appendix'] {
  const src = input.appendix
  const people = [...src.people]
  const achievements = [...src.achievements]
  const left = (): string[] => [
    ...src.relics,
    ...(src.keepsakes.length ? [`${FRAME.keepsakes} · ${src.keepsakes.join(', ')}`] : []),
    ...src.unfinished,
    ...(achievements.length ? [`${FRAME.achievements} · ${achievements.join(', ')}`] : []),
  ]
  const walk = [...src.walk, ...src.cause]
  const chars = (): number => [...people.map((p) => p.text), ...left(), ...walk].reduce((n, s) => n + len(s), 0)
  const dropBond = (): boolean => {
    for (let i = people.length - 1; i >= 0; i--) {
      if (!people[i]!.bond) continue
      people.splice(i, 1)
      return true
    }
    return false
  }
  while (people.length > BOOK_LIMITS.people && dropBond());
  while (left().length > BOOK_LIMITS.left && achievements.length) achievements.pop()
  while (chars() > BOOK_LIMITS.appendix && (dropBond() || achievements.pop() !== undefined));
  const out = { people: people.map((p) => nfc(p.text)), left: left().map(nfc), walk: walk.map(nfc) }
  if (out.people.length > BOOK_LIMITS.people || out.left.length > BOOK_LIMITS.left || out.walk.length > BOOK_LIMITS.walk || chars() > BOOK_LIMITS.appendix) diag.push('BC3:appendix')
  return out
}

function spineOf(chars: number): Book['cover']['spine'] {
  return SPINE_EDGES.find(([edge]) => chars < edge)?.[1] ?? 'thick'
}

function coverOf(input: BookInput, spine: Book['cover']['spine']): Book['cover'] {
  return {
    family: input.family, volume: input.generation, title: nfc(input.epithet),
    subtitle: `${input.time.start_age}~${input.end_age}세 · ${endWord(input)}`,
    end_kind: input.end_kind, emblem: input.end_kind === 'retired' ? 'lamp_lit' : input.end_kind === 'died' ? 'lamp_out' : 'moon', spine,
  }
}

const blockChars = (b: BookBlock): number => (b.lines ? b.lines.reduce((n, l) => n + len(l), 0) : len(b.text ?? ''))

function render(input: BookInput, sel: Selection, m: Model, appendix: Book['appendix']): Rendered {
  const r: Rendered = { book: null as unknown as Book, openers: new Map(), closings: new Map(), bodyChars: 0, epigraphSrc: null }
  const used = new Set<string>()
  let n = 0
  const chapters = m.chapters.map((c) => {
    const sub = isBody(c) || c.key === 'short' ? subtitleOf(input, sel, c, used) : ''
    if (isBody(c)) n += 1
    return renderChapter(input, sel, c, n, sub, r)
  })
  r.bodyChars = chapters.reduce((s, c) => s + c.blocks.reduce((t, b) => t + blockChars(b), 0), 0)
  const epigraph = epigraphOf(input, sel, m)
  r.epigraphSrc = epigraph.src_id
  r.book = {
    gen_version: input.gen_version,
    binder: input.binder,
    back: backOf(input, sel, m, epigraph.src_id),
    opened: false,
    fallback: false,
    diag: [...m.diag],
    cover: coverOf(input, spineOf(r.bodyChars)),
    epigraph,
    chapters,
    appendix,
    afterword: null,
    received_by: null,
  }
  return r
}

export const bookBytes = (book: Book): number => utf8(canonicalJson(book)).length

// ── 검사·수리(18 §6.1·§6.2) ──

type Fix = () => void

function once(m: Model, key: string, diag = key): Fix {
  return () => {
    m.exempt.add(key)
    m.diag.push(diag)
  }
}

function exemptBlk(m: Model, b: Blk, code: string, note = ''): Fix {
  return () => {
    b.exempt.add(code)
    m.diag.push(`${code}:${b.kind === 'attitude' ? 'attitude' : b.rec.id}${note ? `:${note}` : ''}`)
  }
}

function violation(input: BookInput, sel: Selection, m: Model, r: Rendered): Fix | null {
  const book = r.book
  const blocksAll = m.chapters.flatMap(counted)

  // BC1 빈 장
  for (const c of m.chapters) {
    if (!isBody(c) || c.blocks.length > 0 || m.exempt.has(`BC1:${c.key}`)) continue
    const bodies = m.chapters.filter(isBody)
    if (bodies.length < 2) return once(m, `BC1:${c.key}`)
    const i = bodies.indexOf(c)
    const into = bodies[i + 1] ?? bodies[i - 1]!
    return () => {
      const merged = mergeChapters(m.chapters.filter(isBody), c, into)
      m.chapters = [...merged, ...m.chapters.filter((x) => !isBody(x))]
    }
  }

  // BC2 중복
  const seen = new Set<string>()
  for (const b of blocksAll) {
    if (b.exempt.has('BC2')) continue
    const k = bareText(b.body)
    if (!k) continue
    if (seen.has(k)) {
      if (!b.mand) return () => removeBlock(m, b)
      if (b.kind === 'entry' && b.form < 2 && b.body !== sentence(nfc(b.rec.line))) return () => void (b.form = 2)
      return exemptBlk(m, b, 'BC2')
    }
    seen.add(k)
  }

  // BC3 길이
  for (const b of blocksAll) {
    const max = b.kind === 'attitude' ? BOOK_LIMITS.bk : BOOK_LIMITS.block
    if (b.exempt.has('BC3') || !b.out.some((l) => len(l) > max)) continue
    if (b.kind === 'entry' && b.form < 2) return () => void (b.form = (b.form + 1) as 1 | 2)
    if (b.kind === 'fork' && b.level < 2) return () => void (b.level = (b.level + 1) as 1 | 2)
    return exemptBlk(m, b, 'BC3')
  }
  for (const [c, text] of [...r.openers, ...r.closings]) {
    if (len(text) > BOOK_LIMITS.bk && !m.exempt.has(`BC3:bk:${c.key}`)) return once(m, `BC3:bk:${c.key}`)
  }
  for (const ch of book.chapters) {
    for (const b of ch.blocks) {
      if ((b.kind === 'quote_last' || b.kind === 'letter') && (b.lines ?? [b.text ?? '']).some((l) => len(l) > BOOK_LIMITS.block) && !m.exempt.has(`BC3:${b.kind}`)) {
        return once(m, `BC3:${b.kind}`)
      }
    }
  }
  for (const c of m.chapters) {
    const list = counted(c)
    if (list.length > Math.max(BOOK_LIMITS.chapterBlocks, list.filter((b) => b.mand).length) && !m.exempt.has(`BC3:count:${c.key}`)) {
      return c.blocks.some((b) => !b.mand) ? () => void removeLowest(m, c) : once(m, `BC3:count:${c.key}`)
    }
  }
  if (blocksAll.length > Math.max(BOOK_LIMITS.bookBlocks, blocksAll.filter((b) => b.mand).length) && !m.exempt.has('BC3:books')) {
    return blocksAll.some((b) => !b.mand) ? () => void removeLowest(m, null) : once(m, 'BC3:books')
  }
  if (r.bodyChars > BOOK_LIMITS.body && !m.exempt.has('BC3:body')) {
    return () => { if (!removeLowest(m, null) && !shrinkMandatory(m)) once(m, 'BC3:body')() }
  }
  if (len(book.cover.title) > BOOK_LIMITS.title && !m.exempt.has('BC3:title')) return once(m, 'BC3:title')
  if (book.back.some((l) => len(l) > BOOK_LIMITS.back) && !m.exempt.has('BC3:back')) return once(m, 'BC3:back')

  // BC4 금지 표현
  for (const b of blocksAll) {
    if (b.exempt.has('BC4')) continue
    const hit = b.out.map((l) => bc4Hit(l)).find((h) => h !== null)
    if (!hit) continue
    if (b.kind === 'attitude') return () => removeBlock(m, b) // 틀 문장: 그 문장을 지운다
    if (b.kind === 'entry' && b.form < 2 && b.body !== sentence(nfc(b.rec.line))) return () => void (b.form = 2)
    if (b.kind === 'fork' && b.level < 2) return () => void (b.level = 2)
    if (!b.mand) return () => removeBlock(m, b)
    return exemptBlk(m, b, 'BC4', hit)
  }
  for (const [c, text] of r.openers) if (c.openerOn && bc4Hit(text)) return () => void (c.openerOn = false)
  for (const [c, text] of r.closings) if (c.end?.closingOn && bc4Hit(text)) return () => void (c.end!.closingOn = false)
  for (const ch of book.chapters) {
    for (const b of ch.blocks) {
      if (b.kind !== 'quote_last' && b.kind !== 'letter') continue
      const hit = (b.lines ?? [b.text ?? '']).map((l) => bc4Hit(l, b.kind === 'letter')).find((h) => h !== null)
      if (hit && !m.exempt.has(`BC4:${b.kind}`)) return once(m, `BC4:${b.kind}`, `BC4:${b.kind}:${hit}`)
    }
  }
  const causeRows = new Set(input.appendix.cause.map(nfc)) // 걸어온 길의 원인 줄은 BC4를 검사하지 않는다
  const appx = [...book.appendix.people, ...book.appendix.left, ...book.appendix.walk.filter((l) => !causeRows.has(l)), ...book.back, book.cover.title]
  for (const line of appx) {
    const hit = bc4Hit(line)
    if (hit && !m.exempt.has(`BC4:appx:${line}`)) return once(m, `BC4:appx:${line}`, `BC4:appendix:${hit}`)
  }

  // BC5 필수 누락(상자 흡수는 실린 것)
  const present = new Set(blocksAll.flatMap((b) => (b.kind === 'entry' ? [b.rec.id] : b.kind === 'fork' ? [b.rec.id, ...b.follow.map((f) => f.id)] : [])))
  for (const id of [...sel.mand, ...sel.forks.keys()]) {
    if (present.has(id) || sel.absorbed.has(id) || m.exempt.has(`BC5:${id}`)) continue
    const rec = sel.S.find((e) => e.id === id)
    if (!rec) continue
    return () => {
      m.exempt.add(`BC5:${id}`)
      const blk = newEntry(sel, rec, true)
      blk.form = 2
      const target = m.chapters.find((c) => (isBody(c) || c.key === 'short') && rec.eff_min >= c.effFrom && rec.eff_min < c.effTo)
        ?? m.chapters.find((c) => c.key === 'close') ?? m.chapters.at(-1)!
      target.blocks = [...target.blocks, blk].sort(blkCmp)
    }
  }

  // BC6 순서
  if (!m.exempt.has('BC6')) {
    const seq = m.chapters.flatMap((c) => c.blocks)
    for (let i = 1; i < seq.length; i++) {
      if (effc(keyOf(seq[i]!).eff_min) >= effc(keyOf(seq[i - 1]!).eff_min)) continue
      const unsorted = m.chapters.some((c) => c.blocks.some((b, j) => j > 0 && blkCmp(c.blocks[j - 1]!, b) > 0))
      if (unsorted) return () => { for (const c of m.chapters) c.blocks.sort(blkCmp); m.diag.push('BC6:resort') }
      return once(m, 'BC6', 'BC6:order')
    }
    const bodies = book.chapters.filter((c) => BODY_KEYS.includes(c.key))
    for (let i = 1; i < bodies.length; i++) if (bodies[i]!.age_from < bodies[i - 1]!.age_to) return once(m, 'BC6', 'BC6:age')
  }

  // BC7 원문 불변: 기록 블록 본문은 세 형태 중 하나
  for (const b of blocksAll) {
    if (b.kind !== 'entry' || b.exempt.has('BC7')) continue
    if (entryForms(b.rec).includes(b.body)) continue
    return b.form < 2 ? () => void (b.form = 2) : exemptBlk(m, b, 'BC7')
  }

  // BC8 용량: 직렬화 크기 + 후기 예약 1.2KB ≤ 20KB
  if (bookBytes(book) + BOOK_LIMITS.afterwordReserve > BOOK_LIMITS.bytes && !m.exempt.has('BC8')) {
    return () => { if (!removeLowest(m, null) && !shrinkMandatory(m)) once(m, 'BC8')() }
  }
  return null
}

// ── 최소 책(18 §6.2) ──

function safe<T>(f: () => T, fallback: T): T {
  try {
    return f()
  } catch {
    return fallback
  }
}

export function minimalBook(input: BookInput, diag: string[], sel: Selection | null = null): Book {
  const s = sel ?? safe(() => select(input), null)
  const recs = s ? [...new Set([...s.mand, ...s.forks.keys()])].map((id) => s.S.find((e) => e.id === id)).filter((e): e is Rec => e !== undefined).sort(byTime) : []
  const blocks: BookBlock[] = recs.map((r) => ({ kind: 'entry', text: `${ageWord(r.age)} ${SEASON_WORDS[r.season]}, ${sentence(nfc(r.line))}`, src: [r.id] }))
  if (s?.quote) blocks.push({ kind: 'quote_last', text: sentence(nfc(s.quote.line)), src: [s.quote.id] })
  if (s?.letter?.detail) blocks.push({ kind: 'letter', lines: nfc(s.letter.detail).split('\n'), src: [s.letter.id] })
  const closing = safe(() => bk(input, 21 + endNo(input)), null)
  if (closing) blocks.push({ kind: 'closing', text: closing, src: [] })
  const d = [...diag]
  const appendix = safe(() => appendixOf(input, d), { people: [], left: [], walk: [] })
  const chars = blocks.reduce((n, b) => n + blockChars(b), 0)
  return {
    gen_version: input.gen_version,
    binder: input.binder,
    back: safe(() => backLines(input, s?.S.find((e) => e.id === s.bm1[0])?.line ?? recs[0]?.line ?? ''), ['', '', '']),
    opened: false,
    fallback: true,
    diag: d,
    cover: safe(() => coverOf(input, spineOf(chars)), {
      family: input.family, volume: Math.max(1, input.generation), title: input.epithet, subtitle: '', end_kind: input.end_kind, emblem: 'lamp_lit', spine: 'thin',
    }),
    epigraph: { text: safe(() => bk(input, 25 + endNo(input)), ''), speaker: null, src_id: null },
    chapters: [{ key: 'fallback', head: FRAME.fallbackHead, subtitle: '', age_from: input.time.start_age, age_to: input.end_age, blocks }],
    appendix,
    afterword: null,
    received_by: null,
  }
}

// ── 엮기 ──

function compileInner(input: BookInput): Book {
  const sel = select(input)
  const model = buildModel(input, sel)
  const appendixDiag: string[] = []
  const appendix = appendixOf(input, appendixDiag)
  model.diag.push(...appendixDiag)
  for (let i = 0; i < BOOK_LIMITS.repairs; i++) {
    const r = render(input, sel, model, appendix)
    const fix = violation(input, sel, model, r)
    if (!fix) return r.book
    fix()
  }
  return minimalBook(input, [...model.diag, `BC:repair>${BOOK_LIMITS.repairs}`], sel)
}

// 생애의 책을 엮는다(18 §4.4 compile_book). 예외가 나면 최소 책을 쓰고 계승을 계속한다(§6.2)
export function compileBook(input: BookInput): Book {
  try {
    return compileInner(input)
  } catch (e) {
    return minimalBook(input, [`EXC:${e instanceof Error ? e.message : String(e)}`])
  }
}
