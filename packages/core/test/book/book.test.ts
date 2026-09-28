// 생애의 책(18): 엮기·검사·봉인과 덧붙임. 여러 생애의 책이 BC1~BC8을 통과하고, 같은 저장이면 같은 책이 나온다(§12).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  BOOK_LIMITS, ageWord, attitudeSegments, bc4Hit, bkId, bookBytes, bookInput, bookOf, canonicalJson, compileBook, isBook,
  loadSave, makeSaveRoot, markBookOpened, pendingSuccession, serializeSave, setBookAfterword, setBookReceivedBy, succeed,
  type Book, type BookInput, type World,
} from '../../src/index'
import { baseContent, makeGame, run } from '../integration/life-fixture'
import { roundTrip } from '../offline/fixture'

const seedOf = (n: number) => (0x3000 + n).toString(16).padStart(16, '0')
const COUNTED = ['entry', 'fork', 'attitude']
const HEAD = /^[^,]{2,12} (봄|여름|가을|겨울), /
const len = (s: string) => [...s].length
const textsOf = (b: Book['chapters'][number]['blocks'][number]) => b.lines ?? [b.text ?? '']

// 18 §12 검증 항목을 코드와 따로 다시 잰다
function checkBook(book: Book, where: string): void {
  assert.ok(isBook(book), `${where}: 18 §7.1 모양이 아니다`)
  assert.equal(book.fallback, false, `${where}: 최소 책(${book.diag.join(',')})`)
  assert.deepEqual(book.diag, [], `${where}: 진단 ${book.diag.join(',')}`)
  const counted = book.chapters.flatMap((c) => c.blocks.filter((b) => COUNTED.includes(b.kind)))
  assert.ok(counted.length <= BOOK_LIMITS.bookBlocks, `${where}: 블록 ${counted.length}개`)
  for (const c of book.chapters) {
    const n = c.blocks.filter((b) => COUNTED.includes(b.kind)).length
    assert.ok(n <= BOOK_LIMITS.chapterBlocks, `${where}: ${c.head} 블록 ${n}개`)
    if (c.key !== 'close' && c.key !== 'fallback') assert.ok(n > 0, `${where}: 빈 장 ${c.head}`) // BC1
    assert.ok(len(c.subtitle) <= BOOK_LIMITS.subtitle, `${where}: 부제 ${c.subtitle}`)
    for (const b of c.blocks) {
      const max = b.kind === 'attitude' || b.kind === 'opener' || b.kind === 'closing' ? BOOK_LIMITS.bk : BOOK_LIMITS.block
      for (const t of textsOf(b)) {
        assert.ok(len(t) <= max, `${where}: ${b.kind} ${len(t)}자 ${t}`) // BC3
        assert.equal(bc4Hit(t, b.kind === 'letter'), null, `${where}: 금지 표현 ${t}`) // BC4
      }
    }
  }
  // BC2: 머리를 뺀 기록 본문이 겹치지 않는다
  const bare = counted.map((b) => textsOf(b).join(' ').replace(HEAD, '').replace(/[\s\p{P}\p{S}]/gu, ''))
  assert.equal(new Set(bare).size, bare.length, `${where}: 중복 블록`)
  // BC6: 본문 장 나이 구간이 거꾸로 가지 않는다
  const bodies = book.chapters.filter((c) => ['ch1', 'ch2', 'ch3', 'ch4', 'moon'].includes(c.key))
  for (let i = 1; i < bodies.length; i++) assert.ok(bodies[i]!.age_from >= bodies[i - 1]!.age_to, `${where}: 장 나이 역행`)
  const bodyChars = book.chapters.reduce((s, c) => s + c.blocks.reduce((t, b) => t + textsOf(b).reduce((u, x) => u + len(x), 0), 0), 0)
  assert.ok(bodyChars <= BOOK_LIMITS.body, `${where}: 본문 ${bodyChars}자`)
  assert.ok(bookBytes(book) + BOOK_LIMITS.afterwordReserve <= BOOK_LIMITS.bytes, `${where}: ${bookBytes(book)}B`) // BC8
  for (const l of book.back) assert.ok(len(l) <= BOOK_LIMITS.back, `${where}: 뒷표지 ${l}`)
  assert.ok(len(book.epigraph.text) <= BOOK_LIMITS.epigraph + 2, `${where}: 제사 ${book.epigraph.text}`)
  // 맺는 장: 수첩 마지막 줄과 닫는 문장
  const last = book.chapters.at(-1)!
  assert.ok(last.key === 'close' || last.key === 'short', `${where}: 마지막 장 ${last.key}`)
  assert.ok(last.blocks.some((b) => b.kind === 'quote_last'), `${where}: 수첩 마지막 줄이 없다`)
  assert.equal(last.blocks.at(-1)!.kind, 'closing', `${where}: 닫는 문장이 없다`)
  assert.ok(book.appendix.people.length <= BOOK_LIMITS.people && book.appendix.left.length <= BOOK_LIMITS.left && book.appendix.walk.length <= BOOK_LIMITS.walk)
}

