// 엮기 입력 S(18 §2.2). 저장 상태·콘텐츠에서 책이 읽는 값만 순수 데이터로 모은다. compileBook은 이 값만 읽는다
// (난수·시계·표시 배율·설정을 읽지 않는다). 계승 대기 중 저장에서도 같은 입력이 다시 나온다(18 §12 재엮기 동일성).
import type { Content } from '../content/index'
import type { Effect, Event, SEASONS } from '../schema/index'
import { stageBoundaries } from '../life/aging'
import { itemName } from '../items/bag'
import { GRADE_LABELS, SPEC_LABELS } from '../rules/labels'
import { characterOf, type RuleContext } from '../rules/context'
import type { LifeRecord } from '../state/family'
import type { ItemInstance } from '../state/inventory'
import type { JournalEntry } from '../state/journal'
import { PARTNER_BOND, readPartner } from '../succession/partner'
import { renderTemplate } from '../text/index'
import { RELIC_FALLBACK } from '../events/scope'
import { BLESSING_TEXT } from '../blessing/index'
import { FRAME, bkId } from './text'

type Season = (typeof SEASONS)[number]

// 책이 사건을 가르는 종류. 사건 ID를 쓰지 않고 정의의 속성(분류·단계·효과)으로 정한다(I04)
//  life_end   생애 종료 단계 시스템 사건(S03·S04·S08)
//  fate_spec  전직 효과가 있는 운명 사건(F01), fate_job 2차 전직(F04), fate 그 밖의 운명 사건(F02·F03)
//  chain_fork 선택지가 있는 줄기 마지막 단계(C01-3), chain_last 선택지 없는 마지막 단계(C02-3), chain 그 밖의 단계
//  partner    가정 형성(S01), birth 자녀 소식(S02)
export type BookEventKind = 'life_end' | 'fate_spec' | 'fate_job' | 'fate' | 'chain_fork' | 'chain_last' | 'chain' | 'partner' | 'birth' | 'other'

export interface BookEventInfo {
  name: string
  kind: BookEventKind
  chain: { id: string; stage: number } | null
}

export interface BookAppendixSource {
  people: { text: string; bond: boolean }[] // 동반자 / 자녀 후보 / 인연 기록(bond: 줄이기 대상)
  relics: string[] // 유품 줄(저주 줄 포함)
  keepsakes: string[]
  unfinished: string[]
  achievements: string[] // 업적 번호(id) 순
  walk: string[]
  cause: string[] // 사망이면 끝에 이른 까닭 3줄(09 §5.4 원문). 걸어온 길 끝에 붙고 BC4를 검사하지 않는다
}

export interface BookInput {
  gen_version: number
  family: string
  generation: number
  binder: string
  char_uid: string
  name: string
  time: { start_age: number; min_per_year: number; season_min: number }
  stage_ages: readonly [number, number, number] // 전성기·숙련기·노년기 시작 나이(09 §1.1)
  end_kind: LifeRecord['end_kind']
  end_age: number
  early: boolean // 은퇴 예정 나이 전의 은퇴(09 §3.3)
  epithet: string
  birth_season: Season
  attitude_log: { eff_min: number; attitude: string }[]
  attitude_cols: Record<string, number> // 태도 → 여는 문장 열(태도 order 순 0·1·2)
  mutation_eff_min: number | null
  entries: JournalEntry[] // 이 인물의 보존 기록(일상 제외) 전부, id 순. E 자르기는 compileBook이 한다
  events: Record<string, BookEventInfo>
  npc_names: Record<string, string>
  place_names: Record<string, string>
  proper_names: string[] // 18 §5.1 고유 이름(NPC·동반자·자녀·장비·장소). 이 인물의 이름은 뺀다
  relic_uids: string[] // 넘기는 유품
  relic_names: string[]
  received_relic_uids: string[]
  final_save_lines: string[] // 가호 `최후의 순간을 지킨다` 기록 한 줄(BM9)
  spec_label: string | null // 장 부제 4순위 `{spec}의 길`
  texts: Record<string, string> // book.bkNN → 문장 틀
  empty_pack: string // 11 S04 대체어 `남은 배낭`
  appendix: BookAppendixSource
}

