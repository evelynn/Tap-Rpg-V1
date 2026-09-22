// 콘텐츠 스키마 공통 골격. 종류별 스키마(W2~W4)와 팩 로더(W1)가 함께 쓴다.
// 설계 근거: docs/dev/CONTENT_SCHEMA.md(§3 공통 타입, §4 등록부). 이름을 바꾸면 그 문서도 고친다.
// 코어 규칙: DOM·Node API 금지, 문자열 리터럴에 콘텐츠 ID 금지(I04).
import { z } from 'zod'
import { templateVars as extractTemplateVars } from '../text/template'

// ─────────────────────────────────────────────
// 1 종류(kind)와 파일 배치
// ─────────────────────────────────────────────

// 종류 → 팩 안 위치. dir = 폴더 아래 *.json(파일 하나 = 정의 1개 객체 또는 배열), file = 팩 루트의 파일 하나.
// singleton(balance)은 기반 팩만 정의하고 다른 팩은 패치로 바꾼다.
export const CONTENT_KINDS = {
  balance: { file: 'balance.json', singleton: true },
  attitude: { dir: 'attitudes' },
  region: { dir: 'regions' },
  enemy_family: { dir: 'enemy_families' },
  enemy: { dir: 'enemies' },
  material: { dir: 'materials' },
  trap: { dir: 'traps' },
  guild_rank: { dir: 'guild_ranks' },
  item: { dir: 'items' },
  item_effect: { dir: 'item_effects' },
  consumable: { dir: 'consumables' },
  trait: { dir: 'traits' },
  npc: { dir: 'npcs' },
  name_pool: { dir: 'names' },
  background: { dir: 'backgrounds' },
  achievement: { dir: 'achievements' },
  epithet: { dir: 'epithets' },
  retire_role: { dir: 'retire_roles' },
  descendant_reaction: { dir: 'descendant_reactions' },
  prop: { dir: 'props' },
  flag: { file: 'flags.json' },
  chain: { dir: 'chains' },
  event: { dir: 'events' },
  text: { dir: 'text' },
} as const

export type ContentKind = keyof typeof CONTENT_KINDS
export const CONTENT_KIND_NAMES = Object.keys(CONTENT_KINDS) as ContentKind[]

// 파일로 정의하지 않지만 참조 대상이 되는 이름공간. W1이 정의 위치에서 색인한다.
// balance 표의 키: check_kind(check_kinds), drop_table(economy.drops), rescuer_table(defeat.rescuers),
//   rescuer(defeat.rescuer_lines), carry_group(economy.carry_limits)
// region 안 정의: discovery, map_fragment, facility(town.facilities[].id), dungeon_group(dungeon.group)
// trait 안 정의: thirst_stage(mutation.thirst.stages[].id)
export const NESTED_REF_KINDS = [
  'check_kind', 'drop_table', 'rescuer_table', 'rescuer', 'carry_group',
  'discovery', 'map_fragment', 'facility', 'dungeon_group', 'thirst_stage',
] as const
export type RefKind = ContentKind | (typeof NESTED_REF_KINDS)[number]

// ─────────────────────────────────────────────
// 2 식별자, 참조, 기본 타입
// ─────────────────────────────────────────────

// 종류별 이름공간 안에서 고유. 예: C01-3, mat_EN04, A1-1 (접두 관례는 검사하지 않는다)
export const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(?:-[A-Za-z0-9_]+)*$/
export const id = z.string().regex(ID_PATTERN, 'ID 형식이 아니다(영문자로 시작, 영숫자·_·- 만)')

// 참조 필드의 기대 종류를 스키마에 붙여 둔다. 로더(W1)는 refKindOf로 읽어 V2 무결성을 검사한다.
export const refRegistry = z.registry<{ kind: RefKind }>()

export function ref(kind: RefKind) {
  return z.string().regex(ID_PATTERN, `${kind} ID 형식이 아니다`).register(refRegistry, { kind })
}

export function refKindOf(schema: z.ZodType): RefKind | undefined {
  return refRegistry.get(schema)?.kind
}

// 자리 바인딩 {변수}: 효과 적용·조건 평가 때 엔진이 장소 ID로 바꾼다.
// place = 평가 문맥의 장소, 그 밖의 이름은 그 사건 context_vars의 장소 변수(CONTENT_SCHEMA §3.1).
export const BINDING_PATTERN = /^\{[a-z][a-z0-9_]*\}$/

