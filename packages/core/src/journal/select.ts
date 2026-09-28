// 연대기 주요 기록(12 §7.1): 후보 기록을 18 §4.1 선별 점수로 골라 4~6개를 싣는다.
// 후보는 [중요]·[인연]·[발견] 첫 기록·유품 획득·특성 변화·운명 사건 결과이고, 18 §2.3이 빼는 기록(묶음·[가문]·
// 맺는 장·최후 판정·안내·결과가 뒤에 있는 제시 기록)은 넣지 않는다. 입력은 이 인물의 보존 기록(18 §2.2)이다.
import type { JournalEntry } from '../state/journal'

export type ChronicleEntry = Pick<JournalEntry, 'id' | 'char_uid' | 'eff_min' | 'tag' | 'sub' | 'importance' | 'detail' | 'check' | 'bundle_count' | 'refs'>

export interface ChronicleOptions {
  relicUids: readonly string[] // 넘기는 유품 + 물려받은 유품(18 §4.1 가산, 12 §7.1 유품 획득)
  eventCategory: (eventId: string) => string | undefined // 사건 분류(16 event.category: life·chain·fate·system)
  clamp: readonly [number, number] // balance.inheritance.chronicle_major.clamp
  scoreGte: number // balance.inheritance.chronicle_major.score_gte
}

const QUOTE_PAIR = /"[^"]+"|“[^”]+”/

// 18 §4.1 기본 점수: 여러 줄에 해당하면 가장 높은 값. 최근 요약(14 §1.1)도 이 점수로 가운데 문장을 고른다
export function baseScore(e: ChronicleEntry, category: string | undefined): number {
  switch (e.tag) {
    case 'bond':
      return 7
    case 'discovery':
      return e.sub === 'family_first' ? 6 : 3
    case 'family':
      return 5
    case 'growth':
      return e.sub === 'rank' || e.sub === 'spec' ? 5 : e.sub === 'age' ? 3 : 1
    case 'trait':
      return e.sub === 'trait_gain' ? 5 : e.sub === 'trait_react' ? 2 : 1
    case 'gear':
      return e.sub === 'rare_gain' ? 5 : e.sub === 'relic_mark' || e.sub === 'relic_return' ? 4 : 1
    case 'injury':
      return e.sub === 'serious' ? 4 : 1
    case 'dungeon':
      return e.sub === 'gate_first' ? 4 : 1
    case 'check':
      if (category === 'chain' || category === 'fate') return 4
      return e.check?.result === 'crit_success' || e.check?.result === 'crit_failure' ? 3 : 1
    default:
      return 1
  }
}

// 18 §2.3 후보에서 빼는 기록. all = 이 인물의 기록 전부(일상 포함, id 순)
function excluded(e: ChronicleEntry, all: readonly ChronicleEntry[]): boolean {
  if ((e.bundle_count ?? 1) >= 2) return true
  if (e.tag === 'house' || e.tag === 'retire' || e.tag === 'death') return true
  if (e.tag === 'check' && e.sub === 'final_check') return true
  if (e.tag === 'important') {
    const ev = e.refs?.event_id
    if (!ev) return true // 사건이 아닌 [중요]는 안내(12 §5.1 유품 안내 등)다
    if (all.some((x) => x.id > e.id && x.refs?.event_id === ev)) return true // 결과 기록이 제시·대기 장면을 대신한다
  }
  return false
}

// 18 §4.1 선별 점수(기본 + 태그 첫 기록 +3 + 유품 +3 + 인용 쌍 +2). first = 이 인물의 태그별 첫 기록(묶음 제외) id
export function entryScore(e: ChronicleEntry, category: string | undefined, first: ReadonlyMap<string, number>, relics: ReadonlySet<string>): number {
  let score = baseScore(e, category)
  if (first.get(e.tag) === e.id) score += 3
  if (e.refs?.item_uid !== undefined && relics.has(e.refs.item_uid)) score += 3
  if (e.detail && QUOTE_PAIR.test(e.detail)) score += 2
  return score
}

// 18 §4.1 동률 순서: 점수 높은 것 → 유효 분이 이른 것 → id가 작은 것
export const byScore = <T extends { score: number; e: Pick<ChronicleEntry, 'eff_min' | 'id'> }>(a: T, b: T): number =>
  b.score - a.score || Math.round(a.e.eff_min * 100) - Math.round(b.e.eff_min * 100) || a.e.id - b.e.id

// 이 인물의 연대기 주요 기록. 점수 상위 n = min(후보 수, clamp(점수 기준 이상 후보 수))개를 시간 순서로 돌려준다
export function chronicleMajor<T extends ChronicleEntry>(entries: readonly T[], charUid: string, opts: ChronicleOptions): T[] {
  const all = entries.filter((e) => e.char_uid === charUid).sort((a, b) => a.id - b.id)
  const mine = all.filter((e) => e.importance !== 'daily')
  const relics = new Set(opts.relicUids)
  const firstOfTag = new Map<string, number>()
  for (const e of mine) if (!e.bundle_count && !firstOfTag.has(e.tag)) firstOfTag.set(e.tag, e.id)
  const categoryOf = (e: ChronicleEntry): string | undefined => (e.refs?.event_id ? opts.eventCategory(e.refs.event_id) : undefined)
  const candidate = (e: T): boolean => {
    if (excluded(e, all)) return false
    const relic = e.refs?.item_uid !== undefined && relics.has(e.refs.item_uid)
    return e.tag === 'important' || e.tag === 'bond'
      || (e.tag === 'discovery' && (e.sub === 'family_first' || firstOfTag.get(e.tag) === e.id))
      || (e.tag === 'gear' && relic)
      || (e.tag === 'trait' && e.sub === 'trait_gain')
      || categoryOf(e) === 'fate'
  }
  const scored = mine.filter(candidate).map((e) => ({ e, score: entryScore(e, categoryOf(e), firstOfTag, relics) }))
  const [lo, hi] = opts.clamp
  const strong = scored.filter((s) => s.score >= opts.scoreGte).length
  const n = Math.min(scored.length, Math.max(lo, Math.min(hi, strong)))
  return scored
    .sort(byScore)
    .slice(0, n)
    .map((s) => s.e)
    .sort((a, b) => a.id - b.id)
}
