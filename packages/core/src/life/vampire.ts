// 흡혈귀 변이 TM01(09 §7). 수치의 단일 출처는 변이 특성 정의의 mutation 묶음이고(16 §2.7),
// 이 파일은 그것을 읽어 상태를 바꾼다. 능력치 보정·밤낮 확률·마을 제약·갈증·긴 잠이 여기 있다.
// 변이 종류는 코드 열거(MUTATIONS)지만 규칙은 특성 id가 아니라 mutation 필드를 본다(DS-30).
import type { ContentDef } from '../content/index'
import { characterOf, type RuleContext } from '../rules/context'
import { maxHp, statCap } from '../rules/derived'
import { STATS } from '../schema/index'
import type { JournalDraft } from '../state/journal'
import { renderTemplate } from '../text/index'
import { ageAt } from '../time/index'
import { THIRST_DETAIL, textLine } from './text'

export type MutationSpec = NonNullable<ContentDef<'trait'>['mutation']>
export type ThirstStage = MutationSpec['thirst']['stages'][number]

export const THIRST_MIN = 0
export const THIRST_MAX = 100

export function mutationSpec(ctx: RuleContext): MutationSpec | null {
  const ch = characterOf(ctx)
  if (!ch.mutation) return null
  return ctx.content.get('trait', ch.mutation.trait_id).mutation ?? null
}

// 긴 잠 나이 = min(변이 시점의 은퇴 예정 나이 + add_years, cap)(09 §7.6)
export function longSleepAgeFor(retireAge: number, m: MutationSpec): number {
  return Math.min(m.sleep.cap, retireAge + m.sleep.add_years)
}

// 변이 적용(09 §7.1~§7.2): 능력치 보정(상한은 변이 상한, 하한 stat_floor) → 긴 잠 나이 → 갈증 0.
// 이미 변이한 인물에게는 아무 일도 하지 않는다(생애 1회).
export function applyMutation(ctx: RuleContext, traitId: string): boolean {
  const { content } = ctx
  const ch = characterOf(ctx)
  if (ch.mutation) return false
  const m = content.get('trait', traitId).mutation
  if (!m) throw new Error(`변이 특성이 아니다: ${traitId}`)
  ch.mutation = {
    trait_id: traitId,
    since_age: ageAt(ch.eff_min, content.balance.time),
    long_sleep_age: longSleepAgeFor(ch.retire_age, m),
    thirst: 0,
  }
  // 상한은 변이 상한(statCap이 natural_cap_add를 더한다), 하한은 stat_floor
  const before = maxHp(ctx)
  for (const stat of STATS) {
    const add = m.stat_add[stat]
    if (!add) continue
    const next = Math.max(m.stat_floor, Math.min(statCap(ctx, stat), ch.stats[stat] + add))
    if (next === ch.stats[stat]) continue
    ch.life_stat_mods.push({ stat, value: next - ch.stats[stat], source: traitId })
    ch.stats[stat] = next
  }
  ch.hp = Math.min(Math.max(ch.hp, 0) + Math.max(0, maxHp(ctx) - before), maxHp(ctx))
  return true
}

// ── 갈증(09 §7.5) ──

export function thirst(ctx: RuleContext): number {
  return characterOf(ctx).mutation?.thirst ?? 0
}

export function thirstStages(m: MutationSpec): ThirstStage[] {
  return [...m.thirst.stages].sort((a, b) => a.from - b.from)
}

export function thirstStage(ctx: RuleContext): ThirstStage | null {
  const m = mutationSpec(ctx)
  if (!m) return null
  return thirstStages(m).filter((s) => s.from <= thirst(ctx)).pop() ?? null
}

// 마지막 단계(from이 가장 큰 단계)에 닿으면 귀환 → 긴 잠(09 §7.5 한계)
export function atThirstLimit(ctx: RuleContext): boolean {
  const m = mutationSpec(ctx)
  if (!m) return false
  const last = thirstStages(m).at(-1)!
  return thirst(ctx) >= last.from
}

// 갈증 증감. 0~100으로 자르고 실제로 바뀐 값을 돌려준다. 단계가 바뀌면 기록 초안도 만든다
export function addThirst(ctx: RuleContext, delta: number): { value: number; journal: JournalDraft[] } {
  const ch = characterOf(ctx)
  const m = mutationSpec(ctx)
  if (!ch.mutation || !m) return { value: 0, journal: [] }
  const beforeStage = thirstStage(ctx)
  ch.mutation.thirst = Math.max(THIRST_MIN, Math.min(THIRST_MAX, ch.mutation.thirst + delta))
  const after = thirstStage(ctx)
  const journal: JournalDraft[] = []
  if (after && after.id !== beforeStage?.id && after.line !== undefined) {
    const tag = after.from >= THIRST_MAX - 10 ? 'important' : 'trait'
    if (tag === 'important' || firstReactionThisSortie(ctx, after.id)) {
      const detail = textLine(ctx.content, THIRST_DETAIL, { name: ch.name, count: Math.round(thirst(ctx)) }, '')
      journal.push({ tag, line: renderTemplate(after.line, { name: ch.name }), ...(detail ? { detail } : {}) })
    }
  }
  return { value: ch.mutation.thirst, journal }
}