// 계승 대기(자동 계승 끔)까지 한 생애를 돈다
function oneLife(seed: string, attitude?: string, lethal?: boolean): World {
  const w = makeGame({ seed, ...(attitude ? { attitude } : {}), ...(lethal !== undefined ? { lethal } : {}) })
  run(w, { steps: 1600 })
  assert.equal(w.state.current_activity.state, 'awaiting_succession', `${seed} 계승 대기에 닿지 않았다`)
  return w
}

const bookOfLife = (w: World, gen = 1): Book => {
  const b = bookOf(w.state.family.chronicle[gen - 1]!)
  assert.ok(b, `${gen}대 책이 없다`)
  return b
}

describe('문장 도구(18 §5.2·§5.4)', () => {
  it('{age_word} 18~118세', () => {
    const cases: [number, string][] = [[18, '열여덟 살'], [20, '스무 살'], [21, '스물한 살'], [30, '서른 살'], [63, '예순세 살'], [98, '아흔여덟 살'], [100, '백 살'], [108, '백여덟 살'], [118, '백열여덟 살']]
    for (const [age, word] of cases) assert.equal(ageWord(age), word)
  })

  it('태도 구간 합치기: 1년 미만 구간은 앞(첫 구간이면 다음)에 합치고 같은 태도를 잇는다', () => {
    // 예 1: 안정 0~100 · 모험 100~105 · 안정 105~600 → 안정 0~600
    assert.deepEqual(attitudeSegments([{ eff_min: 0, attitude: 's' }, { eff_min: 100, attitude: 'a' }, { eff_min: 105, attitude: 's' }], 600, 12),
      [{ from: 0, to: 600, attitude: 's' }])
    // 예 2: 모험 0~5 · 안정 5~600 → 안정 0~600(시작 태도가 안정이므로 문장 없음)
    assert.deepEqual(attitudeSegments([{ eff_min: 0, attitude: 'a' }, { eff_min: 5, attitude: 's' }], 600, 12), [{ from: 0, to: 600, attitude: 's' }])
    assert.equal(attitudeSegments([{ eff_min: 0, attitude: 'a' }, { eff_min: 200, attitude: 's' }], 600, 12).length, 2)
  })

  it('BK01~BK34는 가장 긴 대입(이름 6자·백열여덟 살·가장 긴 엮은 사람)에서 60자 이하이고 금지 표현이 없다(V22)', () => {
    const content = baseContent()
    const binder = content.list('npc').map((n) => n.name).sort((a, b) => len(b) - len(a))[0]!
    for (let n = 1; n <= 34; n++) {
      assert.ok(content.has('text', bkId(n)), `${bkId(n)}이 없다`)
      const t = content.get('text', bkId(n)).variants[0]!
      const out = t.replace(/\{name(:[^}]+)?\}/g, '각각각각각각은').replace('{age_word}', '백열여덟 살').replace('{season}', '여름').replace(/\{binder(:[^}]+)?\}/g, `${binder}이`)
      assert.ok(len(out) <= 60, `${bkId(n)} ${len(out)}자`)
      assert.equal(bc4Hit(out), null, `${bkId(n)} 금지 표현`)
    }
  })

  it('BC4 패턴: 18 §6.1 통과·반려 예', () => {
    assert.equal(bc4Hit('여울 늑대가 꼬리를 말고 달아났다.'), null)
    assert.equal(bc4Hit('잔을 받은 뒤로 모라의 얼굴은 더 늙지 않았다.'), null)
    assert.equal(bc4Hit('… "이 빚은 꼭 갚을게요. 당신 가문에라도."'), null)
    assert.equal(bc4Hit('여울 늑대를 죽였다.'), '죽였')
    assert.equal(bc4Hit('주사위 9 + 의지 4 + 행운 1 = 14 / 난이도 15.'), '주사위 9')
    assert.equal(bc4Hit('모라는 당신의 결정을 기다린다.'), '당신')
    assert.equal(bc4Hit('{name}', true), '{')
  })
})

