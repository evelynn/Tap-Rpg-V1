// 가문 기록(12 §7·§8): 별칭, 가문 업적과 해금, 연대기 항목(life_record).
// 별칭·업적의 조건은 콘텐츠(epithet·achievement)가 단일 출처이고, 여기서는 평가하고 남기기만 한다.
import { makeConditionTest } from '../events/conditions'
import { emptyScope, type EventScope, type EventWorld } from '../events/scope'
import { markLastChapter } from '../journal/index'
import { characterOf, type RuleContext } from '../rules/context'
import { registerTextSlot, type END_KINDS } from '../schema/index'
import type { Character } from '../state/character'
import type { LifeRecord } from '../state/family'
import type { JournalDraft } from '../state/journal'
import { renderTemplate, templateVars } from '../text/index'
import { textLine } from '../life/text'
import { ageAt } from '../time/index'

type EndKind = (typeof END_KINDS)[number]

// 12 §7.5: priority가 작은 것부터 첫 참 하나. 생애 종료 2단계에서 한 번 준다.
// {parent_call}을 쓰는 별칭(1순위 "이전 인물의 R04를 받음")은 앞 세대가 없으면 건너뛴다(빈 호칭으로 "의 잔을 비운"이 되지 않게)
export function pickEpithet(w: EventWorld, scope: EventScope): string {
  const ch = w.state.character
  if (!ch) throw new Error('별칭을 줄 인물이 없다')
  const test = makeConditionTest(w, scope)
  const values: Record<string, string> = { name: ch.name, ...(ch.parent_call !== null ? { parent_call: ch.parent_call } : {}) }
  const list = [...w.content.list('epithet')].sort((a, b) => a.priority - b.priority)
  const hit = list.find((e) => templateVars(e.template).every((v) => v in values) && test(e.condition))
  if (!hit) return ch.name
  return renderTemplate(hit.template, values)
}

export interface AchievementGrant {
  id: string
  name: string
  journal: JournalDraft
}

// 14 §5.1 [가문] 업적 문장. 조사는 업적 이름을 따라 붙인다(은빛 패를, 첫 관문 돌파를)
const ACHIEVEMENT_LINE = '{achievement:을/를} 이루었다'
const ACHIEVEMENT_DETAIL = 'journal.house.achievement_detail'
registerTextSlot(ACHIEVEMENT_DETAIL, '생애·계승(T10)')

// 12 §8.4: 가문 전체에서 한 번만. 보상은 출신 배경·외형·칭호만 저장 칸이 있다(연대기 장식·가문 탭은 표시 전용)
export function checkAchievements(w: EventWorld, scope: EventScope = emptyScope(null)): AchievementGrant[] {
  const fam = w.state.family
  const ch = w.state.character
  if (!ch) return []
  const test = makeConditionTest(w, scope)
  const out: AchievementGrant[] = []
  for (const a of w.content.list('achievement')) {
    if (fam.achievements[a.id] !== undefined || !test(a.condition)) continue
    fam.achievements[a.id] = { gen: fam.generation, char_uid: ch.uid }
    for (const r of a.rewards) {
      if (r.kind === 'background' && !fam.unlocks.backgrounds.includes(r.id)) fam.unlocks.backgrounds.push(r.id)
      else if (r.kind === 'appearance' && !fam.unlocks.appearances.includes(r.id)) fam.unlocks.appearances.push(r.id)
      else if (r.kind === 'title' && !fam.unlocks.titles.includes(r.text)) fam.unlocks.titles.push(r.text)
    }
    out.push({
      id: a.id,
      name: a.name,
      journal: {
        tag: 'house', importance: 'family',
        line: a.line ?? renderTemplate(ACHIEVEMENT_LINE, { achievement: a.name }),
        detail: textLine(w.content, ACHIEVEMENT_DETAIL, { family: fam.name, achievement: a.name }, '{family} 가문이 {achievement:을/를} 이루었다.'),
      },
    })
  }
  return out
}

