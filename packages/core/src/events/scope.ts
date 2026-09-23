// 사건 문맥: 장소·사건 변수, 자리 바인딩 치환(CONTENT_SCHEMA §3.1), 보상 단위(10 §6), 문장 값.
import { regionMatches, type Content, type RegionFilter } from '../content/index'
import type { RngStream } from '../rng/index'
import { registerTextSlot, type END_KINDS } from '../schema/index'
import type { SaveBody } from '../state/save'
import { characterOf, type ConditionTest, type RuleContext } from '../rules/context'
import { enemyStats } from '../rules/enemy'
import type { Rng } from '../rules/random'
import { itemName } from '../items/bag'
import { readPartner } from '../succession/partner'
import { ownedItems, relicsToPass } from '../succession/relics'
import { renderTemplate } from '../text/index'
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

// 문장 값: 인물·가문·장소·가족 + 사건 변수(ID면 이름으로). 값이 없는 변수는 채우지 않는다(쓰면 render가 예외).
// 어떤 문맥이 어떤 변수를 채우는지는 EVENT_TEXT_VARS가 단일 출처다(V5가 읽는다)
export function textValues(w: EventWorld, scope: EventScope, extra: Record<string, string | number> = {}): Record<string, string | number> {
  const { content, state } = w
  const ch = state.character
  const nameOf = (v: string): string => {
    for (const kind of ['region', 'enemy', 'npc', 'item', 'trait'] as const) if (content.has(kind, v)) return content.get(kind, v).name
    return v
  }
  const vals: Record<string, string | number> = { family: state.family.name, generation: state.family.generation }
  const put = (k: string, v: string | number | null | undefined) => { if (v !== null && v !== undefined && v !== '') vals[k] = v }
  if (ch) {
    Object.assign(vals, {
      name: ch.name,
      age: ageAt(ch.eff_min, content.balance.time),
      level: ch.level,
      retire_age: ch.retire_age,
      retire_age_plus10: ch.retire_age + 10,
      luck: ch.stats.luk,
    })
    put('parent_call', ch.parent_call)
    put('sleep_age', ch.mutation?.long_sleep_age)
    put('attitude', content.has('attitude', state.policies.attitude) ? content.get('attitude', state.policies.attitude).name : null)
    Object.assign(vals, familyValues(w, scope))
  }
  if (scope.place) vals.place = nameOf(scope.place)
  for (const [k, v] of Object.entries(scope.vars)) vals[k] = nameOf(v)
  return { ...vals, ...extra }
}

// 가족·장비 문맥(16 §1.4.3): 장착 무기, 동반자·직업(12 §2.1), 막내 자녀, 부모 이름, 이전 유품(12 §5.2).
// 이전 유품은 생애 종료 문맥(생애 종료 단계 사건)이면 넘길 유품 1위(없으면 대체어, 11 S04), 그 밖에는 물려받은 유품
function familyValues(w: EventWorld, scope: EventScope): Record<string, string> {
  const { content, state } = w
  const ch = state.character!
  const rule: RuleContext = { content, state, test: () => false }
  const out: Record<string, string> = {}
  const put = (k: string, v: string | null | undefined) => { if (v) out[k] = v }
  const inst = (uid: string | null | undefined) => (uid ? state.item_instances[uid] : undefined)
  const weapon = inst(state.inventory.equipped.weapon)
  put('weapon', weapon && itemName(rule, weapon))
  const partner = readPartner(state.family, ch.generation)
  put('partner', partner?.name)
  put('job', partner?.job)
  put('child', state.family.candidates[ch.children.at(-1) ?? '']?.name)
  put('parent_name', state.family.chronicle.find((r) => r.char_uid === ch.parent_uid)?.name)
  const ending = scope.lifeEnd !== undefined || (scope.eventId !== undefined && content.get('event', scope.eventId).system?.phase === 'life_end')
  const relic = ending
    ? relicsToPass(rule, scope.lifeEnd?.kind ?? 'died')[0]
    : ownedItems(rule).find((i) => i.inherited_from_gen !== undefined)
  put('relic', relic ? itemName(rule, relic) : ending ? textOf(content, RELIC_FALLBACK) : null)
  return out
}

// 11 S04: 넘길 장비가 없으면 {relic}을 '남은 배낭'으로 바꾼다
export const RELIC_FALLBACK = 'journal.death.relic_fallback'
registerTextSlot(RELIC_FALLBACK, '사건 문맥(events)')

const textOf = (content: Content, id: string): string => content.get('text', id).variants[0]!

// 사건 문장에서 엔진이 채우는 문맥 변수(16 §1.4.3 '문맥' 중 사건 몫). V5가 사건 템플릿의 문맥 변수를 이 표로 본다.
// always = textValues가 늘 채움 / state = 상태에 값이 있을 때만(가족·장비, 없는데 쓰면 render 예외) /
// result = 효과 결과(resultValues: 장비를 주는 효과나 add_coins가 있는 사건만) / hold = 선택 창(holdValues, preview만) /
// phase = 시스템 사건을 부르는 쪽이 vars로 넣음 / quest = 의뢰 정산 문장(accept_quest lines, activity settleQuest)
export const EVENT_TEXT_VARS = {
  always: ['family', 'generation', 'name', 'age', 'level', 'retire_age', 'retire_age_plus10', 'luck', 'attitude', 'place'],
  state: ['parent_call', 'sleep_age', 'weapon', 'partner', 'job', 'child', 'parent_name', 'relic'],
  result: ['item', 'loot'],
  hold: ['n', 'm', 'luck_after', 'sleep_age'],
  phase: { life_end: ['risk_line', 'injury_line', 'final_check_line'], succession: ['heir', 'first_page'] } as Readonly<Record<string, readonly string[]>>,
  quest: ['coins', 'place'],
} as const

const RESULT_EFFECTS = new Set(['add_item', 'add_random_item', 'open_chest', 'offer_purchase', 'add_coins'])

// 사건 템플릿 한 자리(path = 사건 정의 안 경로)에서 엔진이 채울 수 있는 문맥 변수. context_vars 변수는 따로 본다
export function eventTextVarsAt(ev: { system?: { phase: string }; choices: unknown[] }, path: readonly (string | number)[]): Set<string> {
  const v = EVENT_TEXT_VARS
  if (path.includes('lines') && path.includes('effects')) return new Set(v.quest)
  const out = new Set<string>([...v.always, ...v.state, ...(v.phase[ev.system?.phase ?? ''] ?? [])])
  if (path.includes('preview')) for (const n of v.hold) out.add(n)
  const gives = (x: unknown): boolean => Array.isArray(x) ? x.some(gives)
    : typeof x === 'object' && x !== null && (RESULT_EFFECTS.has(String((x as { type?: unknown }).type)) || Object.values(x).some(gives))
  if (gives(ev.choices)) for (const n of v.result) out.add(n)
  return out
}

// 값이 없는 변수는 예외다(renderTemplate). 빈 문자열로 채우면 조사가 "을(를)"로 남아 결함이 조용히 나간다
export function render(template: string, values: Record<string, string | number>): string {
  return renderTemplate(template, values)
}