describe('생애의 책 엮기(18 §12)', () => {
  it('여러 생애의 책이 모두 엮이고 BC1~BC8을 통과한다(최소 책 0, 20KB 이하)', () => {
    let books = 0
    for (const attitude of ['stable', 'adventurous', 'challenging']) {
      for (let i = 0; i < 3; i++) {
        const w = makeGame({ seed: seedOf(i), attitude, autoSuccession: true, lethal: attitude === 'challenging' })
        run(w, { steps: 3000, until: (x) => x.state.family.generation >= 3 })
        assert.ok(w.state.family.chronicle.length >= 2, `${attitude} #${i} 생애 ${w.state.family.chronicle.length}개`)
        for (const r of w.state.family.chronicle) {
          const b = bookOf(r)
          assert.ok(b, `${attitude} #${i} ${r.gen}대 책이 없다`)
          checkBook(b, `${attitude} #${i} ${r.gen}대(${r.end_kind})`)
          assert.equal(b.cover.volume, r.gen)
          assert.equal(b.cover.title, r.epithet)
          // 5단계 출발 때 받은 사람이 채워진다(18 §7.2)
          const next = r.gen < w.state.family.generation
          if (next) assert.equal(b.received_by?.gen, r.gen + 1)
          books += 1
        }
      }
    }
    assert.ok(books >= 18)
  })

  it('은퇴 책: 켜진 등불, 맺는 장 `마지막 귀환`, 닫는 문장 BK21, 봉인 직후 책 기록 BK33·BK34', () => {
    const w = oneLife(seedOf(1))
    const r = w.state.family.chronicle[0]!
    const b = bookOfLife(w)
    checkBook(b, '은퇴')
    assert.equal(r.end_kind, 'retired')
    assert.equal(b.cover.emblem, 'lamp_lit')
    assert.equal(b.cover.subtitle, `18~${r.end_age}세 · 은퇴`)
    assert.equal(b.binder, '미루')
    assert.equal(b.back[0], `1대 ${r.name} · 18~${r.end_age}세 · 은퇴`)
    const close = b.chapters.at(-1)!
    assert.equal(close.head, '맺는 장 · 마지막 귀환')
    assert.equal(close.blocks.at(-1)!.text, '다음 장은 다음 사람이 쓸 것이다.')
    assert.equal(b.afterword, null)
    assert.equal(b.received_by, null)
    // 운명 사건 결과는 갈림길 상자로 싣고, 가지 않은 길을 보인다
    const forks = b.chapters.flatMap((c) => c.blocks.filter((x) => x.kind === 'fork'))
    assert.ok(forks.length >= 1, '갈림길 상자가 없다')
    assert.ok(forks.every((f) => f.lines![0]!.startsWith('갈림길 · ')))
    assert.ok(forks.some((f) => f.lines!.some((l) => l.startsWith('가지 않은 길 · '))))
    // 부록: 동반자·자녀, 걸어온 길의 은퇴 역할
    assert.ok(b.appendix.walk.some((l) => l.startsWith('은퇴 뒤 · ')))
    // 2단계 4번: [가문] 한 생애가 책 한 권으로 엮였다
    const note = w.state.journal.find((e) => e.tag === 'house' && e.line === '한 생애가 책 한 권으로 엮였다')
    assert.ok(note, '책 기록 BK33이 없다')
    assert.equal(note.char_uid, r.char_uid)
    assert.equal(note.detail, `미루가 수첩에서 ${r.name}의 몫을 옮겨 적어 한 권으로 엮었다. 책은 서가에 꽂혔다.`)
    // 출처 id는 이 인물의 기록이다
    const ids = new Set(w.state.journal.filter((e) => e.char_uid === r.char_uid).map((e) => e.id))
    for (const c of b.chapters) for (const x of c.blocks) for (const id of x.src) assert.ok(ids.has(id), `출처 ${id}`)
  })

  it('사망 책: 꺼진 등불, 맺는 장 `먼저 떠난 길`에 길드 편지와 BK22, 원인은 부록 걸어온 길에만', () => {
    const w = oneLife('00000000000051d2', 'challenging', true)
    const r = w.state.family.chronicle.find((x) => x.end_kind === 'died')
    assert.ok(r, '사망 생애가 아니다')
    const b = bookOf(r)!
    checkBook(b, '사망')
    assert.equal(b.cover.emblem, 'lamp_out')
    assert.ok(b.cover.subtitle.endsWith('· 돌아오지 않음'))
    const close = b.chapters.at(-1)!
    assert.equal(close.head, '맺는 장 · 먼저 떠난 길')
    const letter = close.blocks.find((x) => x.kind === 'letter')
    assert.ok(letter && letter.lines!.length >= 3, '길드 편지가 없다')
    assert.ok(letter.lines![0]!.endsWith('가문께.'))
    assert.equal(close.blocks.find((x) => x.kind === 'quote_last')!.text, `${r.name}의 등불이 꺼졌다.`)
    assert.equal(close.blocks.at(-1)!.text, '걸음은 멈췄지만, 적어 둔 것들은 집으로 돌아왔다.')
    // 원인 3줄(09 §5.4)은 부록에만 있고 본문에는 판정식이 없다
    assert.ok(b.appendix.walk.some((l) => l.startsWith('결정적 순간 : ')))
    const body = b.chapters.flatMap((c) => c.blocks.flatMap(textsOf)).join('\n')
    assert.ok(!body.includes('결정적 순간'), '맺는 장에 원인 줄이 실렸다')
    assert.equal(setBookAfterword(b, { kind: 'closing_letter', heir_name: 'x', age: 30, season: 'spring', text: 'x' }), false, '사망 책에 후기가 붙었다')
  })

  it('긴 잠 책: 초승달, 달그늘의 밤 장(BK13), 맺는 장 `멈춘 시간`과 BK23', () => {
    let found: Book | null = null
    for (let i = 0; i < 6 && !found; i++) {
      const w = makeGame({ seed: seedOf(i), attitude: 'challenging', lethal: true, autoSuccession: true })
      run(w, { steps: 3000, until: (x) => x.state.family.chronicle.some((r) => r.end_kind === 'long_sleep') || x.state.family.generation >= 3 })
      const r = w.state.family.chronicle.find((x) => x.end_kind === 'long_sleep')
      if (r) found = bookOf(r)
    }
    assert.ok(found, '긴 잠 생애를 찾지 못했다')
    checkBook(found, '긴 잠')
    assert.equal(found.cover.emblem, 'moon')
    const moon = found.chapters.find((c) => c.key === 'moon')
    assert.ok(moon, '달그늘의 밤 장이 없다')
    assert.ok(moon.head.endsWith('· 달그늘의 밤'))
    assert.ok(moon.blocks[0]!.kind === 'opener' && moon.blocks[0]!.text!.startsWith('잔을 받은 뒤로 '))
    const close = found.chapters.at(-1)!
    assert.equal(close.head, '맺는 장 · 멈춘 시간')
    assert.ok(close.blocks.at(-1)!.text!.startsWith('이 책은 덮이지 않았다.'))
    assert.ok(found.appendix.walk.some((l) => l.startsWith('긴 잠 · ')))
  })

  it('조기 은퇴·짧은 길(단위 입력): 본문 4블록 미만이면 `짧은 길` 한 장과 BK24', () => {
    const w = oneLife(seedOf(2))
    const input = inputOf(w)
    const keep = new Set<number>()
    for (const e of input.entries) {
      const kind = e.refs?.event_id ? input.events[e.refs.event_id]?.kind : undefined
      if (kind === 'life_end' || (e.tag === 'travel' && keep.size === 0)) keep.add(e.id)
    }
    const short: BookInput = { ...input, early: true, end_age: 27, entries: input.entries.filter((e) => keep.has(e.id) || e.tag === 'discovery').slice(-5), attitude_log: [input.attitude_log[0]!] }
    const b = compileBook(short)
    assert.equal(b.fallback, false, b.diag.join(','))
    assert.equal(b.cover.subtitle, '18~27세 · 조기 은퇴')
    assert.equal(b.chapters.length, 1)
    assert.equal(b.chapters[0]!.key, 'short')
    assert.equal(b.chapters[0]!.head, '짧은 길')
    assert.ok(b.chapters[0]!.blocks.at(-1)!.text!.startsWith('짧은 길이었다.'))
  })

  it('같은 저장이면 같은 책(18 §12): 계승 대기 저장에서 다시 엮어도 바이트가 같다', () => {
    for (const [seed, attitude, lethal] of [[seedOf(0), undefined, undefined], ['00000000000051d2', 'challenging', true]] as const) {
      const w = oneLife(seed, attitude, lethal)
      const r = w.state.family.chronicle.at(-1)!
      const again = roundTrip(w)
      const rec = again.state.family.chronicle.at(-1)!
      const plan = pendingSuccession(again)!
      const book = compileBook(bookInput(again, rec, { keepsakes: plan.settlement.keepsakes }))
      assert.equal(canonicalJson(book), canonicalJson(r.book), `${seed} 다시 엮은 책이 다르다`)
      assert.equal(canonicalJson(compileBook(inputOf(w))), canonicalJson(compileBook(inputOf(w))))
    }
  })

  it('예외 경계: 문장 틀이 없어도 최소 책을 쓰고 멈추지 않는다(18 §6.2)', () => {
    const w = oneLife(seedOf(0))
    const b = compileBook({ ...inputOf(w), texts: {} })
    assert.equal(b.fallback, true)
    assert.ok(b.diag.some((d) => d.startsWith('EXC:')))
    assert.equal(b.chapters.length, 1)
    assert.equal(b.chapters[0]!.key, 'fallback')
    assert.equal(b.chapters[0]!.head, '적힌 것들')
    assert.ok(b.chapters[0]!.blocks.some((x) => x.kind === 'quote_last'))
    assert.ok(isBook(b))
  })

  it('금지 표현이 든 상세는 line 형태로 줄이거나 빼고, 최소 책으로 가지 않는다(BC4 수리)', () => {
    const w = oneLife(seedOf(1))
    const input = inputOf(w)
    const dirty = { ...input, entries: input.entries.map((e) => (e.detail ? { ...e, detail: `${e.detail} 퀘스트를 끝냈다.` } : e)) }
    const b = compileBook(dirty)
    assert.equal(b.fallback, false, b.diag.join(','))
    const body = b.chapters.flatMap((c) => c.blocks.filter((x) => x.kind !== 'letter').flatMap(textsOf))
    assert.ok(body.every((t) => !t.includes('퀘스트')), body.find((t) => t.includes('퀘스트')))
  })
})

