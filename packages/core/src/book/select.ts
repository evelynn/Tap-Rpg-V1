// 생애의 책 선별(18 §2.3·§4): 후보·점수·필수 기록·장 나누기와 할당·고르는 순서·맺는 장 재료.
// 정렬 키는 eff_c = round(eff_min × 100) 정수와 id다(18 §2.4). 점수는 정수만 쓴다.
import { entryScore, isExcludedRecord } from '../journal/select'
import type { JournalEntry } from '../state/journal'
import type { BookEventKind, BookInput } from './input'

export type Rec = JournalEntry
export type StageKey = 'ch1' | 'ch2' | 'ch3' | 'ch4' | 'moon'
export const STAGE_KEYS: readonly StageKey[] = ['ch1', 'ch2', 'ch3', 'ch4', 'moon']

export const effc = (eff: number): number => Math.round(eff * 100)
export const byTime = (a: Pick<Rec, 'eff_min' | 'id'>, b: Pick<Rec, 'eff_min' | 'id'>): number => effc(a.eff_min) - effc(b.eff_min) || a.id - b.id

// 18 §4.3 장 1개(살았던 단계만)
export interface StageChap {
  key: StageKey
  stage: number // 0~3 단계, 4 = 달그늘의 밤
  effFrom: number
  effTo: number
  ageFrom: number
  ageTo: number
  quota: number // 비필수 할당 Q_c
}

// 태도 변화 문장 1개(BK14~BK16)
export interface Mark {
  eff_min: number
  attitude: string
  age: number
  season: Rec['season']
  chap: StageKey
}

export interface Selection {
  E: number
  endEff: number
  S: Rec[]
  C: Rec[]
  score: Map<number, number>
  mand: Set<number> // 필수(BM1~BM9 + BM8 끌려온 기록). 상자에 흡수된 것은 뺀다
  bm1: number[]
  forks: Map<number, Rec[]> // 갈림길 상자: 결과 기록 id → 흡수된 후속 기록(§5.3 4번)
  absorbed: Set<number>
  chosen: Set<number> // 비필수로 고른 기록
  marks: Mark[]
  chapters: StageChap[]
  segs: { from: number; to: number; attitude: string }[] // 합친 태도 구간(여는 문장의 주된 태도)
  lastYear: Rec[] // 맺는 장 2번
  quote: Rec | null // 맺는 장 3번(생애 종료 사건의 첫 기록)
  tail: Rec[] // 맺는 장 4번(첫 기록은 detail만)
  tailFirstDetail: boolean
  letter: Rec | null // 맺는 장 5번(사망 길드 편지)
  lastSpec: number | null // 마지막 전직 결과 기록(부제 4순위)
  chapOf: (eff: number, age: number) => StageKey
}

const PER_YEAR_MERGE = 1 // 태도 구간 합치기 기준 1년(12분 = min_per_year)
const NONMAND_MIN_SCORE = 3
const TAG_CAP = 3 // 같은 태그 장당
const EVENT_CAP = 2 // 같은 event_id 책당
const QUOTA_DIV = 40
const QUOTA_CLAMP: readonly [number, number] = [2, 6]
const BM_MAX = { bm1: 3, fork_spec: 2, fork_other: 1, fate_total: 6, bm5: 4, bm6: 3, bm7: 2, chain_prev: 2 } as const

export const kindOf = (input: BookInput, e: Rec): BookEventKind | undefined =>
  e.refs?.event_id !== undefined ? input.events[e.refs.event_id]?.kind : undefined

const FATE: readonly BookEventKind[] = ['fate_spec', 'fate_job', 'fate']
const CHAIN: readonly BookEventKind[] = ['chain_fork', 'chain_last', 'chain']