export const BOOK_GEN_VERSION = 1

const isEffectArray = (v: unknown): v is Effect[] =>
  Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'object' && x !== null && typeof (x as Effect).type === 'string')

function effectTypes(ev: Event): Set<string> {
  const out = new Set<string>()
  const walk = (list: readonly Effect[]): void => list.forEach((e) => {
    out.add(e.type)
    for (const v of Object.values(e)) if (isEffectArray(v)) walk(v)
  })
  for (const c of ev.choices) for (const o of Object.values(c.outcomes)) if (o) walk(o.effects)
  return out
}

function eventKind(content: Content, ev: Event): BookEventKind {
  if (ev.category === 'system') {
    if (ev.system?.phase === 'life_end') return 'life_end'
    const t = effectTypes(ev)
    return t.has('create_partner') ? 'partner' : t.has('create_child_candidate') ? 'birth' : 'other'
  }
  if (ev.category === 'fate') {
    const t = effectTypes(ev)
    return t.has('specialize') ? 'fate_spec' : t.has('set_job2') ? 'fate_job' : 'fate'
  }
  if (ev.category === 'chain' && ev.chain) {
    const last = content.has('chain', ev.chain.id) && content.get('chain', ev.chain.id).stages === ev.chain.stage
    return !last ? 'chain' : ev.hold !== 'none' ? 'chain_fork' : 'chain_last'
  }
  return 'other'
}

// 세대 교대 담당자 이름(02 §8.10)
function npcNameAt(npc: { name: string; successors?: { from_generation: number; name: string }[] | undefined }, gen: number): string {
  const s = [...(npc.successors ?? [])].filter((x) => x.from_generation <= gen).sort((a, b) => b.from_generation - a.from_generation)[0]
  return s?.name ?? npc.name
}

// 엮은 사람: 끝난 인물의 대수에 잡화점을 맡던 사람(18 §1.3). 잡화점 NPC는 시설 값으로 찾는다
const BINDER_FACILITY = 'general_store'

const LONG_SLEEP_CAUSE: Record<string, string> = { age: '정해진 나이', thirst: '갈증의 한계', voluntary: '자발적 은둔' }

export interface BookInputOptions {
  keepsakes: readonly Pick<ItemInstance, 'def_id' | 'prefix'>[] // 기념품으로 바뀌는 장비(계승 1단계 정산값)
}

