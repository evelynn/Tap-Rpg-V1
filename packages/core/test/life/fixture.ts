// T10 테스트 픽스처: 기반 팩(content/base)과 실제 조건 평가기를 쓰는 World를 만든다.
// life·succession은 아직 src/index.ts에 실리지 않아(통합자 몫) 폴더에서 바로 가져온다.
import { fileURLToPath } from 'node:url'
import { readPackFiles } from '../../../content-kit/src/pack/read'
import { Content, World, emptyScope, makeConditionTest, type Condition, type RawDefs, type WorldOptions } from '../../src/index'
import { successionPorts } from '../../src/succession/index'
import { APPEARANCE, SEED } from '../fixture'

const baseDir = fileURLToPath(new URL('../../../../content/base', import.meta.url))

let cached: Content | undefined
export function baseContent(): Content {
  if (cached) return cached
  const defs: Record<string, Record<string, unknown>> = {}
  for (const d of readPackFiles(baseDir, 'base').defs) (defs[d.kind] ??= {})[d.id] = d.value
  cached = new Content(defs as RawDefs)
  return cached
}

export interface LifeWorldOptions extends WorldOptions {
  seed?: string
  name?: string
  background?: string
}

// 조건 평가기와 생애 포트를 갖춘 World(사건 엔진이 쓰는 것과 같은 평가기)
export function lifeWorld(opts: LifeWorldOptions = {}): World {
  const content = baseContent()
  let world: World | undefined
  const test = (cond: Condition): boolean => makeConditionTest(world!, emptyScope(world!.state.character?.location ?? null))(cond)
  world = World.create(content, {
    familyName: '조약돌',
    familySeed: opts.seed ?? SEED,
    foundedUtc: 1789500000000,
    character: { name: opts.name ?? '모라', background: opts.background ?? 'bg_river', birthSeason: 'spring', appearance: APPEARANCE },
  }, { ...opts, test, ports: { ...successionPorts(), ...opts.ports } })
  return world
}

// 나이를 바로 옮긴다(행동 해석기 없이). 노화 이정표는 부르는 쪽이 applyAging으로 적용한다
export function setAge(w: World, age: number): void {
  const t = w.content.balance.time
  w.state.character!.eff_min = (age - t.start_age) * t.min_per_year
}