export function select(input: BookInput): Selection {
  const T = input.time
  const effOfAge = (age: number): number => (age - T.start_age) * T.min_per_year
  const ageOf = (eff: number): number => T.start_age + Math.floor(eff / T.min_per_year)

  // 입력 S: 생애 종료 사건이 쓴 마지막 기록 id E까지(18 §2.2)
  const all = input.entries
  const endRecs = all.filter((e) => kindOf(input, e) === 'life_end')
  const E = endRecs.length ? Math.max(...endRecs.map((e) => e.id)) : (all.at(-1)?.id ?? 0)
  const S = all.filter((e) => e.id <= E).sort((a, b) => a.id - b.id)
  const endEff = S.find((e) => e.id === E)?.eff_min ?? S.at(-1)?.eff_min ?? 0
  const mut = input.mutation_eff_min

  // 점수(18 §4.1): 첫 기록은 태그별 가장 이른 입력 기록(묶음 제외, §7.3)
  const first = new Map<string, number>()
  for (const e of S) if (!e.bundle_count && !first.has(e.tag)) first.set(e.tag, e.id)
  const relics = new Set([...input.relic_uids, ...input.received_relic_uids])
  const category = (e: Rec): string | undefined => {
    const k = kindOf(input, e)
    return k && FATE.includes(k) ? 'fate' : k && CHAIN.includes(k) ? 'chain' : undefined
  }
  const score = new Map<number, number>()
  for (const e of S) score.set(e.id, entryScore(e, category(e), first, relics))
  const sc = (e: Rec): number => score.get(e.id) ?? 1

  // 후보 C(18 §2.3)
  const C = S.filter((e) => !isExcludedRecord(e, S) && kindOf(input, e) !== 'life_end').sort(byTime)
  const inC = new Set(C.map((e) => e.id))

  // 장(18 §4.3): 살았던 단계만. 변이가 있으면 변이 시점부터 끝까지 달그늘의 밤
  const [a2, a3, a4] = input.stage_ages
  const starts = [T.start_age, a2, a3, a4]
  const lifeTo = mut !== null ? Math.min(mut, endEff) : endEff
  const chapters: StageChap[] = []
  const quota = (span: number): number => Math.min(QUOTA_CLAMP[1], Math.max(QUOTA_CLAMP[0], Math.ceil(Math.floor(span) / QUOTA_DIV)))
  // 장 나이 구간 = 단계 구간을 생애의 시작·끝 나이와 변이 나이로 자른 값(18 §3.3)
  for (let i = 0; i < 4; i++) {
    const from = effOfAge(starts[i]!)
    const next = i < 3 ? effOfAge(starts[i + 1]!) : Infinity
    const to = Math.min(next, lifeTo)
    if (to <= from) continue
    const ageTo = lifeTo > next ? starts[i + 1]! - 1 : mut !== null ? ageOf(mut) : input.end_age
    chapters.push({ key: STAGE_KEYS[i]!, stage: i, effFrom: from, effTo: to, ageFrom: starts[i]!, ageTo: Math.max(starts[i]!, ageTo), quota: quota(to - from) })
  }
  if (mut !== null) {
    chapters.push({ key: 'moon', stage: 4, effFrom: mut, effTo: endEff, ageFrom: ageOf(mut), ageTo: input.end_age, quota: quota(endEff - mut) })
  }
  if (!chapters.length) chapters.push({ key: 'ch1', stage: 0, effFrom: 0, effTo: endEff, ageFrom: T.start_age, ageTo: input.end_age, quota: QUOTA_CLAMP[0] })
  const chapOf = (eff: number, age: number): StageKey => {
    let key: StageKey = mut !== null && eff >= mut ? 'moon' : STAGE_KEYS[starts.slice(1).filter((s) => age >= s).length]!
    // 살지 않은 장이면(경계에서 끝난 생애) 가장 가까운 앞 장
    while (!chapters.some((c) => c.key === key)) {
      const i = STAGE_KEYS.indexOf(key)
      if (i <= 0) return chapters[0]!.key
      key = STAGE_KEYS[i - 1]!
    }
    return key
  }
  const chapOfRec = (e: Rec): StageKey => chapOf(e.eff_min, e.age)

  // ── 필수(18 §4.2) ──
  const mand = new Set<number>()
  const isResult = (e: Rec): boolean => e.refs?.not_taken !== undefined
  const evId = (e: Rec): string | undefined => e.refs?.event_id
  const withNt = new Set(S.filter(isResult).map(evId))
  // not_taken이 없던 옛 기록: 그 사건에 결과 표시가 하나도 없으면 후보 기록을 결과로 본다
  const result = (e: Rec): boolean => isResult(e) || (!withNt.has(evId(e)) && inC.has(e.id))
  const ofKind = (kinds: readonly BookEventKind[]) => C.filter((e) => { const k = kindOf(input, e); return k !== undefined && kinds.includes(k) })
  const firstPerEvent = (list: Rec[], n: number): Rec[] => {
    const count = new Map<string, number>()
    return list.filter((e) => {
      const id = evId(e) ?? ''
      const c = count.get(id) ?? 0
      if (c >= n) return false
      count.set(id, c + 1)
      return true
    })
  }

  // BM1: 첫 인물은 eff_min 0의 [가문] 수첩 첫 장 기록, 후계자는 [계승] 기록 전부(최대 3)
  const bm1 = (input.generation === 1
    ? S.filter((e) => e.tag === 'house' && e.eff_min === 0).slice(0, 1)
    : S.filter((e) => e.tag === 'succession').slice(0, BM_MAX.bm1)).map((e) => e.id)
  for (const id of bm1) mand.add(id)
  // BM1b 첫 [이동]
  const firstTravel = C.find((e) => e.tag === 'travel')
  if (firstTravel) mand.add(firstTravel.id)
  // BM2 운명 사건 결과 → 갈림길 상자. 전직 둘(F01·F04)은 미루기 포함 각 2회까지
  const forkRecs: Rec[] = []
  const fates = [
    ...firstPerEvent(ofKind(['fate_spec', 'fate_job']).filter(result), BM_MAX.fork_spec),
    ...firstPerEvent(ofKind(['fate']).filter(result), BM_MAX.fork_other),
  ].sort(byTime).slice(0, BM_MAX.fate_total)
  forkRecs.push(...fates)
  // BM3 선택지 있는 줄기 마지막 단계 결과 → 상자, BM4 선택지 없는 마지막 단계(그 사건의 [인연] 기록) → 일반 블록
  forkRecs.push(...firstPerEvent(ofKind(['chain_fork']).filter(result), 1))
  for (const e of firstPerEvent(ofKind(['chain_last']).filter((e) => result(e) || e.tag === 'bond'), 1)) mand.add(e.id)
  // BM5 가정 형성 1개 + 출생 기록(자녀 후보마다)
  const bm5 = [
    ...firstPerEvent(ofKind(['partner']), 1),
    ...C.filter((e) => e.sub === 'birth' || kindOf(input, e) === 'birth'),
  ].slice(0, BM_MAX.bm5)
  for (const e of bm5) mand.add(e.id)
  // BM6 관문 첫 격파
  for (const e of C.filter((e) => e.sub === 'gate_first').slice(0, BM_MAX.bm6)) mand.add(e.id)
  // BM7 넘기는 유품마다 가장 이른 입력 기록(앞 세대 유품이면 [계승] 착용 기록)
  const blockable = (e: Rec): boolean => e.tag !== 'house' && e.tag !== 'retire' && e.tag !== 'death' && (inC.has(e.id) || e.tag === 'succession')
  for (const uid of input.relic_uids.slice(0, BM_MAX.bm7)) {
    const rec = S.find((e) => e.refs?.item_uid === uid && blockable(e))
    if (rec) mand.add(rec.id)
  }
  // BM9 가호 `최후의 순간을 지킨다`
  const bm9 = C.find((e) => e.sub === 'blessing' && input.final_save_lines.includes(e.line))
  if (bm9) mand.add(bm9.id)

  // 갈림길 상자 후속 기록(18 §5.3 4번): 결과 뒤 12분 안, 그 사건의 다음 결과 기록보다 앞, 최대 3개
  const forks = new Map<number, Rec[]>()
  const absorbed = new Set<number>()
  for (const r of forkRecs) {
    const nextResult = C.find((e) => e.id > r.id && evId(e) === evId(r) && isResult(e))
    const follow = C.filter((e) => e.id > r.id && evId(e) === evId(r) && e.eff_min <= r.eff_min + T.min_per_year
      && (!nextResult || e.id < nextResult.id) && !forkRecs.includes(e)).slice(0, 3)
    forks.set(r.id, follow)
    for (const f of follow) absorbed.add(f.id)
  }
  for (const id of absorbed) mand.delete(id)
  for (const r of forkRecs) mand.delete(r.id) // 상자는 따로 센다(필수)

  // 태도 변화 문장(18 §5.4 BK14~BK16)
  const segs = attitudeSegments(input.attitude_log, endEff, T.min_per_year * PER_YEAR_MERGE)
  const marksAll: Mark[] = segs.slice(1).map((s) => {
    const age = ageOf(s.from)
    return { eff_min: s.from, attitude: s.attitude, age, season: seasonOf(input, s.from), chap: chapOf(s.from, age) }
  })
  const marks = STAGE_KEYS.flatMap((k) => marksAll.filter((m) => m.chap === k).slice(-2)) // 장마다 최대 2, 넘으면 늦은 것

  // ── 고르는 순서(18 §4.4) ──
  const inF = new Set<number>([...mand, ...forkRecs.map((e) => e.id)])
  const chosen = new Set<number>()
  const recById = new Map(S.map((e) => [e.id, e]))
  const fRecs = (): Rec[] => [...inF].map((id) => recById.get(id)!).filter((e) => e !== undefined)
  const quotaOf = new Map(chapters.map((c) => [c.key, c.quota]))
  const nonmand = (pred: (e: Rec) => boolean): number => [...chosen].filter((id) => pred(recById.get(id)!)).length
  const pool = C.filter((e) => !inF.has(e.id) && !absorbed.has(e.id)).sort((a, b) => sc(b) - sc(a) || byTime(a, b))
  for (const e of pool) {
    if (sc(e) < NONMAND_MIN_SCORE) break
    const c = chapOfRec(e)
    if (nonmand((x) => chapOfRec(x) === c) >= (quotaOf.get(c) ?? QUOTA_CLAMP[0])) continue
    if (nonmand((x) => chapOfRec(x) === c && x.tag === e.tag) >= TAG_CAP) continue
    if (evId(e) !== undefined && nonmand((x) => evId(x) === evId(e)) >= EVENT_CAP) continue
    if (e.sub !== undefined && fRecs().some((x) => x.sub === e.sub && x.tag === e.tag && x.age === e.age && x.season === e.season)) continue
    chosen.add(e.id)
    inF.add(e.id)
  }

  // BM8 연속 사건 앞 단계(끌려온 기록도 같은 규칙, 줄기당 2). 끌려온 기록은 필수로 센다
  const stageOf = (e: Rec): { id: string; stage: number } | null => {
    const k = kindOf(input, e)
    return k && CHAIN.includes(k) ? input.events[evId(e)!]!.chain : null
  }
  const pulled = new Map<string, number>()
  for (let changed = true; changed;) {
    changed = false
    for (const e of fRecs().sort(byTime)) {
      const st = stageOf(e)
      if (!st || st.stage < 2 || (pulled.get(st.id) ?? 0) >= BM_MAX.chain_prev) continue
      const inBook = (x: Rec): boolean => inF.has(x.id) || absorbed.has(x.id)
      const prev = C.filter((x) => { const s = stageOf(x); return s?.id === st.id && s.stage === st.stage - 1 })
      if (!prev.length || prev.some(inBook)) continue
      const best = [...prev].sort((a, b) => sc(b) - sc(a) || byTime(a, b))[0]!
      mand.add(best.id)
      chosen.delete(best.id)
      inF.add(best.id)
      pulled.set(st.id, (pulled.get(st.id) ?? 0) + 1)
      changed = true
    }
  }

  // ── 맺는 장 재료(18 §3.4) ──
  const lastF = [...fRecs(), ...marks.map((m) => ({ eff_min: m.eff_min, id: -1 }))].sort(byTime).at(-1)
  const lastYear = C.filter((e) => !inF.has(e.id) && !absorbed.has(e.id) && e.eff_min >= endEff - T.min_per_year
    && e.tag !== 'important' && (!lastF || byTime(e, lastF) > 0))
    .sort((a, b) => sc(b) - sc(a) || byTime(b, a))
    .slice(0, 2)
    .sort(byTime)
  const endEvent = [...endRecs].sort((a, b) => a.id - b.id)
  const quote = endEvent[0] ?? null
  const died = input.end_kind === 'died'
  const tailFirstDetail = !died && quote?.detail !== undefined && quote.detail !== ''
  const tail = [
    ...(tailFirstDetail && quote ? [quote] : []),
    ...endEvent.slice(1).filter((e) => e.tag !== 'house' && e.tag !== 'death'),
  ]
  const letter = died ? (endEvent.find((e) => e.tag === 'house' && e.detail) ?? null) : null

  const specs = S.filter((e) => kindOf(input, e) === 'fate_spec' && isResult(e))
  return {
    E, endEff, S, C, score, mand, bm1, forks, absorbed, chosen, marks, chapters, segs, lastYear, quote, tail, tailFirstDetail, letter,
    lastSpec: specs.at(-1)?.id ?? null, chapOf,
  }
}

