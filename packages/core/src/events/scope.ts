// 사건 문맥: 장소·사건 변수, 자리 바인딩 치환(CONTENT_SCHEMA §3.1), 보상 단위(10 §6), 문장 값.
import { regionMatches, type Content, type RegionFilter } from '../content/index'
import type { RngStream } from '../rng/index'
import type { END_KINDS } from '../schema/index'
import type { SaveBody } from '../state/save'
import { characterOf, type ConditionTest, type RuleContext } from '../rules/context'
import { enemyStats } from '../rules/enemy'
import type { Rng } from '../rules/random'
import { renderTemplate, templateVars } from '../text/index'
import { ageAt } from '../time/index'

// World가 그대로 맞는다. 테스트는 난수를 바꿔 끼울 수 있다
export interface EventWorld {
  readonly content: Content
  state: SaveBody
  readonly rng: Readonly<Record<RngStream, Rng>>
}

// 조건·효과 평가 문맥. place = {place} 바인딩 값, vars = 사건 context_vars가 채운 값(장소·적 ID, 이름 등)
export interface EventScope {
  place: string | null
  vars: Readonly<Record<string, string>>
  eventId?: string
  combatKind?: 'normal' | 'elite_gate' | 'boss_gate' // combat_kind 조건(전투 규칙이 넣음)
  mainPlace?: string // main_place 조건(08 §7.1, 장비 평가가 넣음)
  lifeEnd?: { kind: (typeof END_KINDS)[number]; place: string | null } // life_end_kind·died_at(생애 종료가 넣음)
  activityWeight?: (activity: string) => number // num activity_weight.{활동}(04 §5.2, 활동 결정이 넣음)
}

export const emptyScope = (place: string | null = null): EventScope => ({ place, vars: {} })

// {place}·{사건 변수}를 값으로 바꾼다. 값이 없으면 콘텐츠·엔진 오류다
export function bind(text: string, scope: EventScope): string {
  return text.replace(/\{([a-z][a-z0-9_]*)\}/g, (_, name: string) => {
    const v = name === 'place' ? scope.place : scope.vars[name]
    if (v === null || v === undefined) throw new Error(`바인딩 {${name}} 값이 없다: ${text}`)
    return v
  })
}

export function ruleContext(w: EventWorld, test: ConditionTest): RuleContext {
  return { content: w.content, state: w.state, test }
}

// 보상·판정 기준 레벨(10 §6): 마을은 인물 레벨, 그 밖은 장소 권장 레벨 중앙값
export function placeLevel(w: EventWorld, place: string | null): number {
  const r = place ? w.content.get('region', place) : null
  return !r || r.kind === 'town' ? characterOf(ruleContext(w, () => false)).level : r.level_mid
}

// 동전 단위 = (3 + 1.5L) × 1.08^L, 경험치 단위 = 6 + 3L. 둘 다 적 기준식의 일반 적 값과 같다(01 §5.1)
export function rewardUnits(w: EventWorld, place: string | null): { coins: number; xp: number } {
  const s = enemyStats(w.content.balance.enemy_formula, placeLevel(w, place), 'normal')
  return { coins: s.coins, xp: s.xp }
}

// 사건이 이 장소에 명시적으로 묶였는지(locations·location_match). 둘 다 없으면 모든 장소(null)
export function eventPlaceMatch(content: Content, ev: { locations?: string[]; location_match?: RegionFilter }, place: string): boolean | null {
  if (ev.locations) return ev.locations.includes(place)
  if (ev.location_match) return regionMatches(content, place, ev.location_match)
  return null
}

// 문장 값: 인물·가문·장소 + 사건 변수(ID면 이름으로). 템플릿이 모르는 변수는 빈 문자열로 채운다
export function textValues(w: EventWorld, scope: EventScope, extra: Record<string, string | number> = {}): Record<string, string | number> {
  const { content, state } = w
  const ch = state.character
  const nameOf = (v: string): string => {
    for (const kind of ['region', 'enemy', 'npc', 'item', 'trait'] as const) if (content.has(kind, v)) return content.get(kind, v).name
    return v
  }
  const vals: Record<string, string | number> = { family: state.family.name, generation: state.family.generation }
  if (ch) {
    Object.assign(vals, {
      name: ch.name,
      age: ageAt(ch.eff_min, content.balance.time),
      level: ch.level,
      parent_call: ch.parent_call ?? '',
      retire_age: ch.retire_age,
      retire_age_plus10: ch.retire_age + 10,
      luck: ch.stats.luk,
      sleep_age: ch.mutation?.long_sleep_age ?? '',
      attitude: content.has('attitude', state.policies.attitude) ? content.get('attitude', state.policies.attitude).name : '',
    })
  }
  if (scope.place) vals.place = nameOf(scope.place)
  for (const [k, v] of Object.entries(scope.vars)) vals[k] = nameOf(v)
  return { ...vals, ...extra }
}

export function render(template: string, values: Record<string, string | number>): string {
  const vals = { ...values }
  for (const v of templateVars(template)) if (!Object.hasOwn(vals, v)) vals[v] = ''
  return renderTemplate(template, vals)
}