// 플래그 키: 범위.snake_case. 키 묶음은 뒤에 _ID(밑줄·하이픈 허용) 또는 _{변수}(바인딩·등록표 자리)가 붙는다.
export const FLAG_SCOPES = ['life', 'fam', 'trip'] as const
export type FlagScope = (typeof FLAG_SCOPES)[number]
const FLAG_BODY = '[a-z][a-z0-9_]*(?:_(?:\\{[a-z][a-z0-9_]*\\}|[A-Za-z][A-Za-z0-9_-]*))?'
export const FLAG_KEY_PATTERN = new RegExp(`^(life|fam|trip)\\.${FLAG_BODY}$`)

// 범위를 주면 그 접두만 허용한다(V19: set_flag ↔ life. 등).
export function flagKey(scope?: FlagScope) {
  const re = scope ? new RegExp(`^${scope}\\.${FLAG_BODY}$`) : FLAG_KEY_PATTERN
  return z.string().regex(re, scope ? `${scope}. 플래그 키여야 한다` : '플래그 키 형식이 아니다').register(refRegistry, { kind: 'flag' })
}

export const int = z.number().int()
export const nonNegInt = int.min(0)
export const posInt = int.min(1)
export const ratio = z.number().min(0).max(1)
export const effMin = z.number().min(0)
export const units = z.number().min(0)
export const weight = z.number().min(0)

export const range = z
  .tuple([int, int])
  .refine(([lo, hi]) => lo <= hi, '범위 [최소, 최대]는 최소 ≤ 최대여야 한다')
export const numRange = z
  .tuple([z.number(), z.number()])
  .refine(([lo, hi]) => lo <= hi, '범위 [최소, 최대]는 최소 ≤ 최대여야 한다')

// 키가 일부만 있어도 되는 가중치 표
export function weightTable<K extends string>(keys: readonly [K, ...K[]]) {
  return z.partialRecord(z.enum(keys), weight)
}

// 주사위 표기 NdM+K (예: 2d6+1, 1d4, 3d8-2)
export const DICE_PATTERN = /^([1-9]\d*)d([1-9]\d*)([+-]\d+)?$/
export const dice = z.string().regex(DICE_PATTERN, '주사위 표기는 NdM+K 형식이다')

// ─────────────────────────────────────────────
// 3 문장 템플릿 (16 §1.4). 문법·조사 쌍은 렌더러 파서(text/template.ts)가 단일 출처다. 여기서는 그 파서에
//   변수 이름 형식(snake_case)만 더한다. 변수 등록표 검사(V5)는 W1이 한다.
// ─────────────────────────────────────────────

const TEMPLATE_VAR_NAME = /^[a-z][a-z0-9_]*$/

// 템플릿 필드 표시. 로더(W1)가 V5(변수 등록표)·V6(한 줄 길이) 검사 대상을 찾는 데 쓴다.
export const templateRegistry = z.registry<{ line?: true }>()

function makeTemplate(isLine: boolean) {
  return z
    .string()
    .superRefine((text, ctx) => {
      let names: string[]
      try {
        names = extractTemplateVars(text)
      } catch (e) {
        return void ctx.addIssue({ code: 'custom', message: `템플릿 문법: ${(e as Error).message}`, params: { rule: 'V5' } })
      }
      for (const n of names) {
        if (!TEMPLATE_VAR_NAME.test(n)) ctx.addIssue({ code: 'custom', message: `템플릿 변수 이름은 snake_case다: {${n}}`, params: { rule: 'V5' } })
      }
    })
    .register(templateRegistry, isLine ? { line: true } : {})
}

// 일반 문장 템플릿(상세 기록, 사연 등)
export const template = makeTemplate(false)
// 한 줄 기록. 최대 길이는 balance.ui.line_max(01 §16)를 W1이 읽어 V6으로 검사한다.
export const line = makeTemplate(true)

// ─────────────────────────────────────────────
// 4 열거형 (16 §6). 데이터로 옮긴 것(길드 등급·출신 배경·은퇴 역할·적 계열·판정 종류·태도)은 ref로 쓴다.
// ─────────────────────────────────────────────

