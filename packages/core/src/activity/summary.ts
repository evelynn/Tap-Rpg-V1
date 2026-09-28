// 최근 요약(14 §1.1, D77): 출정이 끝나 마을에 닿을 때 출정 요약, 다음 출정을 떠날 때 마을 체류 요약을 만든다.
// 렌더링 끝난 문장으로 character.recent_summaries에 두고 balance.ui.recent_summary_keep개만 남긴다.
import { baseScore, journalGrade } from '../journal/index'
import { characterOf } from '../rules/context'
import { maxHp } from '../rules/derived'
import { xpToNext } from '../rules/growth'
import { registerTextSlot } from '../schema/index'
import type { Sortie } from '../state/activity'
import type { JournalEntry } from '../state/journal'
import { ageAt, seasonAt } from '../time/index'
import { render } from '../events/index'
import type { World } from '../sim/world'

export const SUMMARY_TEXT = {
  hunt: 'journal.summary.hunt',
  huntNone: 'journal.summary.hunt_none',
  dungeon: 'journal.summary.dungeon',
  dungeonGate: 'journal.summary.dungeon_gate',
  adventure: 'journal.summary.adventure',
  defeat: 'journal.summary.defeat',
  town: 'journal.summary.town',
  townNoRest: 'journal.summary.town_no_rest',
  sortieNumbers: 'journal.summary.sortie_numbers',
  townNumbers: 'journal.summary.town_numbers',
  noInjury: 'journal.summary.no_injury',
} as const
for (const id of Object.values(SUMMARY_TEXT)) registerTextSlot(id, '최근 요약(14 §1.1)')

// 마을 체류를 세는 카운터(16 §5.7 sortie.start 설명)
export const STAY = { coins: 'stay_coins', rests: 'stay_rests', fromJr: 'stay_from_jr' } as const

const text = (world: World, id: string, v: Record<string, string | number> = {}): string => render(world.content.get('text', id).variants[0]!, v)

// 레벨 1부터 쌓은 경험치 합(레벨업으로 xp가 줄어도 얻은 양을 세기 위해)
function totalXp(world: World, level: number, xp: number): number {
  let sum = xp
  for (let l = 1; l < level; l++) sum += xpToNext(world.content, l) ?? 0
  return sum
}

function bodyLine(world: World): { hp: number; injury: string } {
  const ch = characterOf(world)
  const light = ch.injuries.filter((i) => i.grade === 'light').length
  const serious = ch.injuries.filter((i) => i.grade === 'serious').length
  const parts = [serious ? `중상 ${serious}` : '', light ? `경상 ${light}` : ''].filter(Boolean)
  return { hp: Math.round((Math.max(0, ch.hp) / maxHp(world)) * 100), injury: parts.length ? parts.join(' · ') : text(world, SUMMARY_TEXT.noInjury) }
}

// 가운데 문장: 그 기간 이 인물의 중요도 A·B 기록(묶음 제외)을 18 §4.1 점수 높은 순, 같으면 나중 것부터
function highlights(world: World, fromJr: number, n: number): string[] {
  const ch = characterOf(world)
  const cat = (id: string | undefined): string | undefined => (id && world.content.has('event', id) ? world.content.get('event', id).category : undefined)
  const pool: JournalEntry[] = world.state.journal.filter((e) => e.id >= fromJr && e.char_uid === ch.uid && !(e.bundle_count && e.bundle_count > 1)
    && ['A', 'B'].includes(journalGrade(e)))
  return pool
    .map((e) => ({ e, score: baseScore(e, cat(e.refs?.event_id)) }))
    .sort((a, b) => b.score - a.score || b.e.id - a.e.id)
    .slice(0, n)
    .sort((a, b) => a.e.id - b.e.id)
    .map(({ e }) => (/[.?!"”]$/.test(e.line) ? e.line : `${e.line}.`))
}

function push(world: World, kind: 'sortie' | 'town', lines: string[]): void {
  const ch = characterOf(world)
  const time = world.content.balance.time
  ch.recent_summaries.push({ kind, eff_min: ch.eff_min, age: ageAt(ch.eff_min, time), season: seasonAt(ch.eff_min, ch.birth_season, time), lines })
  const keep = world.content.balance.ui.recent_summary_keep
  if (ch.recent_summaries.length > keep) ch.recent_summaries.splice(0, ch.recent_summaries.length - keep)
}

// 출정 요약: 마을에 닿은 직후(마을 정비 전) 부른다. 떠날 때 값이 없는 옛 출정은 만들지 않는다
export function sortieSummary(world: World, s: Sortie, defeated: boolean): void {
  if (!s.start) return
  const ch = characterOf(world)
  const place = world.content.get('region', s.location_id).name
  const gate = world.state.journal.some((e) => e.id >= s.start!.jr && e.refs?.sortie_id === s.id && e.tag === 'dungeon' && e.importance === 'major')
  const first = defeated ? text(world, SUMMARY_TEXT.defeat, { place })
    : s.activity === 'dungeon' ? (gate ? text(world, SUMMARY_TEXT.dungeonGate, { place }) : text(world, SUMMARY_TEXT.dungeon, { place, depth: Math.max(1, s.progress) }))
      : s.activity === 'adventure' ? text(world, SUMMARY_TEXT.adventure, { place, count: Math.max(1, s.progress) })
        : s.progress > 0 ? text(world, SUMMARY_TEXT.hunt, { place, count: s.progress }) : text(world, SUMMARY_TEXT.huntNone, { place })
  const xp = Math.max(0, totalXp(world, ch.level, ch.xp) - totalXp(world, s.start.level, s.start.xp))
  const body = bodyLine(world)
  push(world, 'sortie', [first, ...highlights(world, s.start.jr, 2), text(world, SUMMARY_TEXT.sortieNumbers, { coins: s.loot.coins, xp, hp: body.hp, injury: body.injury })])
  ch.counters[STAY.coins] = ch.coins
  ch.counters[STAY.rests] = 0
  ch.counters[STAY.fromJr] = world.state.family.next_uid.jr
}

// 마을 체류 요약: 다음 출정을 떠날 때 부른다. 귀환 기록이 없으면(첫 출정·계승 직후) 만들지 않는다
export function townSummary(world: World): void {
  const ch = characterOf(world)
  const from = ch.counters[STAY.fromJr]
  if (from === undefined) return
  const rests = ch.counters[STAY.rests] ?? 0
  const diff = ch.coins - (ch.counters[STAY.coins] ?? ch.coins)
  const body = bodyLine(world)
  const first = rests > 0 ? text(world, SUMMARY_TEXT.town, { count: rests }) : text(world, SUMMARY_TEXT.townNoRest)
  const coins = diff < 0 ? `−${-diff}` : `+${diff}`
  push(world, 'town', [first, ...highlights(world, from, 1), text(world, SUMMARY_TEXT.townNumbers, { coins, hp: body.hp, injury: body.injury })])
  delete ch.counters[STAY.fromJr]
  delete ch.counters[STAY.coins]
  delete ch.counters[STAY.rests]
}

// 출정을 떠날 때의 값(sortie.start)
export const sortieStart = (world: World): NonNullable<Sortie['start']> => {
  const ch = characterOf(world)
  return { level: ch.level, xp: ch.xp, coins: ch.coins, jr: world.state.family.next_uid.jr }
}
