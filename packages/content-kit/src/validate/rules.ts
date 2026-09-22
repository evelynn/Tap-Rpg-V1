// 참조·의미 검사(CONTENT_SCHEMA §7.2·§7.3). 스키마 검증(S01)을 통과한 색인에만 쓴다.
// 스키마 refine이 이미 보는 규칙(V7·V8·V10·V13·V14 등)은 여기서 다시 보지 않는다.
import type { z } from 'zod'
import {
  BINDING_PATTERN,
  SPECIALIZATIONS,
  checkDcRule,
  derivedChainFlags,
  enemySpecials,
  enemyStats,
  extractTemplateVars,
  renderTemplate,
  templateVars,
  textSlots,
  traitHooks,
  type Balance,
  type Chain,
  type ContentKind,
  type Enemy,
  type Event,
  type FlagDef,
  type RefKind,
  type TemplateValues,
  type Trait,
} from '../core'
import type { DefIndex } from '../pack/index-defs'
import type { RawDef } from '../pack/read'
import { issue, patchNote, toPointer, type ContentIssue, type IssueCode, type Severity } from './issues'
import { KIND_SCHEMAS } from './kind-schemas'
import { collectRefs, isObject, NOTE_KEYS, zodOf, type Facts, type Path } from './refs'

type Obj = Record<string, unknown>
type CheckLike = Parameters<typeof checkDcRule>[0]
type Report = (code: IssueCode, d: RawDef, path: Path, message: string, severity?: Severity) => void