export const STATS = ['str', 'dex', 'kno', 'wil', 'soc', 'luk'] as const
export const SKILLS = ['melee', 'mobility', 'search', 'survival', 'negotiation'] as const
export const ACTIVITIES = ['hunt', 'adventure', 'dungeon'] as const
export const ACTIVITY_RISKS = ['very_low', 'low', 'normal', 'high', 'reckless'] as const
export const SLOTS = ['weapon', 'armor', 'accessory', 'relic'] as const
export const GRADES = ['common', 'good', 'rare', 'legendary'] as const
export const LIFE_STAGES = ['novice', 'prime', 'veteran', 'elder'] as const
export const ACTIVITY_STATES = [
  'town_idle', 'town_prep', 'travel', 'hunt', 'adventure', 'dungeon',
  'camp', 'return', 'treatment', 'awaiting_choice', 'awaiting_succession', 'paused',
] as const
export const SPECIALIZATIONS = ['none', 'guardian', 'pathfinder'] as const
export const MUTATIONS = ['none', 'vampire'] as const
export const INJURY_GRADES = ['light', 'serious'] as const
export const END_KINDS = ['retired', 'died', 'long_sleep'] as const
export const FAMILY_ROLES = ['founder', 'direct', 'collateral', 'adopted'] as const
export const JOURNAL_TAGS = [
  'hunt', 'adventure', 'dungeon', 'travel', 'rest', 'town', 'gear', 'check', 'trait', 'growth',
  'discovery', 'bond', 'injury', 'important', 'family', 'retire', 'death', 'succession', 'house',
] as const
export const JOURNAL_IMPORTANCE = ['daily', 'major', 'family', 'last_chapter'] as const
export const EVENT_TRIGGERS = [
  'after_encounter', 'adventure_event_scene', 'dungeon_event_room', 'dungeon_after_room',
  'town_return', 'camp', 'system',
] as const
export const EVENT_CATEGORIES = ['life', 'chain', 'fate', 'system'] as const
export const HOLD_KINDS = ['none', 'branch', 'fate'] as const
export const TIME_OF_DAY = ['day', 'night'] as const
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const
export const WEATHERS = ['clear', 'rain', 'fog', 'snow'] as const
export const REGION_KINDS = ['town', 'hunting_ground', 'dungeon_floor', 'adventure_route'] as const
export const ROOM_KINDS = ['combat', 'trap', 'rest', 'treasure', 'event'] as const
export const SCENE_KINDS = ['discovery', 'path', 'forage', 'encounter', 'event'] as const
export const ENEMY_RANKS = ['normal', 'elite', 'boss'] as const
export const CHOICE_TAGS = ['safe', 'thrift', 'rest', 'kindness', 'info', 'new_path', 'reward', 'bold'] as const
export const CHOICE_RISKS = ['none', 'low', 'medium', 'high', 'lethal'] as const
export const OUTCOME_KEYS = [
  'crit_success', 'success', 'partial', 'failure', 'crit_failure', 'always', 'win', 'defeat', 'stalemate',
] as const
// 01 §18.4 캐릭터 동작 10종: 대기·걷기·공격·피격·발견·앉기와 식사·잠·상호작용·환호·쓰러짐
export const ANIMATION_ACTIONS = [
  'idle', 'walk', 'attack', 'hit', 'discover', 'sit_eat', 'sleep', 'interact', 'cheer', 'collapse',
] as const

export const stat = z.enum(STATS)
export const skill = z.enum(SKILLS)
export const activity = z.enum(ACTIVITIES)
export const activityRisk = z.enum(ACTIVITY_RISKS)
export const slot = z.enum(SLOTS)
export const grade = z.enum(GRADES)
// 단계 상한은 balance.economy.tier_levels 길이(W1 교차 검사)
export const tier = posInt
export const lifeStage = z.enum(LIFE_STAGES)
export const season = z.enum(SEASONS)
export const timeOfDay = z.enum(TIME_OF_DAY)
export const weather = z.enum(WEATHERS)
export const regionKind = z.enum(REGION_KINDS)
export const journalTag = z.enum(JOURNAL_TAGS)
export const choiceTag = z.enum(CHOICE_TAGS)
export const choiceRisk = z.enum(CHOICE_RISKS)
export const animationAction = z.enum(ANIMATION_ACTIONS)

// ─────────────────────────────────────────────
// 5 엄격 객체. 모르는 필드는 오류, 단 _note·_comment는 설명용으로 허용한다.
// ─────────────────────────────────────────────

const NOTE_SHAPE = { _note: z.string().optional(), _comment: z.string().optional() }

export function obj<S extends z.ZodRawShape>(shape: S) {
  return z.strictObject({ ...shape, ...NOTE_SHAPE })
}

