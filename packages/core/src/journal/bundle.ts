// 일지 묶음(14 §4). 사냥 조우는 같은 출정에서 연속 10회, 던전 전투 방은 연속 3개까지 기록 1개로 묶는다.
// 묶는 동안의 내역은 출정 칸(sortie.journal_bundle, C32)에 두고, 닫힐 때 기록을 남긴다.
// 닫는 때: 상한에 닿음 · 중요도 B 이상 기록(14 §4) · 같은 태그의 다른 기록(연속이 끊김: 던전 비전투 방·관문) · 출정 종료.
// 1개로 닫히면 묶음이 아니라 개별 기록을 그대로 남긴다(18 §2.3 묶음 = bundle_count ≥ 2).
import type { Content } from '../content/index'
import { registerTextSlot, type JOURNAL_TAGS } from '../schema/index'
import type { Sortie } from '../state/activity'
import type { JournalDraft } from '../state/journal'
import type { SaveBody } from '../state/save'
import { renderTemplate, type TemplateValues } from '../text/index'

type Tag = (typeof JOURNAL_TAGS)[number]
export type BundleTag = NonNullable<Sortie['journal_bundle']>['tag']
type World = { content: Content; state: SaveBody }

// 14 §4 묶음 단위와 펼침 줄 수
export const BUNDLE_LIMIT: Readonly<Record<BundleTag, number>> = { hunt: 10, dungeon: 3 }
export const BUNDLE_ROWS_MAX = 10

export const BUNDLE_TEXT = {
  hunt: 'journal.hunt.bundle',
  hunt_detail: 'journal.hunt.bundle_detail',
  hunt_no_coins: 'journal.hunt.bundle_no_coins',
  hunt_detail_no_coins: 'journal.hunt.bundle_detail_no_coins',
  dungeon: 'journal.dungeon.bundle',
  dungeon_detail: 'journal.dungeon.bundle_detail',
  row: 'journal.sortie.bundle_row',
  row_unhurt: 'journal.sortie.bundle_row_unhurt',
  rest_detail: 'journal.rest.bundle_detail',
} as const
for (const id of Object.values(BUNDLE_TEXT)) registerTextSlot(id, '일지 묶음(14 §4)')

function text(content: Content, id: string, values: TemplateValues): string {
  return renderTemplate(content.get('text', id).variants[0]!, values)
}

// 한 줄 표시 중요도(14 §2). 특성은 획득이 B·반응이 C, 던전은 관문 격파(주요로 남기는 기록)가 B
const GRADE_A: readonly Tag[] = ['important', 'retire', 'death', 'succession']
const GRADE_B: readonly Tag[] = ['gear', 'growth', 'discovery', 'bond', 'injury', 'family', 'house']
const GRADE_D: readonly Tag[] = ['travel', 'rest']

export function journalGrade(d: Pick<JournalDraft, 'tag' | 'sub' | 'importance'>): 'A' | 'B' | 'C' | 'D' {
  if (GRADE_A.includes(d.tag)) return 'A'
  if (GRADE_B.includes(d.tag)) return 'B'
  if (d.tag === 'trait' && d.sub === 'trait_gain') return 'B'
  if (d.tag === 'dungeon' && d.importance === 'major') return 'B'
  return GRADE_D.includes(d.tag) ? 'D' : 'C'
}

// 이 기록이 열린 묶음을 먼저 닫게 하는가
export function breaksBundle(state: SaveBody, d: JournalDraft): boolean {
  const b = state.current_activity.sortie?.journal_bundle
  if (!b) return false
  const g = journalGrade(d)
  return g === 'A' || g === 'B' || d.tag === b.tag
}

// 펼침 내역 한 줄(14 §4 예: `여울 들쥐 · 3라운드 · 체력 −2`, {n} 라운드·{m} 잃은 체력). 다치지 않았으면 체력 항을 뺀다
export function bundleRow(content: Content, enemy: string, rounds: number, hpLost: number): string {
  const hp = Math.max(0, Math.round(hpLost))
  return hp > 0 ? text(content, BUNDLE_TEXT.row, { enemy, n: rounds, m: hp }) : text(content, BUNDLE_TEXT.row_unhurt, { enemy, n: rounds })
}

export interface BundleItem {
  tag: BundleTag
  single: JournalDraft // 1개로 닫힐 때 남길 개별 기록
  coins: number
  depth: number // 던전 방 순번(1부터)
  row: string
}

// 묶음에 1개를 더하고, 상한에 닿았는지를 돌려준다(닫기는 부르는 쪽이 addJournal 경로로 한다)
export function pushBundle(world: World, item: BundleItem): boolean {
  const s = world.state.current_activity.sortie
  if (!s) throw new Error('출정 밖에서는 기록을 묶지 않는다')
  const b = (s.journal_bundle ??= { tag: item.tag, count: 0, coins: 0, depth: 0, rows: [], single: item.single })
  b.count += 1
  b.coins += item.coins
  b.depth = item.depth
  if (b.rows.length < BUNDLE_ROWS_MAX) b.rows.push(item.row)
  return b.count >= BUNDLE_LIMIT[b.tag]
}

// 열린 묶음을 닫아 남길 기록으로 바꾼다(없으면 null). 칸은 지운다
export function takeBundle(world: World): JournalDraft | null {
  const s = world.state.current_activity.sortie
  const b = s?.journal_bundle
  if (!s || !b) return null
  delete s.journal_bundle
  if (b.count === 1) return b.single
  const { content, state } = world
  const place = content.get('region', s.location_id).name
  const refs = { location_id: s.location_id, sortie_id: s.id }
  const rows = b.rows.join('\n')
  if (b.tag === 'hunt') {
    const v = { count: b.count, coins: b.coins, place }
    const paid = b.coins > 0
    return {
      tag: 'hunt',
      line: text(content, paid ? BUNDLE_TEXT.hunt : BUNDLE_TEXT.hunt_no_coins, v),
      detail: `${text(content, paid ? BUNDLE_TEXT.hunt_detail : BUNDLE_TEXT.hunt_detail_no_coins, v)}\n${rows}`,
      bundle_count: b.count,
      refs,
    }
  }
  const v = { count: b.count, depth: b.depth, name: state.character!.name }
  return {
    tag: 'dungeon',
    line: text(content, BUNDLE_TEXT.dungeon, v),
    detail: `${text(content, BUNDLE_TEXT.dungeon_detail, v)}\n${rows}`,
    bundle_count: b.count,
    refs,
  }
}

// 연속 휴식은 첫 휴식 기록 1개로 묶는다(14 §4): 같은 장소의 휴식이 바로 앞 기록이면 그 기록의 상세만 묶음 문형으로 바꾼다
export function restBundleDetail(content: Content, place: string): string {
  return text(content, BUNDLE_TEXT.rest_detail, { place })
}
