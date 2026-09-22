// 수정자 집계(16 §3.3, CONTENT_SCHEMA §4.3): 출처 모으기 → when 평가 → target별 set → add → mul.
// 저장 record(장착·출정 플래그)는 키 삽입 순서가 아니라 고정 순서로 돈다. 불러온 저장의 키 순서가 달라도
// set의 마지막 값과 판정 기록 항 순서가 같아야 한다.
import { SLOTS, type Modifier } from '../schema/index'
import type { TempMod } from '../state/common'
import { characterOf, type RuleContext } from './context'
import { SOURCE_LABELS, SPEC_LABELS, WEATHER_LABELS } from './labels'

export type ModSourceKind =
  | 'trait' | 'mutation' | 'item' | 'specialization' | 'temp' | 'trip' | 'weather' | 'night' | 'fatigue' | 'situational'

// 한 출처의 수정자 묶음. label은 판정 기록 항 이름, key는 출처 id(특성·장비 정의 등)
export interface ModSource {
  kind: ModSourceKind
  key: string
  label: string
  modifiers: readonly Modifier[]
}

// 아직 켜지지 않은 일시 수정자 scope. 그 출정·장면·방문을 시작하는 규칙이 scope를 sortie·scene으로 바꿔 켠다.
// next_check·next_decision·encounters는 켜진 채로 두고 쓰는 쪽이 줄이거나 지운다
const PENDING_SCOPES: readonly TempMod['scope'][] = ['next_sortie', 'next_scene', 'next_visit']

// 인물에게 지금 붙는 모든 수정자 출처. 순서: 특성 → 변이 → 장비 → 전문화 → 일시 → 출정 플래그 → 날씨 → 밤 → 피로.
// 출처 추가(발견 지점·은퇴 역할·완성 지도 등)는 이 함수 한 곳에 한다(ARCHITECTURE §3)
export function collectModSources(ctx: RuleContext): ModSource[] {
  const { content, state } = ctx
  const b = content.balance
  const ch = characterOf(ctx)
  const sortie = state.current_activity.sortie
  const out: ModSource[] = []

  for (const t of ch.traits) {
    if (t.inactive) continue
    const def = content.get('trait', t.id)
    out.push({ kind: 'trait', key: t.id, label: def.short_name ?? def.name, modifiers: def.modifiers })
  }

  if (ch.mutation) {
    const def = content.get('trait', ch.mutation.trait_id)
    const m = def.mutation
    if (m) {
      const mods = [...m.modifiers]
      if (sortie) mods.push(...m.time_modifiers[sortie.time_of_day])
      const stage = [...m.thirst.stages].sort((a, b2) => a.from - b2.from).filter((st) => st.from <= ch.mutation!.thirst).pop()
      if (stage?.modifiers) mods.push(...stage.modifiers)
      out.push({ kind: 'mutation', key: def.id, label: def.short_name ?? def.name, modifiers: mods })
    }
  }

  for (const slot of SLOTS) {
    const uid = state.inventory.equipped[slot]
    if (!uid) continue
    const inst = state.item_instances[uid]
    if (!inst) throw new Error(`장착 장비 인스턴스가 없다: ${uid}`)
    if (inst.used) continue // 1회용을 쓴 기념품은 효과가 없다(08 R03)
    const def = content.get('item', inst.def_id)
    const mods = [...(def.modifiers ?? []), ...(def.grade_modifiers?.[inst.grade] ?? []), ...(inst.defect ?? [])]
    for (const e of inst.effects ?? []) mods.push(...content.get('item_effect', e).modifiers)
    out.push({ kind: 'item', key: def.id, label: def.name, modifiers: mods })
  }

  if (ch.specialization !== 'none') {
    const spec = b.specializations[ch.specialization]
    if (spec) out.push({ kind: 'specialization', key: ch.specialization, label: SPEC_LABELS[ch.specialization], modifiers: spec.modifiers })
  }

  // 대기 scope와 만료된 eff_min 수정자는 빼고 모은다
  const temps = [...ch.temp_mods, ...(sortie?.temp_mods ?? [])].filter(
    (t) => !PENDING_SCOPES.includes(t.scope) && !(t.expires_eff_min !== null && t.expires_eff_min <= ch.eff_min),
  )
  if (temps.length) out.push({ kind: 'temp', key: 'temp', label: SOURCE_LABELS.temp, modifiers: temps.map((t) => t.modifier) })

  if (sortie) {
    for (const key of Object.keys(sortie.trip_flags).sort()) {
      if (!sortie.trip_flags[key]!.value) continue
      const mods = content.has('flag', key) ? content.get('flag', key).trip_modifiers : undefined
      if (mods?.length) out.push({ kind: 'trip', key, label: SOURCE_LABELS.trip, modifiers: mods })
    }
    // 날씨는 야외만. weather_exempt 장소(던전 층 등)도 입구까지 오가는 동안은 받는다(01 §1.3)
    const st = state.current_activity.state
    if (!content.get('region', sortie.location_id).weather_exempt || st === 'travel' || st === 'return') {
      const mods = b.weather.effects[sortie.weather]
      if (mods.length) out.push({ kind: 'weather', key: sortie.weather, label: WEATHER_LABELS[sortie.weather], modifiers: mods })
    }
    if (sortie.time_of_day === 'night') {
      const n = b.combat.night
      const sight = n.sight_checks.map((k): Modifier => ({ target: `check.${k}`, op: 'add', value: n.sight_penalty }))
      out.push({ kind: 'night', key: 'night', label: SOURCE_LABELS.night, modifiers: [...n.modifiers, ...sight] })
    }
  }

  const f = b.stats.fatigue
  if (ch.fatigue >= f.penalty_at) {
    out.push({
      kind: 'fatigue', key: 'fatigue', label: SOURCE_LABELS.fatigue,
      modifiers: [{ target: 'check.all', op: 'add', value: f.penalty_check_all }],
    })
  }
  return out
}

export interface AppliedMod {
  source: ModSource
  mod: Modifier
}

// targets 중 하나에 맞고 when이 참인 수정자
export function activeMods(ctx: RuleContext, sources: readonly ModSource[], targets: readonly string[]): AppliedMod[] {
  const out: AppliedMod[] = []
  for (const source of sources) {
    for (const mod of source.modifiers) {
      if (!targets.includes(mod.target)) continue
      if (mod.when !== undefined && !ctx.test(mod.when)) continue
      out.push({ source, mod })
    }
  }
  return out
}

// (마지막 set 또는 기준값) + Σadd, 그 뒤 × Πmul. number가 아닌 값(flag·charges)은 건너뛴다
export function aggregate(mods: readonly Pick<AppliedMod, 'mod'>[], base: number): number {
  let set: number | undefined
  let add = 0
  let mul = 1
  for (const { mod } of mods) {
    if (typeof mod.value !== 'number') continue
    if (mod.op === 'set') set = mod.value
    else if (mod.op === 'add') add += mod.value
    else if (mod.op === 'mul') mul *= mod.value
  }
  return ((set ?? base) + add) * mul
}

// target 하나의 값. 출처를 주지 않으면 지금 인물의 출처를 모은다
export function modValue(ctx: RuleContext, target: string, base: number, sources: readonly ModSource[] = collectModSources(ctx)): number {
  return aggregate(activeMods(ctx, sources, [target]), base)
}

// bool target(fear_immunity 등): 참인 flag가 하나라도 있으면 참
export function modFlag(ctx: RuleContext, target: string, sources: readonly ModSource[] = collectModSources(ctx)): boolean {
  return activeMods(ctx, sources, [target]).some(({ mod }) => mod.op === 'flag' && mod.value === true)
}
