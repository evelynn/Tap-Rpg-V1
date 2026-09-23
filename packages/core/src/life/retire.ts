// 은퇴와 긴 잠(09 §3~§4). 은퇴 예정 나이 도달 → 새 출정 금지 → 귀환 → 마을 도착 시 생애 종료 사건.
// 은퇴 역할 점수와 효과의 단일 출처는 retire_role 정의이고, 여기서는 그것을 채점하고 가문에 남긴다.
import { characterOf, type RuleContext } from '../rules/context'
import type { ModSource } from '../rules/modifiers'
import type { END_KINDS } from '../schema/index'
import type { Family } from '../state/family'
import { ageAt } from '../time/index'
import { currentAge } from './aging'
import { longSleepDue, type LongSleepCause } from './vampire'

export type EndKind = (typeof END_KINDS)[number]

// 이번 생애가 끝나는 나이: 변이가 있으면 긴 잠 나이가 은퇴 예정 나이를 대신한다(09 §7.6)
export function retireAgeOf(ctx: RuleContext): number {
  const ch = characterOf(ctx)
  return ch.mutation ? ch.mutation.long_sleep_age : ch.retire_age
}

export interface LifeEndDue {
  kind: EndKind
  cause: 'age' | LongSleepCause
}

// 생애 종료가 예정됐는지(09 §3.1 표). 사망은 최후 판정 쪽(T5)이 정하므로 여기서 보지 않는다
export function lifeEndDue(ctx: RuleContext): LifeEndDue | null {
  const ch = characterOf(ctx)
  if (ch.mutation) {
    const cause = longSleepDue(ctx)
    return cause ? { kind: 'long_sleep', cause } : null
  }
  return currentAge(ctx) >= ch.retire_age ? { kind: 'retired', cause: 'age' } : null
}

// 은퇴 예정: 새 출정 후보를 모두 빼고, 출정 중이면 다음 판단 지점에서 귀환을 시작한다(09 §3.1).
// 저장 플래그를 따로 두지 않고 나이로 계산한다(재진입해도 같은 값이다)
export function retirePending(ctx: RuleContext): boolean {
  return lifeEndDue(ctx) !== null
}

export interface EarlyRetire {
  allowed: boolean
  reason: string | null
  confirms: number // 확인 창 횟수(09 §3.3: 기본 1회, 30세 미만이면 2회)
}

// 조기 은퇴(09 §3.3): 마을 대기·정비, 선택 대기 없음, 25세 이상
export function earlyRetireCheck(ctx: RuleContext): EarlyRetire {
  const { content, state } = ctx
  const e = content.balance.inheritance.early_retire
  const age = currentAge(ctx)
  const st = state.current_activity.state
  if (state.pending_choice !== null) return { allowed: false, reason: '선택 대기 중이다', confirms: 0 }
  if (st !== 'town_idle' && st !== 'town_prep') return { allowed: false, reason: '마을에 있지 않다', confirms: 0 }
  if (age < e.min_age) return { allowed: false, reason: `${e.min_age}세부터 은퇴할 수 있다`, confirms: 0 }
  return { allowed: true, reason: null, confirms: age < e.confirm_below ? 2 : 1 }
}

// ── 은퇴 후 역할(09 §4.1) ──

export interface RoleScore {
  id: string
  name: string
  points: number
  tieWinner: boolean
}

export function retireRoleScores(ctx: RuleContext): RoleScore[] {
  return ctx.content.list('retire_role').map((r) => ({
    id: r.id,
    name: r.name,
    points: r.base_points + r.score.filter((s) => ctx.test(s.when)).reduce((n, s) => n + s.points, 0),
    tieWinner: r.tie_winner,
  }))
}

export interface RetireRolePick {
  id: string
  name: string // fallback이면 fallback_name
  points: number
  fallback: boolean
}

