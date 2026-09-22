// T6 테스트 픽스처: 기반 팩(content/base)을 읽어 Content를 만든다. 설계 문서 계산 예시를 실제 데이터로 검산한다.
import { fileURLToPath } from 'node:url'
import { readPackFiles } from '../../../content-kit/src/pack/read'
import { Content, World, createItemInstance, type Condition, type RawDefs } from '../../src/index'

const baseDir = fileURLToPath(new URL('../../../../content/base', import.meta.url))

let cached: Content | undefined
export function baseContent(): Content {
  if (cached) return cached
  const defs: Record<string, Record<string, unknown>> = {}
  for (const d of readPackFiles(baseDir, 'base').defs) (defs[d.kind] ??= {})[d.id] = d.value
  cached = new Content(defs as RawDefs)
  return cached
}

// 테스트용 조건 평가기: 경제 규칙이 쓰는 단말만 안다. flags로 첫 출정 등 문맥 조건을 켠다
export function makeTest(world: () => World, flags: Record<string, boolean> = {}) {
  const test = (cond: Condition): boolean => {
    if (typeof cond === 'boolean') return cond
    const c = cond as Record<string, any>
    const w = world()
    const ch = w.state.character!
    if ('all' in c) return (c.all as Condition[]).every(test)
    if ('any' in c) return (c.any as Condition[]).some(test)
    if ('not' in c) return !test(c.not)
    if ('attitude' in c) return (c.attitude as string[]).includes(w.state.policies.attitude)
    if ('specialization' in c) return (c.specialization as string[]).includes(ch.specialization)
    if ('has_trait' in c) return ch.traits.some((t) => t.id === c.has_trait)
    if ('mutation' in c) return (ch.mutation ? 'vampire' : 'none') === c.mutation
    if ('policy' in c) return (w.state.policies as any)[c.policy.key] === c.policy.value
    if ('num' in c) return false
    const key = Object.keys(c)[0]!
    if (key in flags) return flags[key] === c[key]
    throw new Error(`테스트 평가기가 모르는 조건: ${key}`)
  }
  return test
}

export function baseWorld(opts: { attitude?: string; flags?: Record<string, boolean> } = {}): World {
  let w: World
  w = World.create(baseContent(), {
    familyName: '조약돌', familySeed: '9e3779b97f4a7c15', foundedUtc: 1789500000000,
    character: {
      name: '모라', background: 'bg_river', birthSeason: 'spring',
      appearance: { body: 'body_base', hair: 'HR03', hair_color: 'hair_chestnut', skin_tone: 'skin_02', decor: [], age_stage_override: null },
    },
  }, { test: makeTest(() => w, opts.flags) })
  w.state.character!.traits = []
  if (opts.attitude) w.state.policies.attitude = opts.attitude
  return w
}

export function give(world: World, defId: string, grade?: 'common' | 'good' | 'rare' | 'legendary', effects?: string[]): string {
  const ch = world.state.character!
  const inst = createItemInstance(world.content, world.state, defId, grade, {
    gen: 1, char_uid: ch.uid, age: 18, location: 'T00', source: 'test', // id-lint-allow
  })
  if (effects) inst.effects = effects
  return inst.uid
}

export function equipNew(world: World, defId: string, grade?: 'common' | 'good' | 'rare' | 'legendary', effects?: string[]): string {
  const uid = give(world, defId, grade, effects)
  world.state.inventory.equipped[world.content.get('item', defId).slot] = uid
  return uid
}
