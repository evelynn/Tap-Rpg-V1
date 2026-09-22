// 사건 정의(16 §4, CONTENT_SCHEMA §5.10): 선택지·판정·결과, 사건 단위 검사(V7·V8·V10·V13·V14), effect_path(§4.7).
import { z } from 'zod'
import {
  EVENT_CATEGORIES, EVENT_TRIGGERS, HOLD_KINDS, OUTCOME_KEYS, animationAction, choiceRisk, choiceTag, condition, def,
  effMin, effectList, int, journalTag, lifeStage, line, modifier, nonNegInt, obj, posInt, ratio, ref, regionFilter,
  season, skill, template, timeOfDay, type Effect,
} from '../common'
import { contextVarSchema } from './context'
import { COST_REQUIRED_EFFECTS, combatSchema } from './effects'

const snake = z.string().regex(/^[a-z][a-z0-9_]*$/, 'snake_case 이름이어야 한다')

function issue(ctx: z.RefinementCtx, message: string, path: PropertyKey[], rule?: string): void {
  ctx.addIssue({ code: 'custom', message, path, ...(rule ? { params: { rule } } : {}) })
}

// ─────────────────────────────────────────────
// 판정
// ─────────────────────────────────────────────

export const checkSchema = obj({
  kind: ref('check_kind').optional(),
  any_of: z.tuple([ref('check_kind'), ref('check_kind')]).optional(), // 보정 합이 높은 쪽으로 한 번 굴림
  dc: int.optional(),
  dc_offset: int.optional(),
  partial_allowed: z.boolean().optional(),
  situational: z.array(modifier).optional(),
}).superRefine((c, ctx) => {
  if ((c.kind === undefined) === (c.any_of === undefined)) issue(ctx, 'kind와 any_of 중 정확히 하나가 필요하다', [], 'V20')
  if (c.dc !== undefined && c.dc_offset !== undefined) issue(ctx, 'dc와 dc_offset은 함께 쓰지 않는다', ['dc_offset'], 'V20')
})

export type Check = z.infer<typeof checkSchema>

// V20: 판정 종류의 dc.kind(balance.check_kinds)별로 사건이 쓸 수 있는 dc·dc_offset(§5.10 표).
// 종류 표는 balance에 있으므로 W1이 dcKindOf를 넘겨 부른다. 문제가 없으면 undefined.
export function checkDcRule(
  check: { kind?: string | undefined; any_of?: readonly string[] | undefined; dc?: number | undefined; dc_offset?: number | undefined },
  dcKindOf: (kind: string) => string | undefined,
): string | undefined {
  for (const k of check.kind !== undefined ? [check.kind] : (check.any_of ?? [])) {
    const dk = dcKindOf(k)
    if (dk === 'fixed' && check.dc_offset !== undefined) return `${k}(dc fixed)에는 dc_offset을 쓸 수 없다(dc로 덮어쓴다)`
    if (dk === 'event' && check.dc === undefined && check.dc_offset === undefined) return `${k}(dc event)는 dc 또는 dc_offset이 필요하다`
    if (dk === 'level_formula' || dk === 'enemy_ac') return `${k}(dc ${dk})는 사건에서 쓸 수 없다`
  }
  return undefined
}

// ─────────────────────────────────────────────
// 결과와 선택지
// ─────────────────────────────────────────────

export const outcomeSchema = obj({
  effects: effectList,
  line: line.optional(),
  detail: template.optional(),
  tag: journalTag.optional(), // 없으면 intro.tag
  line_variants: z.array(line).optional(),
})

export type Outcome = z.infer<typeof outcomeSchema>

const CHECK_OUTCOMES: readonly string[] = ['crit_success', 'success', 'partial', 'failure', 'crit_failure']
const COMBAT_OUTCOMES: readonly string[] = ['win', 'defeat', 'stalemate']

export const choiceSchema = obj({
  id: snake,
  label: z.string(),
  short: z.string().optional(), // hold none이면 필수(V7)
  tags: z.array(choiceTag).min(1).max(2).optional(), // hold none이면 필수(V7)
  risk: choiceRisk,
  requires: condition.optional(),
  check: checkSchema.optional(),
  combat: combatSchema.optional(),
  decline: z.boolean().optional(),
  preview: obj({ benefit: z.string(), cost: z.string(), reversible: z.boolean() }).optional(), // hold≠none이면 필수(V8)
  outcomes: z.partialRecord(z.enum(OUTCOME_KEYS), outcomeSchema),
}).superRefine((c, ctx) => {
  if (c.risk === 'lethal') issue(ctx, 'risk lethal 선택지는 쓸 수 없다', ['risk'], 'V10')
  if (c.check && c.combat) issue(ctx, 'check와 combat은 함께 쓰지 않는다', ['combat'])
  const [allowed, required] =
    c.check ? [CHECK_OUTCOMES, ['success', 'failure']]
    : c.combat ? [COMBAT_OUTCOMES, ['win', 'defeat']]
    : [['always'], ['always']]
  const keys = Object.keys(c.outcomes)
  for (const k of required) if (!keys.includes(k)) issue(ctx, `outcomes.${k}가 필요하다`, ['outcomes'])
  for (const k of keys) if (!allowed.includes(k)) issue(ctx, `이 선택지에 쓸 수 없는 결과 키: ${k}`, ['outcomes', k])
})

