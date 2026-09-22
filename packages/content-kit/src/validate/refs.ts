// 참조 워커(CONTENT_SCHEMA §7.3). 종류 스키마와 데이터를 함께 따라가며 의미 검사 대상을 모은다.
// 스키마 검증(S01)을 통과한 데이터에만 쓴다. zod 4 공개 정의(_zod.def)를 읽는다.
import type { z } from 'zod'
import {
  BINDING_PATTERN,
  checkSchema,
  condition,
  conditions,
  effect,
  effects,
  modifier,
  modifierTargets,
  numKeys,
  refKindOf,
  templateRegistry,
  type PatternMatch,
  type RefKind,
} from '../core'

export type Path = (string | number)[]
type Obj = Record<string, unknown>

export interface Facts {
  // ID 참조(V2). 플래그 키는 flags로 따로 모은다
  refs: { kind: RefKind; id: string; path: Path }[]
  // 플래그 키(V19): flagKey 필드와 num의 flag.* 키
  flags: { key: string; path: Path }[]
  // 자리 바인딩 {변수}(V19): 장소 파라미터, 수정자·num 키의 {region} 자리. 플래그 키 꼬리는 flags에서 본다
  bindings: { name: string; path: Path }[]
  // 문장 템플릿(V5), line이면 한 줄 기록(V6)
  templates: { text: string; line: boolean; path: Path }[]
  effects: { value: Obj; path: Path }[]
  // 사건 선택지 판정(checkSchema)
  checks: { value: Obj; path: Path }[]
  // 수정자 target special.{special}.{param}(V3)
  specials: { special: string; param: string; path: Path }[]
  // trait_hook 조건의 훅 이름(V3)
  hooks: { name: string; path: Path }[]
}

interface ZodInternals {
  def: Obj & { type: string }
  innerType?: z.ZodType
  propValues?: Record<string, Set<unknown>>
}
export const zodOf = (s: z.ZodType) => (s as unknown as { _zod: ZodInternals })._zod

export const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
export const NOTE_KEYS = new Set(['_note', '_comment'])
const bindingName = (text: string) => (BINDING_PATTERN.test(text) ? text.slice(1, -1) : undefined)

