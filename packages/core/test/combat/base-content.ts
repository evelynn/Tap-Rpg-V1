// 기반 팩(content/base)을 읽어 Content를 만드는 테스트 도우미. 패치·검증은 하지 않는다(content:check 몫).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONTENT_KINDS, CONTENT_KIND_NAMES, Content, World, createItemInstance, maxHp, type RawDefs, type Rng } from '../../src/index'
import { APPEARANCE, SEED } from '../fixture'

const baseDir = fileURLToPath(new URL('../../../../content/base', import.meta.url))

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).sort().flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? jsonFiles(p) : n.endsWith('.json') ? [p] : []
  })
}

let cached: Content | undefined

export function baseContent(): Content {
  if (cached) return cached
  const defs: RawDefs = {}
  for (const kind of CONTENT_KIND_NAMES) {
    const spec = CONTENT_KINDS[kind] as { dir?: string; file?: string }
    const files = spec.dir ? jsonFiles(join(baseDir, spec.dir)) : [join(baseDir, spec.file!)]
    const byId: Record<string, unknown> = {}
    for (const f of files) {
      const v = JSON.parse(readFileSync(f, 'utf8')) as unknown
      for (const d of Array.isArray(v) ? v : [v]) byId[(d as { id: string }).id] = d
    }
    defs[kind] = byId
  }
  // 01 부록 A의 "동급 적": 특수능력 없는 일반 적. 레벨을 바꾸면 enemy_formula로 다시 계산된다
  defs.enemy!.ZZ_PLAIN = { ...(defs.enemy!.EN01 as object), id: 'ZZ_PLAIN', specials: [] }
  cached = new Content(defs)
  return cached
}

// 01 §2.4 기준 인물: 주능력치(힘) 3 + 성장, 근접 단계, 레벨 기준 단계 일반 장비, 민첩 2. 특성 없음
export function referenceWorld(level: number, opts: { grade?: 'common' | 'good' | 'rare'; seed?: string; dex?: number } = {}): World {
  const content = baseContent()
  const w = World.create(content, {
    familyName: '조약돌', familySeed: opts.seed ?? SEED, foundedUtc: 1789500000000,
    character: { name: '모라', background: 'bg_river', birthSeason: 'spring', appearance: APPEARANCE },
  })
  const ch = w.state.character!
  const ref = content.balance.reference_character
  ch.traits = []
  ch.level = level
  ch.stats = { str: ref.main_stat_start + ref.stat_up_levels.filter((l) => l <= level).length, dex: opts.dex ?? 2, kno: 2, wil: 2, soc: 1, luk: 1 }
  ch.skills.melee.rank = ref.melee_rank_levels.filter((l) => l <= level).length
  const tier = content.balance.economy.tier_levels.findIndex(([lo, hi]) => level >= lo && level <= hi) + 1
  const WEAPONS = ['W02', 'W04', 'W06', 'W08', 'W09']
  const ARMORS = ['A02', 'A03', 'A05', 'A06', 'A07']
  equipDef(w, WEAPONS[tier - 1]!, opts.grade ?? 'common')
  equipDef(w, ARMORS[tier - 1]!, opts.grade ?? 'common')
  ch.hp = maxHp(w)
  return w
}

// 전투용 고정 난수: 목록을 앞에서부터 쓰고 떨어지면 기본값(주사위 10, 피해 최소, 확률 거짓)
export function fakeRng(script: { d20?: number[]; int?: number[]; chance?: boolean[]; index?: number[] } = {}): Rng {
  const d20 = [...(script.d20 ?? [])]
  const int = [...(script.int ?? [])]
  const chance = [...(script.chance ?? [])]
  const index = [...(script.index ?? [])]
  return {
    nextU32: () => 0,
    bounded: (n) => Math.min(n - 1, index.shift() ?? 0),
    int: (min, max) => Math.min(max, int.shift() ?? min),
    d20: () => d20.shift() ?? 10,
    chance: () => chance.shift() ?? false,
    weightedIndex: () => index.shift() ?? 0,
    pick: (items) => items[Math.min(items.length - 1, index.shift() ?? 0)]!,
  }
}

// 고정 난수를 쓰는 전투 문맥(resolveCombat·resolveDefeat가 받는 모양)
export function fakeWorld(w: World, rng: Rng): World {
  return { content: w.content, state: w.state, test: w.test, rng: { combat: rng, life: rng, loot: rng } } as unknown as World
}

export function equipDef(w: World, defId: string, grade: 'common' | 'good' | 'rare' = 'common'): string {
  const ch = w.state.character!
  const inst = createItemInstance(w.content, w.state, defId, grade, { gen: 1, char_uid: ch.uid, age: 18, location: 'T00', source: 'test' })
  w.state.inventory.equipped[w.content.get('item', defId).slot] = inst.uid
  return inst.uid
}