export function seasonOf(input: BookInput, eff: number): Rec['season'] {
  const order = ['spring', 'summer', 'autumn', 'winter'] as const
  const i = order.indexOf(input.birth_season) + Math.floor(eff / input.time.season_min)
  return order[i % order.length]!
}

// 18 §5.4 만드는 법: 1년(12분) 미만 구간을 앞 구간에(첫 구간이면 다음 구간에) 합치고, 태도가 같은 이웃을 잇는다
export function attitudeSegments(log: readonly { eff_min: number; attitude: string }[], endEff: number, minSpan: number): { from: number; to: number; attitude: string }[] {
  const sorted = [...log].sort((a, b) => a.eff_min - b.eff_min)
  const raw = sorted.map((a, i) => ({ from: a.eff_min, to: Math.max(a.eff_min, sorted[i + 1]?.eff_min ?? endEff), attitude: a.attitude }))
  const out: { from: number; to: number; attitude: string }[] = []
  let carry: number | null = null
  for (const s of raw) {
    if (s.to - s.from < minSpan) {
      const last = out.at(-1)
      if (last) last.to = s.to
      else carry ??= s.from
      continue
    }
    out.push({ ...s, from: carry ?? s.from })
    carry = null
  }
  if (!out.length && raw.length) out.push({ from: carry ?? raw[0]!.from, to: raw.at(-1)!.to, attitude: raw.at(-1)!.attitude })
  const joined: typeof out = []
  for (const s of out) {
    const last = joined.at(-1)
    if (last && last.attitude === s.attitude) last.to = s.to
    else joined.push({ ...s })
  }
  return joined
}