describe('봉인 뒤 덧붙임 3칸(18 §7.2)', () => {
  it('opened·received_by·afterword만 1회씩 바뀌고 나머지 칸은 그대로다', () => {
    const w = oneLife(seedOf(3))
    const b = bookOfLife(w)
    const others = (x: Book) => canonicalJson({ ...x, opened: null, received_by: null, afterword: null })
    const before = others(b)
    assert.equal(markBookOpened(b), true)
    assert.equal(markBookOpened(b), false)
    assert.equal(b.opened, true)
    const by = { gen: 2, char_uid: 'ch_0009', name: '리아', old_name: null }
    assert.equal(setBookReceivedBy(b, by), true)
    assert.equal(setBookReceivedBy(b, { ...by, name: '다른' }), false)
    assert.equal(b.received_by?.name, '리아')
    assert.equal(setBookAfterword(b, { kind: 'moon_letter', heir_name: '리아', age: 36, season: 'autumn', text: '편지' }), false, '은퇴 책에 달그늘 편지')
    assert.equal(setBookAfterword(b, { kind: 'closing_letter', heir_name: '리아', age: 30, season: 'winter', text: '편지' }), true)
    assert.equal(setBookAfterword(b, { kind: 'closing_letter', heir_name: '리아', age: 31, season: 'winter', text: '둘째' }), false)
    assert.equal(others(b), before)
  })

  it('5단계 출발 때 받은 사람이 채워진다', () => {
    const w = oneLife(seedOf(4))
    const heir = succeed(w)
    const b = bookOfLife(w)
    assert.deepEqual(b.received_by, { gen: 2, char_uid: heir.uid, name: heir.name, old_name: null })
  })
})