// 정의 최상위 객체(id 필수)
export function def<S extends z.ZodRawShape>(shape: S) {
  return obj({ id, ...shape })
}

// ─────────────────────────────────────────────
// 6 이름 등록부 — 조건·효과·적 특수능력·사건 변수 선택자처럼 "코드가 뜻을 아는 이름"을 모은다.
// 확장 코드는 첫 검증 전에 register 한다. 첫 검증 때 lock되고 이후 등록은 오류다.
// ─────────────────────────────────────────────

export interface ParamEntry {
  name: string
  params: z.ZodType
  doc: string
}

const NAME_PATTERN = /^[a-z][a-z0-9_]*$/

export class ParamRegistry {
  private readonly entries = new Map<string, ParamEntry>()
  private locked = false

  constructor(
    readonly label: string,
    private readonly reserved: readonly string[] = [],
  ) {}

  register(name: string, params: z.ZodType, doc = ''): void {
    if (this.locked) throw new Error(`${this.label} 등록부가 이미 잠겼다(첫 검증 전에 등록한다): ${name}`)
    if (!NAME_PATTERN.test(name)) throw new Error(`${this.label} 이름은 snake_case: ${name}`)
    if (this.reserved.includes(name) || this.entries.has(name)) throw new Error(`${this.label} 이름 중복: ${name}`)
    this.entries.set(name, { name, params, doc })
  }

  get(name: string): ParamEntry | undefined {
    return this.entries.get(name)
  }

  names(): string[] {
    return [...this.entries.keys()]
  }

  list(): ParamEntry[] {
    return [...this.entries.values()]
  }

  lock(): void {
    this.locked = true
  }

  get isLocked(): boolean {
    return this.locked
  }
}

// 이름만 모으는 등록부(카운터 이름). 중복과 잠긴 뒤 등록은 예외다.
export class NameRegistry {
  private readonly items = new Set<string>()
  private locked = false

  constructor(
    readonly label: string,
    initial: readonly string[] = [],
  ) {
    for (const name of initial) this.register(name)
  }

  register(name: string): void {
    if (this.locked) throw new Error(`${this.label} 등록부가 이미 잠겼다(첫 검증 전에 등록한다): ${name}`)
    if (!NAME_PATTERN.test(name)) throw new Error(`${this.label} 이름은 snake_case: ${name}`)
    if (this.items.has(name)) throw new Error(`${this.label} 이름 중복: ${name}`)
    this.items.add(name)
  }

  has(name: string): boolean {
    return this.items.has(name)
  }

  names(): string[] {
    return [...this.items]
  }

  lock(): void {
    this.locked = true
  }
}

// ─────────────────────────────────────────────
// 7 패턴 등록부 — 수정자 target, num 키처럼 "점으로 이은 이름 + 자리(slot)" 형식을 모은다.
// ─────────────────────────────────────────────

export type SlotSpec = { enum: readonly string[] } | { ref: RefKind } | { name: true }

export const PATTERN_SLOTS: Record<string, SlotSpec> = {
  stat: { enum: STATS },
  skill: { enum: SKILLS },
  activity: { enum: ACTIVITIES },
  check_kind: { ref: 'check_kind' },
  enemy_family: { ref: 'enemy_family' },
  region: { ref: 'region' },
  npc: { ref: 'npc' },
  counter: { name: true },
  special: { name: true },
  param: { name: true },
}

export interface PatternMatch<M> {
  pattern: string
  meta: M
  slots: { slot: string; value: string; spec: SlotSpec }[]
}

export class PatternRegistry<M> {
  private readonly patterns: { pattern: string; segs: string[]; meta: M }[] = []
  private locked = false

  constructor(readonly label: string) {}

  register(pattern: string, meta: M): void {
    if (this.locked) throw new Error(`${this.label} 등록부가 이미 잠겼다: ${pattern}`)
    const segs = pattern.split('.')
    for (const s of segs) {
      const slotName = /^\{([a-z_]+)\}$/.exec(s)?.[1]
      if (slotName ? !PATTERN_SLOTS[slotName] : !NAME_PATTERN.test(s)) {
        throw new Error(`${this.label} 패턴 오류: ${pattern}`)
      }
    }
    if (this.patterns.some((p) => p.pattern === pattern)) throw new Error(`${this.label} 패턴 중복: ${pattern}`)
    this.patterns.push({ pattern, segs, meta })
  }