export function collectRefs(schema: z.ZodType, value: unknown): Facts {
  const f: Facts = { refs: [], flags: [], bindings: [], templates: [], effects: [], checks: [], specials: [], hooks: [] }

  // 패턴 자리 값: ref 자리면 참조, {region} 자리의 {변수}면 바인딩
  const slot = (s: PatternMatch<unknown>['slots'][number], path: Path) => {
    if (!('ref' in s.spec)) return
    const name = s.spec.ref === 'region' ? bindingName(s.value) : undefined
    if (name) f.bindings.push({ name, path })
    else f.refs.push({ kind: s.spec.ref, id: s.value, path })
  }

  const walkCondition = (v: unknown, path: Path): void => {
    if (!isObject(v)) return
    const key = Object.keys(v)[0]
    if (key === undefined) return
    const arg = v[key]
    const at = [...path, key]
    if (key === 'all' || key === 'any') {
      if (Array.isArray(arg)) arg.forEach((c, i) => walkCondition(c, [...at, i]))
    } else if (key === 'not') {
      walkCondition(arg, at)
    } else if (key === 'num') {
      if (!isObject(arg) || typeof arg.key !== 'string') return
      if (arg.key.startsWith('flag.')) f.flags.push({ key: arg.key.slice(5), path: [...at, 'key'] })
      else for (const s of numKeys.match(arg.key)?.slots ?? []) slot(s, [...at, 'key'])
    } else {
      if (key === 'trait_hook' && typeof arg === 'string') f.hooks.push({ name: arg, path: at })
      const params = conditions.get(key)?.params
      if (params) walk(params, arg, at)
    }
  }

  const walkModifier = (m: Obj, path: Path) => {
    const hit = typeof m.target === 'string' ? modifierTargets.match(m.target) : undefined
    if (!hit) return
    const at = [...path, 'target']
    for (const s of hit.slots) slot(s, at)
    const special = hit.slots.find((s) => s.slot === 'special')
    const param = hit.slots.find((s) => s.slot === 'param')
    if (special && param) f.specials.push({ special: special.value, param: param.value, path: at })
    if (hit.meta.ref && typeof m.value === 'string') f.refs.push({ kind: hit.meta.ref, id: m.value, path: [...path, 'value'] })
  }

  const walkUnion = (def: Obj, v: unknown, path: Path) => {
    const options = def.options as z.ZodType[]
    // 장소 자리(ID 또는 바인딩)의 {변수}
    const name = typeof v === 'string' ? bindingName(v) : undefined
    if (name && options.some((o) => refKindOf(o) === 'region')) return void f.bindings.push({ name, path })
    const disc = def.discriminator as string | undefined
    const pick = disc && isObject(v)
      ? options.find((o) => zodOf(o).propValues?.[disc]?.has(v[disc]))
      : options.find((o) => o.safeParse(v).success)
    if (pick) walk(pick, v, path)
  }

  const walk = (s: z.ZodType, v: unknown, path: Path): void => {
    if (s === condition) return walkCondition(v, path)
    // 효과는 type으로 등록부의 파라미터 스키마를 찾아 들어간다
    if (s === effect) {
      if (!isObject(v)) return
      f.effects.push({ value: v, path })
      const params = typeof v.type === 'string' ? effects.get(v.type)?.params : undefined
      if (params) walk(params, v, path)
      return
    }
    if (s === checkSchema && isObject(v)) f.checks.push({ value: v, path })
    if (s === modifier && isObject(v)) walkModifier(v, path)

    const kind = refKindOf(s)
    if (kind) {
      if (typeof v !== 'string') return
      if (kind === 'flag') f.flags.push({ key: v, path })
      else f.refs.push({ kind, id: v, path })
      return
    }
    const tpl = templateRegistry.get(s)
    if (tpl) {
      if (typeof v === 'string') f.templates.push({ text: v, line: tpl.line === true, path })
      return
    }

    const z = zodOf(s)
    const def = z.def
    switch (def.type) {
      case 'optional':
      case 'nullable':
        if (v !== undefined && v !== null) walk(def.innerType as z.ZodType, v, path)
        return
      case 'default':
        // 기본값도 참조일 수 있다(발견 지점 check = pathfinding)
        walk(def.innerType as z.ZodType, v === undefined ? def.defaultValue : v, path)
        return
      case 'lazy':
        walk(z.innerType!, v, path)
        return
      case 'pipe':
        walk(def.out as z.ZodType, v, path)
        return
      case 'object':
        if (isObject(v)) for (const [k, sub] of Object.entries(def.shape as Record<string, z.ZodType>)) walk(sub, v[k], [...path, k])
        return
      case 'array':
        if (Array.isArray(v)) v.forEach((x, i) => walk(def.element as z.ZodType, x, [...path, i]))
        return
      case 'tuple':
        if (Array.isArray(v)) (def.items as z.ZodType[]).forEach((item, i) => walk(item, v[i], [...path, i]))
        return
      case 'record': {
        if (!isObject(v)) return
        // record는 키 스키마의 참조 종류도 모은다(starting_kit.consumables의 키 등)
        const keyKind = refKindOf(def.keyType as z.ZodType)
        for (const [k, x] of Object.entries(v)) {
          if (NOTE_KEYS.has(k) && typeof x === 'string') continue
          if (keyKind) f.refs.push({ kind: keyKind, id: k, path: [...path, k] })
          walk(def.valueType as z.ZodType, x, [...path, k])
        }
        return
      }
      case 'union':
        return walkUnion(def, v, path)
    }
  }

  walk(schema, value, [])
  return f
}