export function runSemanticChecks(index: DefIndex, schemas: Record<ContentKind, z.ZodType> = KIND_SCHEMAS): ContentIssue[] {
  const issues: ContentIssue[] = []
  const report: Report = (code, d, path, message, severity) =>
    issues.push(issue(code, { pack: d.pack, file: d.file, pointer: d.pointer + toPointer(path) }, message + patchNote(d), severity))
  const defs = (kind: ContentKind) => [...(index.get(kind)?.values() ?? [])]
  const get = (kind: ContentKind, id: string) => index.get(kind)?.get(id)
  const balance = get('balance', 'balance')?.value as Balance | undefined
  // balance가 없으면 V6·V11·V17·V20·tier 상한·첫 출정 검사가 꺼진다. 다른 정의가 있으면 오류로 알린다
  if (!balance && [...index.keys()].some((k) => k !== 'balance')) issues.push(issue('V2', { pack: '', file: '' }, 'balance 정의가 없다(기반 팩의 balance.json)'))

  const nested = nestedNamespaces(index, report)
  const exists = (kind: RefKind, id: string) => Boolean(index.get(kind as ContentKind)?.has(id) || nested.get(kind)?.has(id))
  const flags = flagRegistry(index, report)
  const longest = balance && longestValues(index, balance)
  const dcKindOf = (k: string) => balance?.check_kinds[k]?.dc.kind
  const tierCount = balance?.economy.tier_levels.length
  // V5·V2가 처음 읽을 때 잠근다(W4 등록부는 스키마가 읽지 않는다)
  templateVars.lock()
  textSlots.lock()

  const facts = new Map<RawDef, Facts>()
  for (const [kind, byId] of index) for (const d of byId.values()) facts.set(d, collectRefs(schemas[kind], d.value))

  for (const [d, f] of facts) {
    const eventVars = new Set(d.kind === 'event' ? ((d.value as Event).context_vars ?? []).map((c) => c.var) : [])
    const binding = (name: string, path: Path) => {
      if (name !== 'place' && !eventVars.has(name)) report('V19', d, path, `바인딩 {${name}}은 {place} 또는 그 사건 context_vars 변수여야 한다`)
    }

    for (const r of f.refs) if (!exists(r.kind, r.id)) report('V2', d, r.path, `${r.kind} '${r.id}' 정의가 없다`)
    for (const b of f.bindings) binding(b.name, b.path)
    for (const fl of f.flags) {
      const hit = flags.resolve(fl.key)
      if (!hit) report('V19', d, fl.path, `플래그 등록표에 없는 키: ${fl.key}`)
      else if (hit.slot === undefined) continue
      else if (BINDING_PATTERN.test(hit.slot)) {
        if (hit.kind !== 'region') report('V19', d, fl.path, `바인딩은 장소 자리에만 쓴다: ${fl.key}`)
        else binding(hit.slot.slice(1, -1), fl.path)
      } else if (hit.kind === 'specialization') {
        if (!(SPECIALIZATIONS as readonly string[]).includes(hit.slot)) report('V19', d, fl.path, `전문화 이름이 아니다: ${fl.key}`)
      } else if (!exists(hit.kind as RefKind, hit.slot)) report('V2', d, fl.path, `${hit.kind} '${hit.slot}' 정의가 없다(플래그 키 ${fl.key})`)
    }

    for (const t of f.templates) {
      let names: string[]
      try {
        names = extractTemplateVars(t.text)
      } catch (e) {
        report('V5', d, t.path, `템플릿: ${(e as Error).message}`)
        continue
      }
      let ok = true
      for (const n of names) {
        const source = templateVars.match(n)?.meta.source
        if (!source) report('V5', d, t.path, `등록되지 않은 템플릿 변수 {${n}}`)
        else if (source === 'event' && !eventVars.has(n)) report('V5', d, t.path, `사건 변수 {${n}}는 그 사건 context_vars에 있어야 한다`)
        ok &&= source !== undefined
      }
      if (t.line && balance && longest && ok) {
        const max = (d.kind === 'text' ? (d.value.max_len as number | undefined) : undefined) ?? balance.ui.line_max
        const len = [...renderTemplate(t.text, longest)].length
        if (len > max) report('V6', d, t.path, `한 줄 기록이 가장 긴 대입에서 ${len}자다(상한 ${max})`)
      }
    }

    for (const s of f.specials) {
      const entry = enemySpecials.get(s.special)
      const params = entry ? Object.keys(zodOf(entry.params).def.shape as Obj).filter((k) => k !== 'kind' && !NOTE_KEYS.has(k)) : []
      if (!entry) report('V3', d, s.path, `알 수 없는 적 특수능력: ${s.special}`)
      else if (!params.includes(s.param)) report('V3', d, s.path, `${s.special}에 없는 파라미터: ${s.param}`)
    }
    for (const h of f.hooks) if (!traitHooks.get(h.name)) report('V3', d, h.path, `알 수 없는 특성 훅: ${h.name}`)

    for (const c of f.checks) {
      const msg = balance && checkDcRule(c.value as CheckLike, dcKindOf)
      if (msg) report('V20', d, c.path, msg)
    }
    for (const { value: e, path } of f.effects) {
      if (e.type === 'damage' && e.hp !== undefined) {
        report('V9', d, [...path, 'hp'], '고정 피해 hp는 체력이 낮을 때 위험하다(hp_ratio 권장)', 'warn')
      }
      if (e.type === 'mutate' && typeof e.trait_id === 'string') {
        const trait = get('trait', e.trait_id)?.value as Trait | undefined
        if (trait && trait.kind !== 'mutation') report('V4', d, [...path, 'trait_id'], `mutate는 kind mutation 특성만 가리킨다: ${e.trait_id}`)
      }
      if (e.type === 'end_chain' && typeof e.chain_id === 'string') {
        const chain = get('chain', e.chain_id)?.value as Chain | undefined
        if (chain && !chain.outcomes.includes(String(e.outcome))) report('V12', d, [...path, 'outcome'], `줄기 ${chain.id}의 outcomes에 없다: ${String(e.outcome)}`)
      }
      if (e.type === 'roll_check' && isObject(e.check)) {
        const msg = balance && checkDcRule(e.check as CheckLike, dcKindOf)
        if (msg) report('V20', d, [...path, 'check'], msg)
      }
      // 사건 변수를 가리키는 파라미터(place_var·location_var·enemy_var)
      for (const [k, v] of Object.entries(e)) {
        if (k.endsWith('_var') && typeof v === 'string' && !eventVars.has(v)) report('V5', d, [...path, k], `${k} ${v}는 그 사건 context_vars 변수여야 한다`)
      }
      if (tierCount && typeof e.tier === 'number' && e.tier > tierCount) report('S01', d, [...path, 'tier'], `tier ${e.tier}는 장비 단계 수(${tierCount})를 넘는다`)
    }
  }

  for (const kind of ['item', 'consumable'] as const) {
    for (const d of defs(kind)) {
      const t = d.value.tier
      if (tierCount && typeof t === 'number' && t > tierCount) report('S01', d, ['tier'], `tier ${t}는 장비 단계 수(${tierCount})를 넘는다`)
    }
  }

  // 사건: 부분 성공(V11), context_vars 순서(V5)
  for (const d of defs('event')) {
    const e = d.value as Event
    ;(e.context_vars ?? []).forEach((cv, i, all) => {
      const pv = isObject(cv.params) ? cv.params.place_var : undefined
      if (typeof pv === 'string' && !all.slice(0, i).some((p) => p.var === pv)) {
        report('V5', d, ['context_vars', i, 'params', 'place_var'], `place_var ${pv}는 앞 항목이 채운 변수여야 한다`)
      }
    })
    if (!balance) continue
    e.choices.forEach((c, i) => {
      if (!c.check || !c.outcomes.partial) return
      for (const k of c.check.kind !== undefined ? [c.check.kind] : (c.check.any_of ?? [])) {
        const ck = balance.check_kinds[k]
        if (!ck) continue
        const on = ck.partial || (ck.partial_event_defined === true && c.check.partial_allowed === true)
        if (!on || c.check.partial_allowed === false) report('V11', d, ['choices', i, 'outcomes', 'partial'], `판정 종류 ${k}는 이 선택지에서 부분 성공을 쓸 수 없다`)
      }
    })
  }

  // 연속 사건 단계(V12): 1..stages 빈틈·중복 없음, 단계 n>1은 all 최상위에 chain_stage n−1
  const byChain = groupBy(defs('event').filter((d) => (d.value as Event).chain), (d) => (d.value as Event).chain!.id)
  for (const cd of defs('chain')) {
    const c = cd.value as Chain
    const events = byChain.get(c.id) ?? []
    const stageOf = (d: RawDef) => (d.value as Event).chain!.stage
    for (let s = 1; s <= c.stages; s++) {
      const at = events.filter((d) => stageOf(d) === s)
      if (at.length === 0) report('V12', cd, ['stages'], `단계 ${s} 사건이 없다`)
      for (const dup of at.slice(1)) report('V12', dup, ['chain', 'stage'], `줄기 ${c.id} 단계 ${s} 사건이 둘 이상이다(${at[0]!.id})`)
    }
    for (const d of events) {
      const s = stageOf(d)
      if (s > c.stages) report('V12', d, ['chain', 'stage'], `줄기 ${c.id}의 단계 수(${c.stages})를 넘는다`)
      else if (s > 1 && !hasChainStage((d.value as Event).condition, c.id, s - 1)) {
        report('V12', d, ['condition'], `조건의 all 최상위에 chain_stage {chain: ${c.id}, stage: ${s - 1}}가 필요하다`)
      }
    }
  }

  // 특성 acquire type event(V15): 그 선택지 결과에 add_trait(변이 특성이면 mutate)가 있어야 한다
  for (const d of defs('trait')) {
    const t = d.value as Trait
    const acq = t.acquire
    if (acq?.type !== 'event') continue
    const ev = get('event', acq.event_id)
    if (!ev) continue
    const ci = (ev.value as Event).choices.findIndex((c) => c.id === acq.choice)
    const gives = ci >= 0 && facts.get(ev)!.effects.some((e) =>
      e.path[0] === 'choices' && e.path[1] === ci && (e.value.type === 'add_trait' || e.value.type === 'mutate') && e.value.trait_id === t.id)
    if (ci < 0) report('V15', d, ['acquire', 'choice'], `사건 ${ev.id}에 선택지 ${acq.choice}가 없다`)
    else if (!gives) report('V15', d, ['acquire'], `사건 ${ev.id} 선택지 ${acq.choice}의 결과에 add_trait·mutate ${t.id}가 없다`)
  }

  // 적 수치(V17): enemy_formula와 다르면 경고. 등록부 값이 기준이면 _note를 단다. 식은 코어 enemyStats(런타임과 같은 구현)
  if (balance) {
    for (const d of defs('enemy')) {
      const e = d.value as Enemy & { _note?: string }
      if (e._note !== undefined) continue
      const want = enemyStats(balance.enemy_formula, e.level, e.rank)
      const got = { hp: e.hp, ac: e.ac, hit: e.hit, dmg_min: e.damage[0], dmg_max: e.damage[1], xp: e.xp, coins: e.coins }
      const diff = Object.entries(want).filter(([k, v]) => got[k as keyof typeof got] !== v).map(([k, v]) => `${k} ${got[k as keyof typeof got]}(식 ${v})`)
      if (diff.length) report('V17', d, [], `적 수치가 enemy_formula와 다르다: ${diff.join(', ')}. 등록부 값이 기준이면 _note를 단다`, 'warn')
    }
  }

  // 던전 group마다 depth 1..n 연속(V2)
  const groups = groupBy(defs('region').filter((d) => isObject(d.value.dungeon)), (d) => String((d.value.dungeon as Obj).group))
  for (const [g, floors] of groups) {
    const seen = new Map<number, RawDef>()
    for (const d of floors) {
      const depth = (d.value.dungeon as { depth: number }).depth
      const prev = seen.get(depth)
      if (prev) report('V2', d, ['dungeon', 'depth'], `던전 ${g} depth ${depth}가 겹친다(${prev.id})`)
      else seen.set(depth, d)
    }
    for (let k = 1; k <= Math.max(...seen.keys()); k++) {
      if (!seen.has(k)) report('V2', floors[0]!, ['dungeon', 'depth'], `던전 ${g}에 depth ${k} 층이 없다(1부터 빈틈 없이 잇는다)`)
    }
  }

  // 코어가 부르는 문형 id(V2)
  for (const s of textSlots.list()) {
    if (!index.get('text')?.has(s.pattern)) issues.push(issue('V2', { pack: '', file: '' }, `코어가 쓰는 문형 id가 없다: ${s.pattern}`))
  }

  // 첫 출정 보장 사건의 선택지(V2)
  if (balance) {
    const ge = balance.first_sortie.guaranteed_event
    const ev = get('event', ge.event)?.value as Event | undefined
    if (ev && !ev.choices.some((c) => c.id === ge.choice)) {
      report('V2', get('balance', 'balance')!, ['first_sortie', 'guaranteed_event', 'choice'], `사건 ${ev.id}에 선택지 ${ge.choice}가 없다`)
    }
  }
  return issues
}