// 점수가 가장 높은 역할. 동점이면 tie_winner. 모두 1 이하이고 가정이 없으면 서술만 바꾼다(09 §4.1)
export function pickRetireRole(ctx: RuleContext): RetireRolePick {
  const scores = retireRoleScores(ctx)
  if (!scores.length) throw new Error('은퇴 역할 정의가 없다(retire_role)')
  const top = Math.max(...scores.map((s) => s.points))
  const tied = scores.filter((s) => s.points === top)
  const won = tied.find((s) => s.tieWinner) ?? tied[0]!
  const def = ctx.content.get('retire_role', won.id)
  const noHousehold = scores.every((s) => s.points <= 1)
  const fallback = noHousehold && def.fallback_name !== undefined
  return { id: won.id, name: fallback ? def.fallback_name! : def.name, points: won.points, fallback }
}

// 은퇴 인물을 가문에 남긴다(family.retirees + 역할 가문 플래그). 사망 인물은 부르지 않는다(09 §4.2)
export function registerRetiree(ctx: RuleContext, roleId: string): void {
  const { content, state } = ctx
  const ch = characterOf(ctx)
  const def = content.get('retire_role', roleId)
  const until = def.until_heir_age || content.balance.inheritance.retiree_visible_until_heir_age
  state.family.retirees.push({
    char_uid: ch.uid,
    name: ch.name,
    retired_age: currentAge(ctx),
    role: roleId,
    visible_until_heir_age: until,
  })
  state.family.flags[def.family_flag] = true
  state.family.flag_meta[def.family_flag] = { set_gen: state.family.generation }
}

export type Retiree = Family['retirees'][number]

// 후계자에게 아직 보이는 은퇴 인물(09 §4.1 "후계자 30세까지")
export function livingRetirees(ctx: RuleContext): Retiree[] {
  const age = currentAge(ctx)
  return ctx.state.family.retirees.filter((r) => age < r.visible_until_heir_age)
}

// retire_role.heir_modifiers 출처(ARCHITECTURE §3 "아직 모으지 않는 수정자 출처 3종" 중 T10 몫).
// collectModSources에 이 목록을 이어 붙이면 여관비 할인 같은 효과가 산다
export function retireeModSources(ctx: RuleContext): ModSource[] {
  return livingRetirees(ctx).map((r) => {
    const def = ctx.content.get('retire_role', r.role)
    return { kind: 'situational' as const, key: r.role, label: def.name, modifiers: def.heir_modifiers }
  })
}

// 은퇴 인물이 후계자 생애에 여는 사건(교관의 교육 사건 등)
export function retireeHeirEvents(ctx: RuleContext): string[] {
  const out: string[] = []
  for (const r of livingRetirees(ctx)) {
    for (const id of ctx.content.get('retire_role', r.role).heir_events) if (!out.includes(id)) out.push(id)
  }
  return out
}

// ── S07 편지(09 §4.2) ──

export type LetterKind = 'regular' | 'final'

export interface LetterState {
  kind: LetterKind | null
  retiree: Retiree | null
  chance: number
  gapOk: boolean
  sent: number
}

// 마을 귀환 때 편지를 보낼지. 확률·간격·횟수는 사건 정의(check_override·cooldown_min·max_per_life)가 단일 출처다.
// 마무리 편지는 후계자가 visible_until_heir_age를 넘긴 뒤 첫 귀환에 1회다
export function letterState(ctx: RuleContext, eventId: string): LetterState {
  const { content, state } = ctx
  const ch = characterOf(ctx)
  const ev = content.get('event', eventId)
  const sent = ch.event_counts[eventId] ?? 0
  const max = ev.max_per_life ?? 0
  const age = ageAt(ch.eff_min, content.balance.time)
  const all = state.family.retirees
  const retiree = all.find((r) => age < r.visible_until_heir_age) ?? all.at(-1) ?? null
  const none: LetterState = { kind: null, retiree, chance: 0, gapOk: false, sent }
  if (!retiree) return none
  const last = ch.event_last_min[eventId]
  const gapOk = last === undefined || ch.eff_min - last >= (ev.cooldown_min ?? 0)
  if (age >= retiree.visible_until_heir_age) {
    // 마무리 편지: 남은 한 칸을 쓴다
    return sent >= max ? none : { kind: 'final', retiree, chance: 1, gapOk: true, sent }
  }
  if (sent >= max - 1) return none
  return { kind: 'regular', retiree, chance: ev.check_override ?? 0, gapOk, sent }
}