// 같은 특성 반응은 출정당 1회만 기록한다(14 §2). 경계에서 오르내려 같은 단계에 다시 들어가도 한 번이다.
// 표식은 출정 uid 일련번호(family.next_uid.sortie는 출정을 열 때만 오른다)를 카운터에 둔다. 출정 밖(마을)은 늘 남긴다
function firstReactionThisSortie(ctx: RuleContext, stageId: string): boolean {
  if (!ctx.state.current_activity.sortie) return true
  const ch = characterOf(ctx)
  const key = `thirst_line.${stageId}`
  const mark = ctx.state.family.next_uid.sortie
  if (ch.counters[key] === mark) return false
  ch.counters[key] = mark
  return true
}

// 출정 중 유효 진행 1분마다(09 §7.5). 마을·대기 중에는 부르지 않는다
export function thirstFromProgress(ctx: RuleContext, minutes: number): { value: number; journal: JournalDraft[] } {
  const m = mutationSpec(ctx)
  return m ? addThirst(ctx, m.thirst.per_min * minutes) : { value: 0, journal: [] }
}

export function thirstOnSortieStart(ctx: RuleContext, timeOfDay: 'day' | 'night'): { value: number; journal: JournalDraft[] } {
  const m = mutationSpec(ctx)
  return m && timeOfDay === 'day' ? addThirst(ctx, m.thirst.day_sortie) : { value: 0, journal: [] }
}

// 전투 승리: 밤 출정이면 night_win, 정예·보스는 시간대와 무관하게 elite_boss(09 §7.5)
export function thirstOnWin(
  ctx: RuleContext,
  p: { timeOfDay: 'day' | 'night'; rank: 'normal' | 'elite' | 'boss' },
): { value: number; journal: JournalDraft[] } {
  const m = mutationSpec(ctx)
  if (!m) return { value: 0, journal: [] }
  if (p.rank !== 'normal') return addThirst(ctx, m.thirst.elite_boss)
  return p.timeOfDay === 'night' ? addThirst(ctx, m.thirst.night_win) : { value: 0, journal: [] }
}

// 밤 출정 비율(09 §7.3). 변이가 없으면 balance.time.day_night_ratio의 밤 쪽, 굶주림 이상이면 단계 값
export function nightRatio(ctx: RuleContext): number {
  const m = mutationSpec(ctx)
  if (!m) return ctx.content.balance.time.day_night_ratio[1]
  const stage = thirstStage(ctx)
  return stage?.night_ratio ?? m.time_ratio.night
}

// ── 마을 이용 제약(09 §7.4) ──

// 여관 대신 지하 저장고 휴식: 비용은 같고 시간만 다르다. 변이가 없으면 null
export function cellarRestSec(ctx: RuleContext): number | null {
  return mutationSpec(ctx)?.cellar_rest_sec ?? null
}

// 치료소 대신 피의 휴식(중상 치유, 무료, 갈증 +20). 중상이 없으면 null
export function bloodRestPlan(ctx: RuleContext): { min: number; thirstAdd: number } | null {
  const m = mutationSpec(ctx)
  if (!m) return null
  return { min: m.blood_rest.min, thirstAdd: m.blood_rest.thirst_add }
}

export function applyBloodRest(ctx: RuleContext): { cured: number; journal: JournalDraft[] } {
  const m = mutationSpec(ctx)
  const ch = characterOf(ctx)
  if (!m) return { cured: 0, journal: [] }
  const before = ch.injuries.length
  ch.injuries = ch.injuries.filter((i) => i.grade !== m.blood_rest.cures)
  return { cured: before - ch.injuries.length, journal: addThirst(ctx, m.blood_rest.thirst_add).journal }
}

// ── CP08(갈증을 내리는 소모품) ──

// 갈증을 내리는 소모품 정의(08 소유). 코어는 id가 아니라 effect를 본다
export function thirstConsumable(ctx: RuleContext): ContentDef<'consumable'> | null {
  return ctx.content.list('consumable').find((c) => c.effect === 'thirst_down') ?? null
}

// 자동 사용 기준(09 §7.5, mutation.thirst.auto_drink). where = 출정 중 / 마을
export function autoDrinkDue(ctx: RuleContext, where: 'sortie' | 'town'): boolean {
  const m = mutationSpec(ctx)
  if (!m) return false
  const gate = where === 'sortie' ? m.thirst.auto_drink.sortie_gte : m.thirst.auto_drink.town_gte
  return thirst(ctx) >= gate
}

// 한 병 마신다. 소지분이 없으면 false
export function drinkThirstConsumable(ctx: RuleContext): { drank: boolean; journal: JournalDraft[] } {
  const def = thirstConsumable(ctx)
  const inv = ctx.state.inventory.consumables
  if (!def || (inv[def.id] ?? 0) <= 0) return { drank: false, journal: [] }
  inv[def.id] = (inv[def.id] ?? 0) - 1
  return { drank: true, journal: addThirst(ctx, -(def.amount ?? 0)).journal }
}

// ── 긴 잠 ──

export type LongSleepCause = 'age' | 'thirst' | 'voluntary'

// 정해진 시점 또는 갈증 한계. 자발적 은둔은 사용자가 고르므로 여기서 보지 않는다
export function longSleepDue(ctx: RuleContext): LongSleepCause | null {
  const ch = characterOf(ctx)
  if (!ch.mutation) return null
  if (atThirstLimit(ctx)) return 'thirst'
  return ageAt(ch.eff_min, ctx.content.balance.time) >= ch.mutation.long_sleep_age ? 'age' : null
}
