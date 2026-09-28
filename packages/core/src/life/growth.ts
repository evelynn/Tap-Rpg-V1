// 레벨업·숙련 상승 [성장] 기록(05 §3.4·§5.1, 14 §5.1, D77). 판단 지점에서 마지막으로 알린 값(life_loop.growth_seen)과
// 지금 값을 비교해 오른 만큼 기록을 만든다. 상세에는 무엇이 좋아졌는지(최대 체력, 오른 능력치와 쓰임, 숙련이 더하는 판정)를 쓴다.
import type { JournalDraft } from '../state/journal'
import type { LifeLoopState } from '../state/activity'
import { SKILLS, registerTextSlot } from '../schema/index'
import { characterOf, type RuleContext } from '../rules/context'
import { maxHp } from '../rules/derived'
import { SKILL_LABELS, STAT_LABELS } from '../rules/labels'
import { textLine } from './text'

type Skill = (typeof SKILLS)[number]
export type GrowthSeen = NonNullable<LifeLoopState['growth_seen']>

export const GROWTH_TEXT = {
  level: 'journal.growth.level',
  levelDetail: 'journal.growth.level_detail',
  levelStatDetail: 'journal.growth.level_stat_detail',
  nextStat: 'journal.growth.next_stat_detail',
  statUse: 'journal.growth.stat_use_detail',
  skillRank: 'journal.growth.skill_rank',
  skillRankDetail: 'journal.growth.skill_rank_detail',
  skillNext: 'journal.growth.skill_next_detail',
  skillMax: 'journal.growth.skill_max_detail',
} as const
// {use} 값(명사구). 인물 탭도 같은 문형을 읽는다(03 §5.3)
export const statUseText = (stat: keyof typeof STAT_LABELS): string => `journal.growth.stat_use.${stat}`
export const skillUseText = (skill: Skill): string => `journal.growth.skill_use.${skill}`

for (const id of [
  ...Object.values(GROWTH_TEXT),
  ...(Object.keys(STAT_LABELS) as (keyof typeof STAT_LABELS)[]).map(statUseText),
  ...SKILLS.map(skillUseText),
]) registerTextSlot(id, '성장 기록(D77)')

export function growthSeenOf(ctx: RuleContext): GrowthSeen {
  const ch = characterOf(ctx)
  return { char_uid: ch.uid, level: ch.level, ranks: Object.fromEntries(SKILLS.map((s) => [s, ch.skills[s].rank])) as GrowthSeen['ranks'] }
}

// 레벨 level일 때의 최대 체력: 그보다 높은 레벨에서 배분한 능력치를 빼고 잰다(레벨업 한 번이 늘린 몫을 가르기 위해)
function maxHpAt(ctx: RuleContext, level: number): number {
  const ch = characterOf(ctx)
  const saved = { level: ch.level, stats: { ...ch.stats } }
  for (const g of ch.stat_growth) if (g.level > level && g.level <= saved.level) ch.stats[g.stat] -= 1
  ch.level = level
  try {
    return maxHp(ctx)
  } finally {
    ch.level = saved.level
    Object.assign(ch.stats, saved.stats)
  }
}

export interface GrowthNotes {
  drafts: JournalDraft[]
  seen: GrowthSeen
  levelFrom: number | null // 레벨이 올랐으면 알리기 전 레벨(잠재 유품 개방 검사용)
}

// seen이 없거나 다른 인물 것이면(새 인물·옛 저장) 기록 없이 지금 값으로 맞춘다
export function growthNotes(ctx: RuleContext, seen: GrowthSeen | null | undefined): GrowthNotes {
  const { content } = ctx
  const ch = characterOf(ctx)
  const now = growthSeenOf(ctx)
  if (!seen || seen.char_uid !== ch.uid) return { drafts: [], seen: now, levelFrom: null }
  const drafts: JournalDraft[] = []
  const growthLevels = content.balance.stats.growth_levels
  for (let lv = seen.level + 1; lv <= ch.level; lv++) {
    const stat = ch.stat_growth.find((g) => g.level === lv)?.stat ?? null
    const hp = maxHpAt(ctx, lv) - maxHpAt(ctx, lv - 1)
    const lines = stat
      ? [
          textLine(content, GROWTH_TEXT.levelStatDetail, { name: ch.name, level: lv, hp, stat: STAT_LABELS[stat] }, '{name:은/는} 레벨 {level:이/가} 되었다.'),
          textLine(content, GROWTH_TEXT.statUse, { stat: STAT_LABELS[stat], use: textLine(content, statUseText(stat), {}, STAT_LABELS[stat]) }, ''),
        ]
      : [textLine(content, GROWTH_TEXT.levelDetail, { name: ch.name, level: lv, hp }, '{name:은/는} 레벨 {level:이/가} 되었다.')]
    const next = growthLevels.find((g) => g > lv)
    if (next !== undefined) lines.push(textLine(content, GROWTH_TEXT.nextStat, { level: next }, ''))
    const five = lv % 5 === 0
    drafts.push({
      tag: 'growth',
      line: textLine(content, GROWTH_TEXT.level, { level: lv }, '레벨 {level:이/가} 되었다'),
      detail: lines.filter(Boolean).join('\n'),
      ...(five ? { sub: 'level5' as const, importance: 'major' as const } : {}),
    })
  }
  const b = content.balance.skills
  for (const s of SKILLS) {
    const to = ch.skills[s].rank
    for (let r = seen.ranks[s] + 1; r <= to; r++) {
      const use = textLine(content, skillUseText(s), {}, SKILL_LABELS[s])
      const lines = [textLine(content, GROWTH_TEXT.skillRankDetail, { skill: SKILL_LABELS[s], n: r, use }, '{skill} 숙련이 {n}단계가 되었다.')]
      if (r === to) {
        const need = b.rank_thresholds[r]
        lines.push(r >= b.max_rank || need === undefined
          ? textLine(content, GROWTH_TEXT.skillMax, {}, '')
          : textLine(content, GROWTH_TEXT.skillNext, { count: Math.max(1, Math.ceil(need - ch.skills[s].uses - 1e-9)) }, ''))
      }
      drafts.push({ tag: 'growth', line: textLine(content, GROWTH_TEXT.skillRank, { skill: SKILL_LABELS[s] }, '{skill} 솜씨가 한 단계 늘었다'), detail: lines.filter(Boolean).join('\n') })
    }
  }
  return { drafts, seen: now, levelFrom: ch.level > seen.level ? seen.level : null }
}