describe('저장(16 §5.3 life_record.book)', () => {
  const meta = { app_version: '0.1.0', saved_at_utc: 1_790_000_000_000, content_packs: [{ id: 'base', version: '0.1.0' }], content_hash: 'x' }

  it('옛 저장의 book: null은 그대로 읽고, 형식이 어긋난 책은 고치지 않고 B15만 남긴다', () => {
    const w = oneLife(seedOf(5))
    const body = JSON.parse(canonicalJson(w.snapshot()))
    body.family.chronicle[0].book = null
    const ok = loadSave(serializeSave(makeSaveRoot(body, meta)), w.content)
    assert.ok(ok.ok)
    assert.equal(ok.root.body.family.chronicle[0]!.book, null)
    assert.ok(!ok.diagnostics.some((d) => d.code === 'B15'))

    body.family.chronicle[0].book = { cover: { title: '옛 책' }, chapters: [] }
    const odd = loadSave(serializeSave(makeSaveRoot(body, meta)), w.content)
    assert.ok(odd.ok)
    assert.ok(odd.diagnostics.some((d) => d.code === 'B15'))
    assert.equal(bookOf(odd.root.body.family.chronicle[0]!), null)
    assert.deepEqual(odd.root.body.family.chronicle[0]!.book, { cover: { title: '옛 책' }, chapters: [] })
  })

  it('봉인된 책은 저장·로드 뒤에도 같은 모양이다', () => {
    const w = oneLife(seedOf(6))
    const r = loadSave(serializeSave(makeSaveRoot(w.snapshot(), meta)), w.content)
    assert.ok(r.ok)
    assert.equal(canonicalJson(r.root.body.family.chronicle[0]!.book), canonicalJson(w.state.family.chronicle[0]!.book))
    assert.ok(!r.diagnostics.some((d) => d.code === 'B15'))
  })
})