// 중첩 이름공간(CONTENT_SCHEMA §1.3). 종류별로 고유해야 한다(V1). dungeon_group은 여러 층이 같은 값을 쓴다.
function nestedNamespaces(index: DefIndex, report: Report): Map<RefKind, Set<string>> {
  const ns = new Map<RefKind, Set<string>>()
  const add = (kind: RefKind, id: string, d: RawDef, path: Path, unique = true) => {
    let set = ns.get(kind)
    if (!set) ns.set(kind, (set = new Set()))
    if (unique && set.has(id)) report('V1', d, path, `${kind} '${id}' 중복 정의`)
    set.add(id)
  }
  const keysOf = (kind: RefKind, d: RawDef, path: Path) => {
    let o: unknown = d.value
    for (const k of path) o = isObject(o) ? o[k] : undefined
    for (const k of Object.keys(isObject(o) ? o : {})) if (!NOTE_KEYS.has(k)) add(kind, k, d, [...path, k])
  }
  const list = (kind: RefKind, d: RawDef, key: string, items: unknown) => {
    if (Array.isArray(items)) items.forEach((x, i) => isObject(x) && typeof x.id === 'string' && add(kind, x.id, d, [...key.split('.'), i, 'id']))
  }

  const b = index.get('balance')?.get('balance')
  if (b) {
    keysOf('check_kind', b, ['check_kinds'])
    keysOf('drop_table', b, ['economy', 'drops'])
    keysOf('carry_group', b, ['economy', 'carry_limits'])
    keysOf('rescuer_table', b, ['defeat', 'rescuers'])
    keysOf('rescuer', b, ['defeat', 'rescuer_lines'])
  }
  for (const d of index.get('region')?.values() ?? []) {
    list('facility', d, 'facilities', d.value.facilities)
    list('discovery', d, 'discoveries', d.value.discoveries)
    list('map_fragment', d, 'map_fragments', d.value.map_fragments)
    const dungeon = d.value.dungeon
    if (isObject(dungeon) && typeof dungeon.group === 'string') add('dungeon_group', dungeon.group, d, ['dungeon', 'group'], false)
  }
  for (const d of index.get('trait')?.values() ?? []) {
    list('thirst_stage', d, 'mutation.thirst.stages', (d.value as Trait).mutation?.thirst.stages)
  }
  return ns
}