// 계승 2단계 안(18 §2.1-3)에서 부른다. 인물·유품·후보가 아직 저장에 있어야 한다(3단계 전)
export function bookInput(ctx: RuleContext, record: LifeRecord, opts: BookInputOptions): BookInput {
  const { content, state } = ctx
  const ch = characterOf(ctx)
  const fam = state.family
  const time = content.balance.time
  const gen = record.gen
  const texts: Record<string, string> = {}
  for (let n = 1; n <= 34; n++) {
    const id = bkId(n)
    if (content.has('text', id)) texts[id] = content.get('text', id).variants[0]!
  }
  const events: Record<string, BookEventInfo> = {}
  for (const ev of content.list('event')) events[ev.id] = { name: ev.name, kind: eventKind(content, ev), chain: ev.chain ? { ...ev.chain } : null }

  const npcs = content.list('npc')
  const npc_names = Object.fromEntries(npcs.map((n) => [n.id, npcNameAt(n, gen)]))
  const place_names = Object.fromEntries(content.list('region').map((r) => [r.id, r.name]))
  const binderNpc = npcs.find((n) => n.facility === BINDER_FACILITY)
  const binder = binderNpc ? npcNameAt(binderNpc, gen) : ''

  const entries = state.journal.filter((e) => e.char_uid === record.char_uid && e.importance !== 'daily').sort((a, b) => a.id - b.id)
  const partner = readPartner(fam, gen)
  const children = ch.uid === record.char_uid ? ch.children.map((u) => fam.candidates[u]?.name).filter((n): n is string => !!n) : []
  const relics = record.relics_passed.map((u) => state.item_instances[u]).filter((i): i is ItemInstance => i !== undefined)
  const relic_names = relics.map((i) => itemName(ctx, i))

  const names = new Set<string>()
  for (const n of npcs) { names.add(n.name); for (const s of n.successors ?? []) names.add(s.name) }
  for (const r of content.list('region')) {
    names.add(r.name)
    if (r.kind === 'adventure_route') for (const d of r.discoveries) names.add(d.name)
  }
  for (const it of content.list('item')) names.add(it.name)
  for (const n of relic_names) names.add(n)
  if (partner) names.add(partner.name)
  for (const c of children) names.add(c)
  names.delete(record.name)

  const attitudes = [...content.list('attitude')].sort((a, b) => a.order - b.order)
  const attitude_cols = Object.fromEntries(attitudes.map((a, i) => [a.id, Math.min(i, 2)]))

  // ── 부록(18 §3.5): 데이터를 그대로 옮긴다 ──
  const people: BookAppendixSource['people'] = []
  if (partner) {
    const form = partnerForm(content, entries, events, partner, record.name)
    people.push({ text: [partner.name, form, partner.job].filter((x) => x).join(' · '), bond: false })
  }
  children.forEach((c, i) => people.push({ text: `${c} · ${FRAME.ordinals[i] ?? `${i + 1}번째`} ${FRAME.child}`, bond: false }))
  for (const b of fam.bonds) if (b.gen === gen && b.npc_id !== PARTNER_BOND) people.push({ text: b.text, bond: true })

  const relicLines: string[] = []
  relics.forEach((inst, i) => {
    const acquired = inst.history.find((h) => h.kind === 'acquired')?.text
    relicLines.push(`${relic_names[i]}(${GRADE_LABELS[inst.grade]})${acquired ? ` — ${acquired}` : ''}`)
    if (content.get('item', inst.def_id).cursed) relicLines.push(FRAME.curse)
  })
  const achievements = Object.entries(fam.achievements)
    .filter(([, a]) => a.char_uid === record.char_uid)
    .map(([id]) => id)
    .sort()
    .map((id) => (content.has('achievement', id) ? content.get('achievement', id).name : id))

  return {
    gen_version: BOOK_GEN_VERSION,
    family: fam.name,
    generation: gen,
    binder,
    char_uid: record.char_uid,
    name: record.name,
    time: { start_age: time.start_age, min_per_year: time.min_per_year, season_min: time.season_min },
    stage_ages: stageBoundaries(content),
    end_kind: record.end_kind,
    end_age: record.end_age,
    early: record.end_kind === 'retired' && record.end_age < record.retire_age,
    epithet: record.epithet,
    birth_season: record.birth_season,
    attitude_log: record.attitude_log.map((a) => ({ ...a })),
    attitude_cols,
    mutation_eff_min: record.mutation_eff_min,
    entries,
    events,
    npc_names,
    place_names,
    proper_names: [...names].filter((n) => [...n].length >= 2).sort(),
    relic_uids: [...record.relics_passed],
    relic_names,
    received_relic_uids: [...record.received_relic_uids],
    final_save_lines: content.has('text', BLESSING_TEXT.finalSave) ? [...content.get('text', BLESSING_TEXT.finalSave).variants] : [],
    spec_label: record.specialization !== 'none' ? SPEC_LABELS[record.specialization] : null,
    texts,
    empty_pack: content.has('text', RELIC_FALLBACK) ? content.get('text', RELIC_FALLBACK).variants[0]! : '',
    appendix: {
      people,
      relics: relicLines,
      keepsakes: opts.keepsakes.map((k) => itemName(ctx, k)),
      unfinished: [...record.unfinished],
      achievements,
      walk: walkLines(ctx, record, entries, events),
      cause: record.end_kind === 'died' ? causeLines(entries, events) : [],
    },
  }
}