describe('가지 않은 길(18 §7.1 refs.not_taken)', () => {
  it('운명·연속 사건을 닫는 확정 기록에만 두고, 괄호 설명을 빼며, 운명 결과는 주요로 보존한다', () => {
    const w = oneLife(seedOf(0), 'challenging', true)
    const content = w.content
    const withNt = w.state.journal.filter((e) => e.refs?.not_taken !== undefined)
    assert.ok(withNt.length >= 2, `not_taken 기록 ${withNt.length}개`)
    for (const e of withNt) {
      const ev = content.get('event', e.refs!.event_id!)
      assert.ok(ev.category === 'fate' || ev.category === 'chain', `${ev.id}: ${ev.category}`)
      assert.ok(e.importance !== 'daily', `${ev.id} 결과가 일상 기록이다`)
      for (const name of e.refs!.not_taken!) assert.ok(!/\)$/.test(name), `괄호 설명이 남았다: ${name}`)
    }
    // 전문화 갈림길: 고른 길은 가지 않은 길에 없다
    const spec = withNt.find((e) => e.refs!.event_id === 'F01')
    assert.ok(spec, 'F01 결과 기록이 없다')
    const chosen = spec.line.replace(/을 택했다$/, '').replace(/로 남기로 했다$/, '')
    assert.ok(!spec.refs!.not_taken!.includes(chosen), `${chosen} ∈ ${spec.refs!.not_taken!.join(',')}`)
    assert.ok(spec.refs!.not_taken!.every((n) => !n.includes('(')))
    // 제시·대기 기록([중요])에는 두지 않는다
    for (const e of w.state.journal.filter((x) => x.tag === 'important' && x.line.includes('기다린다'))) assert.equal(e.refs?.not_taken, undefined)
  })
})

function inputOf(w: World): BookInput {
  const rec = w.state.family.chronicle.at(-1)!
  return bookInput(w, rec, { keepsakes: pendingSuccession(w)?.settlement.keepsakes ?? [] })
}
