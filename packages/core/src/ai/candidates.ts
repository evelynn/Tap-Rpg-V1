// 활동 후보와 필터 F1~F9(04 §4). 후보는 마을 밖 장소이며 밤 출정이면 위험 차에 +1이 들어 있다.
import type { ContentDef } from '../content/index'
import { characterOf, type RuleContext } from '../rules/context'
import { potionsOwned } from '../recovery/rest'
import {
  activityOf, riskCap, riskDiff, riskGrade, riskRank, type Activity, type ActivityRisk,
} from './risk'

export type Region = ContentDef<'region'>

export interface Candidate {
  id: string
  activity: Activity
  diff: number // 위험 차(밤 가산 포함)
  grade: ActivityRisk
}

// 목적지 고정 중인가(방침 destination이 'auto'가 아니면 그 장소 id)
export function fixedDestination(ctx: RuleContext): string | null {
  const d = ctx.state.policies.destination
  return ctx.content.has('region', d) ? d : null
}

// F1 해금: 장소 정의의 unlock 조건. 발견형 해금의 후손 면제는 조건식(discovered)이 가문 기록을 본다(07 §6.5)
export const isUnlocked = (ctx: RuleContext, r: Region): boolean => ctx.test(r.unlock)

// F2 길드 등급
export function rankAllowed(ctx: RuleContext, r: Region): boolean {
  const need = r.guild_rank_req
  if (need === undefined) return true
  const { content } = ctx
  return content.get('guild_rank', characterOf(ctx).guild_rank).order >= content.get('guild_rank', need).order
}

// F8 적자: 이번 결정 순번이 제외 기한 안이면 뺀다(04 §4.3)
export function inDeficit(ctx: RuleContext, r: Region): boolean {
  const ch = characterOf(ctx)
  if (r.deficit_exempt === 'always') return false
  if (r.deficit_exempt === 'during_aid' && ch.guild_aid.active) return false
  const d = ch.deficit[r.id]
  return d?.excluded_until_decision != null && ch.decision_seq < d.excluded_until_decision
}

export interface FilterOptions {
  night: boolean
  ignoreDestination?: boolean // 4.4 (2) 고정 장소가 F4에서 떨어져 이번 출정만 고정을 무시한다
  skipRiskFilters?: boolean // 목표 층 계산용(F6·F7을 뒤에서 따로 본다)
}

// F1~F8을 순서대로 적용한다. F9(변이)는 시간대만 바꾸고 장소를 거르지 않는다
export function passesFilters(ctx: RuleContext, r: Region, grade: ActivityRisk, opts: FilterOptions): boolean {
  const { content } = ctx
  const ch = characterOf(ctx)
  const activity = activityOf(r.kind)
  if (!isUnlocked(ctx, r)) return false // F1
  if (!rankAllowed(ctx, r)) return false // F2
  if (ch.guild_aid.active && !r.aid_allowed) return false // F3
  const lights = ch.injuries.filter((i) => i.grade === 'light').length
  if (ch.injuries.some((i) => i.grade === 'serious')) return false // F4
  if (activity === 'dungeon' && lights >= content.balance.activity_ai.filters.dungeon_block_light_injuries) return false // F4
  const fixed = opts.ignoreDestination ? null : fixedDestination(ctx)
  if (fixed !== null) return r.id === fixed // F5: 고정 장소만 남기고 F6~F8은 경고 뒤 통과
  // 길드 순찰 구역(H1·A1)은 F6·F7·F8을 항상 통과한다(01 §7.1, D24)
  if (r.patrol_zone) return true
  if (!opts.skipRiskFilters) {
    // F6 준비 상태: 회복약이 없으면 상한 초과 제외
    if (!potionsOwned(ctx).length && riskRank(grade) > riskRank(content.balance.activity_ai.filters.no_potion_max_risk)) return false
    // F7 위험 상한: 무모는 언제나 제외
    if (grade === 'reckless') return false
    if (riskRank(grade) > riskRank(riskCap(ctx, activity))) return false
  }
  if (inDeficit(ctx, r)) return false // F8
  return true
}

function candidateOf(ctx: RuleContext, r: Region, night: boolean): Candidate {
  const diff = riskDiff(ctx, r.id, night)
  return { id: r.id, activity: activityOf(r.kind), diff, grade: riskGrade(ctx.content, diff) }
}

// 마을 밖 장소를 후보로 올리고 필터를 적용한다
export function filterPlaces(ctx: RuleContext, opts: FilterOptions): Candidate[] {
  const out: Candidate[] = []
  for (const r of ctx.content.list('region')) {
    if (r.kind === 'town') continue
    const c = candidateOf(ctx, r, opts.night)
    if (passesFilters(ctx, r, c.grade, opts)) out.push(c)
  }
  return out
}