// 플래그 등록표(flags.json) + 줄기 파생 키(CONTENT_SCHEMA §5.8·§5.9). 파생 키를 등록표에 다시 적으면 경고.
function flagRegistry(index: DefIndex, report: Report) {
  const fixed = new Map<string, RawDef | undefined>()
  // 키 묶음: 자리 앞까지의 접두(life.l01_marked_)와 자리 종류
  const families: { prefix: string; kind: string | undefined }[] = []
  const add = (f: FlagDef, d?: RawDef) => {
    const tail = /_\{([a-z][a-z0-9_]*)\}$/.exec(f.id)
    if (tail) families.push({ prefix: f.id.slice(0, tail.index + 1), kind: f.family?.[tail[1]!] })
    else fixed.set(f.id, d)
  }
  for (const d of index.get('flag')?.values() ?? []) add(d.value as FlagDef, d)
  for (const d of index.get('chain')?.values() ?? []) {
    for (const f of derivedChainFlags(d.value as Chain)) {
      const listed = fixed.get(f.id)
      if (listed) report('V19', listed, ['id'], `줄기 ${d.id} 파생 키라 등록표에 적지 않아도 된다: ${f.id}`, 'warn')
      else add(f)
    }
  }
  return {
    // 고정 키면 slot 없음, 키 묶음이면 자리 값과 종류(가장 긴 접두)
    resolve(key: string): { slot?: string; kind?: string } | undefined {
      if (fixed.has(key)) return {}
      const fam = families.filter((x) => key.startsWith(x.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0]
      return fam && { slot: key.slice(fam.prefix.length), kind: fam.kind }
    },
  }
}

// V6 가장 긴 대입(CONTENT_SCHEMA §7.2): 사람 이름은 ui.name_len 최대, 정의 이름은 번들에서 가장 긴 값, 숫자는 5자리.
// 번들로 길이를 알 수 없는 변수(문장·구)는 한 글자로 둔다(길이 하한). 받침 있는 글자로 채워 긴 조사(으로·이랑)를 쓴다.
const PERSON_VARS = ['name', 'heir', 'parent_name', 'partner', 'child', 'guardian', 'friend']
const NUMBER_VARS = [
  'generation', 'age', 'level', 'retire_age', 'retire_age_plus10', 'sleep_age', 'luck', 'luck_after', 'start', 'end',
  'depth', 'coins', 'count', 'n', 'm', 'dice', 'stat_value', 'bonus', 'luck_half', 'total', 'dc',
]
const DEF_NAME_VARS: Record<string, ContentKind[]> = {
  place: ['region'], rumor_place: ['region'], target_place: ['region'],
  item: ['item', 'consumable'], old_item: ['item'], weapon: ['item'], relic: ['item'], relic_name: ['item'],
  loot: ['item', 'consumable', 'material'], enemy: ['enemy'], enemy_kind: ['enemy_family'], npc: ['npc'], binder: ['npc'],
  attitude: ['attitude'], rank: ['guild_rank'], role: ['retire_role'], trait: ['trait'], old_trait: ['trait'],
  trait_name: ['trait'], achievement: ['achievement'], chain_name: ['chain'],
}

function longestValues(index: DefIndex, balance: Balance): TemplateValues {
  const longestName = (kinds: ContentKind[]) => {
    let best = '가'
    for (const k of kinds) {
      for (const d of index.get(k)?.values() ?? []) {
        const name = d.value.name
        if (typeof name === 'string' && [...name].length > [...best].length) best = name
      }
    }
    return best
  }
  const values: Record<string, string> = {}
  for (const { pattern: name } of templateVars.list()) {
    values[name] =
      PERSON_VARS.includes(name) ? '각'.repeat(balance.ui.name_len[1])
      : name === 'family' ? '각'.repeat(balance.ui.family_name_len[1])
      : NUMBER_VARS.includes(name) ? '00000'
      : DEF_NAME_VARS[name] ? longestName(DEF_NAME_VARS[name])
      : '각'
  }
  return values
}

function groupBy<T>(items: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of items) {
    const k = key(x)
    const list = m.get(k)
    if (list) list.push(x)
    else m.set(k, [x])
  }
  return m
}

function hasChainStage(cond: unknown, chain: string, stage: number): boolean {
  const list = isObject(cond) && Array.isArray(cond.all) ? cond.all : [cond]
  return list.some((c) => isObject(c) && isObject(c.chain_stage) && c.chain_stage.chain === chain && c.chain_stage.stage === stage)
}