// 태도별 누적 유효 진행 분(연대기 "태도 도전적 → 모험적(41세)")
export function attitudesUsed(ch: Character): Record<string, number> {
  const out: Record<string, number> = {}
  const log = [...ch.attitude_log].sort((a, b) => a.eff_min - b.eff_min)
  for (let i = 0; i < log.length; i++) {
    const from = log[i]!
    const to = log[i + 1]?.eff_min ?? ch.eff_min
    out[from.attitude] = (out[from.attitude] ?? 0) + Math.max(0, to - from.eff_min)
  }
  return out
}

export interface LifeRecordInput {
  endKind: EndKind
  epithet: string
  retireRole: string | null
  cause: LifeRecord['cause']
  unfinished: string[]
  relicsPassed: string[]
  longSleep: LifeRecord['long_sleep']
  receivedRelicUids: string[]
}

const COUNTER_KEYS = {
  sorties: 'sorties',
  encounters: 'encounters',
  defeats: 'defeats',
  serious_injuries: 'serious_injuries',
  coins_earned: 'coins_earned',
} as const

// 12 §7.1 연대기 항목. 주요 기록은 [중요]·[인연]·[발견]·[가족] 보존 기록에서 clamp 개수만큼 고른다
// (18 §4.1 선별 점수는 생애의 책 몫이라 여기서는 보존 등급으로 근사한다)
export function buildLifeRecord(ctx: RuleContext, input: LifeRecordInput): LifeRecord {
  const { content, state } = ctx
  const ch = characterOf(ctx)
  const [lo, hi] = content.balance.inheritance.chronicle_major.clamp
  const major = state.journal
    .filter((e) => e.char_uid === ch.uid && (e.importance === 'major' || e.importance === 'family'))
    .map((e) => e.id)
  const count = Math.min(major.length, Math.max(lo, Math.min(hi, major.length)))
  return {
    gen: ch.generation,
    char_uid: ch.uid,
    name: ch.name,
    epithet: input.epithet,
    family_role: ch.family_role,
    end_age: ageAt(ch.eff_min, content.balance.time),
    end_kind: input.endKind,
    retire_role: input.retireRole,
    cause: input.cause,
    attitudes_used: attitudesUsed(ch),
    specialization: ch.specialization,
    mutation: ch.mutation ? 'vampire' : 'none',
    peak_level: ch.level,
    summary: {
      sorties: ch.counters[COUNTER_KEYS.sorties] ?? 0,
      encounters: ch.counters[COUNTER_KEYS.encounters] ?? 0,
      defeats: ch.counters[COUNTER_KEYS.defeats] ?? 0,
      serious_injuries: ch.counters[COUNTER_KEYS.serious_injuries] ?? 0,
      discoveries: ch.discoveries.length,
      coins_earned: ch.counters[COUNTER_KEYS.coins_earned] ?? 0,
    },
    life_flags: { ...ch.flags },
    unfinished: input.unfinished,
    relics_passed: input.relicsPassed,
    major_entry_ids: major.slice(-count),
    attitude_log: ch.attitude_log.map((a) => ({ ...a })),
    birth_season: ch.birth_season,
    retire_age: ch.retire_age,
    guild_rank: ch.guild_rank,
    long_sleep: input.longSleep,
    received_relic_uids: input.receivedRelicUids,
    mutation_eff_min: ch.mutation ? (ch.mutation.since_age - content.balance.time.start_age) * content.balance.time.min_per_year : null,
    book: null,
  }
}

// 생애 종료 1단계: 마지막 장으로 올린다(14 §1, 13 §9). 올린 기록 id를 돌려준다
export function closeJournal(ctx: RuleContext): number[] {
  return markLastChapter(ctx.state, characterOf(ctx).uid, ctx.content.balance.ui.last_chapter_keep)
}
