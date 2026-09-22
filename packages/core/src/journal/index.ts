// 일지 기록 생성과 보존(14 §1~§2, 13 §9, 16 §5.6). 문장은 렌더링이 끝난 문자열로 받는다.
import type { Content } from '../content/index'
import type { JOURNAL_IMPORTANCE, JOURNAL_TAGS } from '../schema/index'
import type { JournalDraft, JournalEntry } from '../state/journal'
import type { SaveBody } from '../state/save'
import { issueJournalId } from '../state/uid'
import { ageAt, seasonAt } from '../time/index'

type Tag = (typeof JOURNAL_TAGS)[number]
type Importance = (typeof JOURNAL_IMPORTANCE)[number]

// 태그만으로 정해지는 보존(13 §9): [은퇴][사망][계승][가문] 가문, [중요][발견][인연][가족] 주요. 나머지는 부르는 쪽이 정한다
const FAMILY_TAGS: readonly Tag[] = ['retire', 'death', 'succession', 'house']
const MAJOR_TAGS: readonly Tag[] = ['important', 'discovery', 'bond', 'family']

export function defaultImportance(tag: Tag): Importance {
  return FAMILY_TAGS.includes(tag) ? 'family' : MAJOR_TAGS.includes(tag) ? 'major' : 'daily'
}

// 기록 1개를 만든다: 가문 일련번호 id, 현재 인물의 시점(나이·계절). 태그별 생애 첫 기록(묶음 제외)은
// 주요로 올린다(14 §2). 그 뒤 일상 기록을 인물당 ui.journal_keep개로 자른다
export function addJournal(
  world: { content: Content; state: SaveBody },
  draft: JournalDraft,
  opts: { offline?: boolean } = {},
): JournalEntry {
  const { content, state } = world
  const ch = state.character
  if (!ch) throw new Error('현재 인물이 없어 기록을 남길 수 없다')
  const time = content.balance.time
  let importance = draft.importance ?? defaultImportance(draft.tag)
  if (importance === 'daily' && !draft.bundle_count && !state.journal.some((e) => e.char_uid === ch.uid && e.tag === draft.tag && !e.bundle_count)) {
    importance = 'major'
  }
  const entry: JournalEntry = {
    id: issueJournalId(state.family),
    gen: ch.generation,
    char_uid: ch.uid,
    eff_min: ch.eff_min,
    age: ageAt(ch.eff_min, time),
    season: seasonAt(ch.eff_min, ch.birth_season, time),
    ...draft,
    importance,
    offline: opts.offline ?? false,
  }
  state.journal.push(entry)
  trimDaily(state, ch.uid, content.balance.ui.journal_keep)
  return entry
}

// 인물의 일상 기록을 최근 keep개만 남긴다(오래된 것부터 삭제)
export function trimDaily(state: SaveBody, charUid: string, keep: number): void {
  const daily = state.journal.filter((e) => e.char_uid === charUid && e.importance === 'daily')
  if (daily.length <= keep) return
  const drop = new Set(daily.slice(0, daily.length - keep))
  state.journal = state.journal.filter((e) => !drop.has(e))
}

// 생애 종료 1단계: 일상 기록 중 마지막 keep개를 마지막 장으로 올린다(14 §1). 올린 기록 id를 돌려준다
export function markLastChapter(state: SaveBody, charUid: string, keep: number): number[] {
  const daily = state.journal.filter((e) => e.char_uid === charUid && e.importance === 'daily')
  const last = daily.slice(Math.max(0, daily.length - keep))
  for (const e of last) e.importance = 'last_chapter'
  return last.map((e) => e.id)
}

// 생애 종료 마지막 단계(생애의 책을 엮은 뒤): 남은 일상 기록을 지운다(13 §9)
export function purgeDaily(state: SaveBody, charUid: string): void {
  state.journal = state.journal.filter((e) => !(e.char_uid === charUid && e.importance === 'daily'))
}