export type Choice = z.infer<typeof choiceSchema>

// ─────────────────────────────────────────────
// 효과 트리 걷기와 effect_path(§4.7)
// ─────────────────────────────────────────────

type Step = number | string

// 파라미터 값이 {type} 객체 배열이면 효과 배열(branch)로 보고 들어간다. 효과 이름 목록을 코드가 갖지 않는다.
function isEffectArray(v: unknown): v is Effect[] {
  return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'object' && x !== null && typeof (x as { type?: unknown }).type === 'string')
}

function walkEffects(list: readonly Effect[], steps: Step[], visit: (e: Effect, steps: Step[]) => void): void {
  list.forEach((e, i) => {
    visit(e, [...steps, i])
    for (const [key, v] of Object.entries(e)) if (isEffectArray(v)) walkEffects(v, [...steps, i, key], visit)
  })
}

function choiceHasEffect(c: Choice, pred: (type: string) => boolean): boolean {
  let hit = false
  for (const o of Object.values(c.outcomes)) if (o) walkEffects(o.effects, [], (e) => { hit ||= pred(e.type) })
  return hit
}

// steps: 숫자 = 효과 인덱스, 문자열 = 앞 효과의 branch 키. [2, 'then', 0] → "2.then/0"
export function effectPath(choiceId: string, outcomeKey: string, steps: readonly Step[]): string {
  let path = `${choiceId}/${outcomeKey}`
  for (const s of steps) path += typeof s === 'number' ? `/${s}` : `.${s}`
  return path
}

// 사건 안 모든 chance 효과의 경로(선택 창 pre_chance 키)
export function listChancePaths(event: Pick<Event, 'choices'>): string[] {
  const paths: string[] = []
  for (const c of event.choices) {
    for (const [key, o] of Object.entries(c.outcomes)) {
      if (o) walkEffects(o.effects, [], (e, steps) => { if (e.type === 'chance') paths.push(effectPath(c.id, key, steps)) })
    }
  }
  return paths
}

// ─────────────────────────────────────────────
// 사건
// ─────────────────────────────────────────────

const animationStep = obj({ action: animationAction, props: z.array(ref('prop')).optional() })