// 동반자 형태(배우자·동반자·공동 양육 가족, 12 §2.1): S01 기록 한 줄을 사건 선택지 문장과 맞춰 그 선택지 이름을 쓴다
function partnerForm(content: Content, entries: readonly JournalEntry[], events: Record<string, BookEventInfo>, p: { name: string; job: string }, name: string): string {
  const rec = entries.find((e) => e.refs?.event_id && events[e.refs.event_id]?.kind === 'partner')
  if (!rec?.refs?.event_id) return ''
  const ev = content.get('event', rec.refs.event_id)
  for (const c of ev.choices) {
    const line = c.outcomes.always?.line
    if (line === undefined) continue
    try {
      if (renderTemplate(line, { partner: p.name, job: p.job, name }) === rec.line) return c.label
    } catch {
      // 변수가 모자란 변형은 비교하지 않는다
    }
  }
  return ''
}

// 걸어온 길(18 §3.5): 03 §8 1단계와 같은 출처(life_record)
function walkLines(ctx: RuleContext, r: LifeRecord, entries: readonly JournalEntry[], events: Record<string, BookEventInfo>): string[] {
  const { content } = ctx
  const perYear = content.balance.time.min_per_year
  const out: string[] = []
  const attitudes = [...content.list('attitude')].sort((a, b) => a.order - b.order)
  const years = attitudes
    .map((a) => ({ name: a.name, y: Math.floor((r.attitudes_used[a.id] ?? 0) / perYear) }))
    .filter((x) => x.y > 0)
  if (years.length) out.push(`태도 · ${years.map((x) => `${x.name} ${x.y}년`).join(' · ')}`)
  const resultAge = (kind: BookEventKind): string => {
    const rec = entries.filter((e) => e.refs?.event_id && events[e.refs.event_id]?.kind === kind && e.refs.not_taken !== undefined).at(-1)
    return rec ? `(${rec.age}세)` : ''
  }
  const job2 = r.job2 && content.balance.second_jobs[r.job2] ? `${content.balance.second_jobs[r.job2]!.name}${resultAge('fate_job')}` : null
  out.push(`전문화 · ${r.specialization === 'none' ? '초보' : `${SPEC_LABELS[r.specialization]}${resultAge('fate_spec')}`}${job2 ? ` · ${job2}` : ''}`)
  const rank = content.has('guild_rank', r.guild_rank) ? content.get('guild_rank', r.guild_rank).name : r.guild_rank
  out.push(`최고 레벨 ${r.peak_level} · 길드 ${rank}`)
  out.push(`출정 ${r.summary.sorties}번 · 패배 ${r.summary.defeats}번 · 중상 ${r.summary.serious_injuries}번`)
  out.push(`발견한 곳 ${r.summary.discoveries}곳`)
  const gates = [...new Set(entries.filter((e) => e.sub === 'gate_first' && e.refs?.location_id).map((e) => e.refs!.location_id!))]
    .map((id) => (content.has('region', id) ? content.get('region', id).name : id))
  if (gates.length) out.push(`넘은 관문 · ${gates.join(', ')}`)
  out.push(`모은 동전 ${r.summary.coins_earned}`)
  if (r.end_kind === 'retired' && r.retire_role && content.has('retire_role', r.retire_role)) {
    out.push(`${FRAME.retiredAs} · ${content.get('retire_role', r.retire_role).name}`)
  }
  if (r.end_kind === 'long_sleep' && r.long_sleep) {
    out.push(`${FRAME.endWord.long_sleep} · ${LONG_SLEEP_CAUSE[r.long_sleep.cause] ?? r.long_sleep.cause} · ${r.long_sleep.sleep_age}세`)
  }
  return out
}

// 끝에 이른 까닭 3줄(09 §5.4 원문): S04 결과 상세의 머리줄 뒤 세 줄. 없으면 사망 기록(07 §8.2) 상세
function causeLines(entries: readonly JournalEntry[], events: Record<string, BookEventInfo>): string[] {
  const s04 = entries.find((e) => e.tag === 'death' && e.refs?.event_id && events[e.refs.event_id]?.kind === 'life_end')
  const rows = s04?.detail?.split('\n').slice(1) ?? []
  if (rows.length) return rows
  return entries.find((e) => e.tag === 'death' && !e.refs?.event_id)?.detail?.split('\n') ?? []
}