  // 여러 패턴이 맞으면 글자 그대로인 조각이 많은 쪽(예: check.all > check.{check_kind})
  match(text: string): PatternMatch<M> | undefined {
    const parts = text.split('.')
    let best: PatternMatch<M> | undefined
    let bestLiterals = -1
    for (const p of this.patterns) {
      if (p.segs.length !== parts.length) continue
      const slots: PatternMatch<M>['slots'] = []
      let literals = 0
      const ok = p.segs.every((seg, i) => {
        const value = parts[i]!
        const slotName = /^\{([a-z_]+)\}$/.exec(seg)?.[1]
        if (!slotName) {
          literals++
          return seg === value
        }
        const spec = PATTERN_SLOTS[slotName]!
        // region 자리는 바인딩 {변수}도 받는다(변수 검사는 W1 V19)
        const valid =
          'enum' in spec ? spec.enum.includes(value)
          : 'ref' in spec ? ID_PATTERN.test(value) || (spec.ref === 'region' && BINDING_PATTERN.test(value))
          : NAME_PATTERN.test(value)
        if (valid) slots.push({ slot: slotName, value, spec })
        return valid
      })
      if (ok && literals > bestLiterals) {
        best = { pattern: p.pattern, meta: p.meta, slots }
        bestLiterals = literals
      }
    }
    return best
  }

  list(): { pattern: string; meta: M }[] {
    return this.patterns.map(({ pattern, meta }) => ({ pattern, meta }))
  }

  lock(): void {
    this.locked = true
  }
}

// ─────────────────────────────────────────────
// 8 조건 (16 §3.1). 결합자 all·any·not·num과 상수 true·false는 여기서, 단말은 등록부(W4가 등록).
// ─────────────────────────────────────────────

export type Condition = boolean | { [key: string]: unknown }

export const conditions = new ParamRegistry('조건', ['all', 'any', 'not', 'num'])

export function registerCondition(name: string, params: z.ZodType, doc = ''): void {
  conditions.register(name, params, doc)
}

// num 비교 키 (16 §3.2 + counter·family_counter·flag 확장)
export const numKeys = new PatternRegistry<{ doc: string }>('num 키')
for (const [pattern, doc] of [
  ['age', '나이'], ['level', '레벨'], ['coins', '소지금'], ['generation', '가문 대수'],
  ['fatigue', '피로'], ['hp', '현재 체력'], ['hp_max', '최대 체력'], ['thirst', '갈증'],
  ['stat.{stat}', '능력치 원값'], ['skill.{skill}', '숙련 단계'],
  ['counter.{counter}', '생애 카운터'], ['counter.{counter}.{region}', '장소별 생애 카운터'],
  ['family_counter.{counter}', '가문 누적 카운터'], ['relation.{npc}', '인연 수치'],
  ['activity_weight.{activity}', '활동 가중치(04 §5.2 계산값)'],
] as const) numKeys.register(pattern, { doc })

// 코드가 올리는 카운터 이름(엔진 소유). 확장 코드는 registerCounter로 더한다. 첫 조건·효과 검증 때 잠긴다.
export const counterNames = new NameRegistry('카운터', [
  'wins', 'defeats', 'sorties', 'safe_returns', 'inn_rests', 'serious_injuries', 'fear_successes',
  'discoveries', 'map_fragments', 'guild_aids', 'event_scenes',
])
export function registerCounter(name: string): void {
  counterNames.register(name)
}

// 이슈의 params.rule = 검증 규칙 번호(CONTENT_SCHEMA.md §7). 없으면 로더가 S01로 분류한다.
const V3 = { rule: 'V3' }

export const NUM_OPS = ['==', '!=', '>=', '>', '<=', '<'] as const

const numParams = obj({
  key: z.string().superRefine((key, ctx) => {
    if (key.startsWith('flag.')) {
      if (!FLAG_KEY_PATTERN.test(key.slice(5))) ctx.addIssue({ code: 'custom', message: `num 플래그 키 오류: ${key}`, params: V3 })
      return
    }
    const m = numKeys.match(key)
    if (!m) return void ctx.addIssue({ code: 'custom', message: `알 수 없는 num 키: ${key}`, params: V3 })
    const c = m.slots.find((s) => s.slot === 'counter')
    if (c && !counterNames.has(c.value)) ctx.addIssue({ code: 'custom', message: `등록되지 않은 카운터: ${c.value}`, params: V3 })
  }),
  op: z.enum(NUM_OPS),
  value: z.number(),
})