export const eventSchema = def({
  name: z.string(),
  category: z.enum(EVENT_CATEGORIES),
  chain: obj({ id: ref('chain'), stage: posInt }).optional(),
  locations: z.array(ref('region')).min(1).optional(), // 없으면 location_match, 둘 다 없으면 모든 장소
  location_match: regionFilter.optional(),
  tags: z.array(snake).optional(), // 엔진이 읽는 값은 raid(camp_raid_immunity가 거름)
  triggers: z.array(z.enum(EVENT_TRIGGERS)).min(1),
  life_stages: z.array(lifeStage).min(1).optional(),
  seasons: z.array(season).min(1).optional(),
  time_of_day: timeOfDay.optional(),
  condition,
  weight: int.optional(), // system 외 필수 1~10(V13)
  weight_mods: z.array(obj({ when: condition, mult: z.number().min(0) })).optional(),
  luck_scaled: z.boolean().optional(),
  appear_chance: ratio.optional(),
  pity_after: posInt.optional(),
  check_override: ratio.optional(),
  exclusive_group: snake.optional(),
  cooldown_min: effMin.optional(),
  cooldown_per_season: z.boolean().optional(),
  max_per_life: posInt.optional(),
  max_per_family: posInt.optional(),
  allow_serious_injury: z.boolean(),
  blocked_during_aid: z.boolean().optional(),
  hold: z.enum(HOLD_KINDS),
  policy_hooks: obj({
    decline_choice: z.string().optional(),
    auto_specialization_map: z.record(z.string(), z.string()).optional(), // 방침 값 → 선택지 id
    max_presentations: posInt.optional(),
    represent_after: obj({ level_gain: posInt, skill_rank_up: z.array(skill) }).optional(),
  }).optional(),
  context_vars: z.array(contextVarSchema).optional(), // 선언 순서대로 평가
  system: obj({ order: int, phase: z.enum(['judgment', 'town_routine_family', 'life_end', 'succession']) }).optional(),
  preview: obj({
    body: template,
    note: template.optional(),
    // 조건이 참이면 본문 after_paragraph번째 문단 뒤(없으면 끝)에 넣는다
    variants: z.array(obj({ when: condition, text: template, after_paragraph: nonNegInt.optional() })).optional(),
  }).optional(),
  hold_line: line.optional(),
  hold_animation: animationStep.optional(), // 없으면 balance.events.default_hold_animation
  intro: obj({
    lines: z.array(line).min(2),
    detail: template.optional(),
    tag: journalTag,
    // 순서대로 재생. sec = 시스템 사건 연출 시간
    animation: z.array(obj({ action: animationAction, props: z.array(ref('prop')).optional(), sec: z.number().positive().optional() })).optional(),
    family_variants: z.array(obj({ when: condition, detail_append: template })).optional(),
  }),
  choices: z.array(choiceSchema).min(1),
}).superRefine((e, ctx) => {
  if (e.category === 'chain' && !e.chain) issue(ctx, 'category chain은 chain이 필요하다', ['chain'])
  if (e.category === 'system' && !e.system) issue(ctx, 'category system은 system이 필요하다', ['system'])
  if (e.category !== 'system' && (e.weight === undefined || e.weight < 1 || e.weight > 10)) {
    issue(ctx, 'weight는 1~10 정수다', ['weight'], 'V13')
  }
  const ids = e.choices.map((c) => c.id)
  ids.forEach((cid, i) => { if (ids.indexOf(cid) !== i) issue(ctx, `선택지 id 중복: ${cid}`, ['choices', i, 'id']) })

  // V7 자동 선택 정보. tags·short는 선택지 1개뿐인 system 사건이 면제
  if (e.hold === 'none' && !(e.category === 'system' && e.choices.length === 1)) {
    e.choices.forEach((c, i) => {
      if (!c.tags) issue(ctx, 'hold none 사건의 선택지는 tags(1~2개)가 필요하다', ['choices', i, 'tags'], 'V7')
      if (c.short === undefined) issue(ctx, 'hold none 사건의 선택지는 short가 필요하다', ['choices', i, 'short'], 'V7')
    })
  }
  // V7 위험 없음·낮음 선택지는 모든 사건에 하나 이상(10 §5.4, 16 §4.2)
  if (!e.choices.some((c) => c.risk === 'none' || c.risk === 'low')) issue(ctx, 'risk none 또는 low 선택지가 하나 이상 필요하다', ['choices'], 'V7')

  // V8 선택 창 정보
  if (e.hold !== 'none') {
    if (!e.preview) issue(ctx, '선택 대기 사건은 preview.body가 필요하다', ['preview'], 'V8')
    if (e.hold_line === undefined) issue(ctx, '선택 대기 사건은 hold_line이 필요하다', ['hold_line'], 'V8')
    e.choices.forEach((c, i) => {
      if (!c.preview) return issue(ctx, '선택 대기 사건의 선택지는 preview{benefit, cost, reversible}가 필요하다', ['choices', i, 'preview'], 'V8')
      if (!c.preview.cost.trim() && choiceHasEffect(c, (t) => COST_REQUIRED_EFFECTS.has(t))) {
        issue(ctx, '변이·수명·유물·생애 능력치 변화가 있는 선택지는 cost를 적는다', ['choices', i, 'preview', 'cost'], 'V8')
      }
    })
  }

  // V14 거절 경로
  if (e.hold === 'fate') {
    const declines = e.choices.filter((c) => c.decline === true)
    if (declines.length !== 1) issue(ctx, '운명 사건은 decline: true 선택지가 정확히 1개다', ['choices'], 'V14')
    else if (e.policy_hooks?.decline_choice !== declines[0]!.id) {
      issue(ctx, 'policy_hooks.decline_choice가 decline 선택지 id와 같아야 한다', ['policy_hooks', 'decline_choice'], 'V14')
    }
    const specializes = e.choices.some((c) => choiceHasEffect(c, (t) => t === 'specialize'))
    if (specializes && (!e.policy_hooks?.auto_specialization_map || e.policy_hooks.max_presentations === undefined)) {
      issue(ctx, 'specialize 선택지가 있으면 auto_specialization_map과 max_presentations가 필요하다', ['policy_hooks'], 'V14')
    }
  }
})

export type Event = z.infer<typeof eventSchema>