// 이슈를 경로를 붙여 상위 ctx로 옮긴다
// 안쪽 이슈에 규칙 번호가 있으면 그대로 두고, 없으면 rule을 붙인다.
function forward(ctx: z.RefinementCtx, issues: readonly z.core.$ZodIssue[], prefix: PropertyKey[], rule: string): void {
  for (const iss of issues) {
    const inner = (iss as { params?: { rule?: string } }).params?.rule
    ctx.addIssue({ code: 'custom', message: iss.message, path: [...prefix, ...iss.path], params: { rule: inner ?? rule } })
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// 조건은 키 하나짜리 객체의 키로 갈래를 고른다(union 오류 대신 한 갈래의 오류만 낸다).
export const condition: z.ZodType<Condition> = z.lazy(() => {
  conditions.lock()
  numKeys.lock()
  counterNames.lock()
  const list = z.array(condition)
  return z.unknown().superRefine((value, ctx) => {
    if (typeof value === 'boolean') return
    if (!isPlainObject(value)) return void ctx.addIssue({ code: 'custom', message: '조건은 객체 또는 true/false다', params: V3 })
    const keys = Object.keys(value)
    if (keys.length !== 1) {
      return void ctx.addIssue({ code: 'custom', message: `조건 객체는 키가 1개여야 한다(받음: ${keys.join(', ') || '없음'}). 여러 조건은 all로 묶는다`, params: V3 })
    }
    const key = keys[0]!
    const arg = value[key]
    const schema = key === 'all' || key === 'any' ? list : key === 'not' ? condition : key === 'num' ? numParams : conditions.get(key)?.params
    if (!schema) return void ctx.addIssue({ code: 'custom', path: [key], message: `알 수 없는 조건: ${key}`, params: V3 })
    const r = schema.safeParse(arg)
    if (!r.success) forward(ctx, r.error.issues, [key], 'V3')
  }) as unknown as z.ZodType<Condition>
})

// 장소 거르개: 장소 ID 대신 데이터 속성으로 장소 묶음을 가리킨다(조건 location_match, 카운터 합산 등).
// 키끼리는 모두 맞아야 하고(AND), tags는 하나라도 가지면 맞는다.
export const regionFilter = obj({
  ids: z.array(ref('region')).min(1).optional(),
  kinds: z.array(regionKind).min(1).optional(),
  tags: z.array(z.string()).min(1).optional(),
  dungeon_group: ref('dungeon_group').optional(),
  dungeon_depth_gte: posInt.optional(),
}).refine((f) => Object.keys(f).some((k) => !k.startsWith('_')), '장소 거르개는 조건이 하나 이상 필요하다')

// ─────────────────────────────────────────────
// 9 수정자 (16 §3.3). target은 패턴 등록부에서 찾는다.
// ─────────────────────────────────────────────

export const MODIFIER_OPS = ['add', 'mul', 'set', 'flag', 'charges_per_sortie', 'charges_per_life', 'charges_total'] as const
export const SCALAR_OPS = ['add', 'mul', 'set'] as const
export type ScalarOp = (typeof SCALAR_OPS)[number]

// value: 값의 종류. charges = 충전 수(op가 charges_*), bool = op flag, string = op set
// ops: number target에 쓸 수 있는 op를 좁힌다(누적 방식이 정해진 target). ref: string 값이 가리키는 종류(V2)
export type ModifierValueKind = 'number' | 'bool' | 'string' | 'charges'
export interface ModifierTargetMeta {
  value: ModifierValueKind
  doc: string
  ops?: readonly ScalarOp[]
  ref?: RefKind
}
// 첫 수정자 검증 때 잠긴다.
export const modifierTargets = new PatternRegistry<ModifierTargetMeta>('수정자 target')

export function registerModifierTarget(
  pattern: string,
  value: ModifierValueKind,
  doc = '',
  opts: { ops?: readonly ScalarOp[]; ref?: RefKind } = {},
): void {
  modifierTargets.register(pattern, { value, doc, ...opts })
}

// 기본 target. 16 §3.3 + CONTENT_SCHEMA.md §4.3의 추가분.
for (const [pattern, value, doc] of [
  ['stat.{stat}', 'number', '능력치 가산'],
  ['check.{check_kind}', 'number', '판정 종류별 보정'],
  ['check.stat.{stat}', 'number', '그 능력치를 쓰는 모든 판정'],
  ['check.skill.{skill}', 'number', '그 숙련을 쓰는 모든 판정'],
  ['check.all', 'number', '모든 판정'],
  ['hit', 'number', '명중'],
  ['hit_vs.{enemy_family}', 'number', '계열 대상 명중'],
  ['first_round_hit_add', 'number', '전투 첫 라운드 명중'],
  ['first_strike_hit_add', 'number', '선제 공격 라운드 명중'],
  ['damage', 'number', '피해'],
  ['damage_vs.{enemy_family}', 'number', '계열 대상 피해'],
  ['damage_mult', 'number', '피해 배수'],
  ['pair_damage_taken_mult', 'number', '2체 조우에서 받는 피해 배수'],
  ['ac', 'number', '방어'],
  ['hp_max_add', 'number', '최대 체력 가산'],
  ['rest_recovery_mult', 'number', '휴식 회복량'],
  ['breather_mult', 'number', '숨 고르기 회복량'],
  ['camp_hp_mult', 'number', '야영 체력 회복'],
  ['camp_fatigue_add', 'number', '야영 피로 변화에 더함(기본 −40. +10이면 −30, −15면 −55)'],
  ['fatigue_gain_mult', 'number', '피로 획득'],
  ['travel_time_mult', 'number', '이동 시간'],
  ['travel_sec_add.{region}', 'number', '그 장소까지 이동 시간 가산(초)'],
  ['descend_sec_add.{region}', 'number', '입구에서 그 층까지 하강 시간 가산(초)'],
  ['return_travel_time_mult', 'number', '귀환 이동 시간'],
  ['travel_fatigue_add', 'number', '이동 구간 피로 가산'],
  ['discovery_chance_add', 'number', '발견 확률 가산'],
  ['discovery_chance_mult', 'number', '발견 확률 배수'],
  ['trap_encounter_add', 'number', '함정 조우 확률'],
  ['treasure_room_chance_add', 'number', '다음 방 보물 방 확률'],
  ['ambush_chance_add', 'number', '매복 시도 확률'],
  ['encounter_weight_mult.{enemy_family}', 'number', '계열 조우 가중치'],
  ['drop_chance_add', 'number', '장비 드롭 확률 가산(ratio, 0.02 = 2%p)'],
  ['xp_mult', 'number', '경험치'],
  ['coin_mult', 'number', '동전'],
  ['retreat_hp_add', 'number', '퇴각 기준 가산(ratio, 0.10 = 10%p)'],
  ['activity_weight.{activity}', 'number', '활동 가중치'],
  ['location_score.{region}', 'number', '장소 점수 가산'],
  ['inn_cost_mult', 'number', '여관비'],
  ['food_cost_mult', 'number', '야영 식량 값'],
  ['maintenance_mult', 'number', '정비비'],
  ['shop_surcharge', 'number', '상점 가격 가산'],
  ['reserve_add', 'number', '예약금 비율 가산'],
  ['defeat_loss_mult', 'number', '일반 패배 손실 비율'],
  ['equip_eval_mult', 'number', '장비 평가 점수 배수(08 §7)'],
  ['mining_reward_mult', 'number', '광맥 채취 보상'],
  ['forage_reward_mult', 'number', '채집 보상'],
  ['luck_drop_add', 'number', '희귀 드롭 가중'],
  ['thirst_gain_mult', 'number', '갈증 증가 배수'],
  ['enemy_hit_first_round_add', 'number', '관문 첫 라운드 적 명중'],
  ['night_damage_mult', 'number', '밤 출정 피해'],
  ['day_fatigue_mult', 'number', '낮 출정 피로'],
  ['final_check_add', 'number', '최후 판정 가산'],
  ['second_wind_ratio', 'number', '두 번째 숨 회복 비율'],
  ['special.{special}.{param}', 'number', '적 특수능력 수치 가산(예: 쇳소리 피로)'],
  ['fear_immunity', 'bool', '공포 면역'],
  ['dark_penalty_ignore', 'bool', '어둠 불리 무시'],
  ['camp_raid_immunity', 'bool', '야영 판단 지점에서 tags에 raid가 있는 사건을 뺀다'],
  ['ambush_negate', 'charges', '매복 무효'],
  ['escape_on_defeat', 'charges', '패배·치명 탈출'],
  ['serious_heal', 'charges', '중상 즉시 치유'],
  ['second_wind', 'charges', '두 번째 숨'],
] as const) registerModifierTarget(pattern, value, doc)

// 누적 방식이 정해진 target. add = 기준 1.0에 퍼센트 보정을 모두 더한 뒤 한 번 곱한다(05 §4.4, 08 §5.2).
for (const [pattern, doc, ops] of [
  ['hp_max_mult', '최대 체력 배수(기준 1.0, 합산)', ['add']],
  ['price_mult', '상점 구매가 배수(기준 1.0, 할인 합산, 상한 economy.discount_cap)', ['add']],
  ['sell_mult', '판매가 배수(기준 1.0, 합산)', ['add']],
  ['recovery_coef', '회복 계수 고정', ['set']],
  ['defeat_item_loss_chance', '패배 시 획득 장비 손실 확률 고정', ['set']],
] as const) registerModifierTarget(pattern, 'number', doc, { ops })

registerModifierTarget('rescuer_override', 'string', '패배 구조자 고정(defeat.rescuer_lines 키)', { ref: 'rescuer' })

export const modifier = obj({
  target: z.string(),
  op: z.enum(MODIFIER_OPS),
  value: z.union([z.number(), z.boolean(), z.string()]),
  when: condition.optional(),
}).superRefine((m, ctx) => {
  modifierTargets.lock()
  const hit = modifierTargets.match(m.target)
  if (!hit) return void ctx.addIssue({ code: 'custom', path: ['target'], message: `알 수 없는 수정자 target: ${m.target}`, params: V3 })
  const kind = hit.meta.value
  const ops: readonly string[] = hit.meta.ops ?? SCALAR_OPS
  const ok =
    kind === 'number' ? ops.includes(m.op) && typeof m.value === 'number'
    : kind === 'bool' ? m.op === 'flag' && typeof m.value === 'boolean'
    : kind === 'string' ? m.op === 'set' && typeof m.value === 'string'
    : m.op.startsWith('charges_') && typeof m.value === 'number' && Number.isInteger(m.value) && m.value >= 1
  if (!ok) ctx.addIssue({ code: 'custom', path: ['op'], message: `${m.target}(${kind})에 맞지 않는 op/value: ${m.op} ${String(m.value)}`, params: V3 })
})

export type Modifier = z.infer<typeof modifier>

// ─────────────────────────────────────────────
// 10 효과 (16 §4.3). 모든 효과는 type과 선택 when을 가진다. 종류는 등록부(W4가 등록).
// ─────────────────────────────────────────────

export type Effect = { type: string; when?: Condition; [key: string]: unknown }

export const effects = new ParamRegistry('효과', ['type', 'when'])

// 파라미터 사이의 제약(예: amount와 units 중 하나). 문제가 있으면 메시지를 돌려준다.
export type EffectCheck = (value: Record<string, unknown>) => string | undefined

export function registerEffect(name: string, shape: z.ZodRawShape, doc = '', check?: EffectCheck): void {
  const base = obj({ type: z.literal(name), when: condition.optional(), ...shape })
  const params = check
    ? base.superRefine((v, ctx) => {
        const msg = check(v as Record<string, unknown>)
        if (msg) ctx.addIssue({ code: 'custom', message: msg, params: { rule: 'V4' } })
      })
    : base
  effects.register(name, params, doc)
}

// 나열한 키 중 정확히 하나만 있어야 한다
export function exactlyOne(...keys: string[]): EffectCheck {
  return (v) => {
    const n = keys.filter((k) => v[k] !== undefined).length
    return n === 1 ? undefined : `${keys.join(' | ')} 중 정확히 하나가 필요하다(받음 ${n}개)`
  }
}

// 효과 이슈는 V4로 보고한다(조건처럼 안쪽 규칙 번호가 있으면 그대로). 워커(W1)는 type으로 파라미터 스키마를 찾는다.
export const effect: z.ZodType<Effect> = z.lazy(() => {
  effects.lock()
  counterNames.lock()
  const list = effects.list()
  if (list.length === 0) throw new Error('효과 등록부가 비어 있다(효과 등록 모듈을 먼저 불러온다)')
  const options = list.map((e) => e.params) as unknown as [z.core.$ZodTypeDiscriminable, ...z.core.$ZodTypeDiscriminable[]]
  const union = z.discriminatedUnion('type', options, { error: '알 수 없는 효과 type(효과 등록부에 없음)' })
  return z.unknown().superRefine((value, ctx) => {
    const r = union.safeParse(value)
    if (!r.success) forward(ctx, r.error.issues, [], 'V4')
  }) as unknown as z.ZodType<Effect>
})

export const effectList = z.array(effect)
