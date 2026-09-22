// T4b 테스트용 작은 콘텐츠 번들: balance는 5.1 예시 픽스처, 나머지는 01·06·08·12 값을 옮긴 최소 정의.
import { readFileSync } from 'node:fs'
import { Content, World, createItemInstance, type RawDefs, type WorldOptions } from '../src/index'

export const balanceJson = () =>
  JSON.parse(readFileSync(new URL('./schema/world/fixtures/balance.json', import.meta.url), 'utf8')) as Record<string, unknown>

const lines = ['{name:이/가} 한 번 더 살폈다.', '오늘도 무사히 지나갔다.']
const innate = (id: string, name: string, short: string, subkind: string, w: number, stats: string[], modifiers: unknown[] = []) => ({
  id, name, short_name: short, kind: 'innate', subkind, inheritable: true,
  inherit_class: subkind === 'negative' ? 'negative' : 'positive',
  modifiers, lines, birth_weight: w, birth_stat_weights: stats,
})

// 06 §6.3 가중치, 05 §2.2 가중 능력치
export const TRAITS = {
  TI01: innate('TI01', '튼튼한 체질', '튼튼함', 'constitution', 14, ['str', 'wil'], [
    { target: 'hp_max_mult', op: 'add', value: 0.10 },
    { target: 'check.injury', op: 'add', value: 2 },
  ]),
  TI02: innate('TI02', '예민한 귀', '예민한 귀', 'constitution', 12, ['kno'], [
    { target: 'check.trap_detect', op: 'add', value: 2 },
    { target: 'check.ambush', op: 'add', value: 2 },
  ]),
  TI03: innate('TI03', '길눈이 밝음', '길눈', 'talent', 14, ['dex'], [
    { target: 'check.pathfinding', op: 'add', value: 1 },
    { target: 'check.terrain', op: 'add', value: 1 },
  ]),
  TI04: innate('TI04', '손재주', '손재주', 'talent', 12, ['dex', 'kno'], [{ target: 'check.trap_disarm', op: 'add', value: 2 }]),
  TI05: innate('TI05', '약한 폐', '약한 폐', 'negative', 8, ['kno']),
  TI06: innate('TI06', '호기심 많음', '호기심', 'temperament', 14, ['kno', 'luk']),
  TI07: innate('TI07', '겁이 많음', '겁', 'temperament', 12, ['dex'], [
    { target: 'check.fear', op: 'add', value: -2 },
    { target: 'check.ambush', op: 'add', value: 1 },
  ]),
  TI08: innate('TI08', '대식가', '대식가', 'constitution', 14, ['str', 'soc']),
  // 한 특성 보정 상한(±2) 시험용
  TX99: {
    id: 'TX99', name: '과장된 특성', kind: 'acquired', subkind: 'story', acquired_class: 'unique', inheritable: false,
    acquire: { type: 'condition', condition: true },
    modifiers: [{ target: 'check.all', op: 'add', value: 4 }], lines,
  },
}

// 12 §8.1
const bg = (id: string, name: string, start_skill: string | null, fixed_stat: string | null, unlock: unknown = null) => ({
  id, name, start_skill, fixed_stat, unlock, intro_line: '자랐다.',
})
export const BACKGROUNDS = {
  bg_river: bg('bg_river', '여울의 아이', null, null),
  bg_inn: bg('bg_inn', '여관집 아이', 'negotiation', 'soc'),
  bg_smithy: bg('bg_smithy', '대장간 도제', 'melee', 'str'),
  bg_guild: bg('bg_guild', '길드 사환', 'search', 'kno'),
  bg_miner: bg('bg_miner', '광부 집안', 'survival', 'wil', { achievement: 'AC06' }),
}

const item = (id: string, name: string, slot: string, tier: number, extra: Record<string, unknown> = {}) => ({
  id, name, slot, tier, grade_mode: 'rolled', unique: false, cursed: false,
  sources: [{ kind: 'shop' }], sellable: true, visual_group: 'V', story_template: '샀다.', description: '장비',
  ...(slot === 'weapon' ? { stat: 'str' } : {}),
  ...extra,
})
export const ITEMS = {
  W01: item('W01', '녹슨 검', 'weapon', 1, { grade_mode: 'fixed', fixed_grade: 'common', base: { damage: [1, 4] }, sources: [{ kind: 'start' }] }),
  A01: item('A01', '누빈 천옷', 'armor', 1, { grade_mode: 'fixed', fixed_grade: 'common', base: { ac: 0 }, sources: [{ kind: 'start' }] }),
  W02: item('W02', '여울 대장간 한손검', 'weapon', 1),
  W06: item('W06', '늑대송곳니 창', 'weapon', 3, { stat: 'best_of_str_dex', modifiers: [{ target: 'hit_vs.wolf', op: 'add', value: 2 }] }),
  J03: item('J03', '매의 깃 장식', 'accessory', 2, { modifiers: [{ target: 'check.skill.search', op: 'add', value: 1 }] }),
  J05: item('J05', '속삭이는 종 조각', 'accessory', 4, { modifiers: [{ target: 'check.skill.search', op: 'add', value: 3 }] }),
  // 단계별 방어구(01 §9.3 기본 성능)
  AT1: item('AT1', '가죽조끼', 'armor', 1),
  AT2: item('AT2', '가죽갑옷', 'armor', 2),
  AT3: item('AT3', '망토옷', 'armor', 3),
  AT4: item('AT4', '조각갑', 'armor', 4),
  AT5: item('AT5', '흉갑', 'armor', 5),
  WT1: item('WT1', '한손검', 'weapon', 1),
  WT2: item('WT2', '장검', 'weapon', 2),
  WT3: item('WT3', '창', 'weapon', 3),
  WT4: item('WT4', '광맥 장검', 'weapon', 4),
  WT5: item('WT5', '종탑 강철검', 'weapon', 5),
}

export const REGIONS = {
  T00: { id: 'T00', name: '도토리 여울', kind: 'town', unlock: true, background_id: 'bg_town',
    facilities: [{ id: 'smithy', name: '대장간', npc_id: 'N01' }] },
  H1: { id: 'H1', name: '여울가 풀밭', kind: 'hunting_ground', unlock: true, background_id: 'bg_field',
    level_range: [1, 3], level_mid: 2, travel_sec: 20, rescuers: 'field',
    encounters: [{ enemy_id: 'EN01', weight: 1 }], pair_chance: 0.1, event_check: 0.1 },
  D1: { id: 'D1', name: '폐광 1층', kind: 'hunting_ground', unlock: true, background_id: 'bg_mine', weather_exempt: true,
    level_range: [6, 11], level_mid: 8, travel_sec: 60, rescuers: 'dungeon',
    encounters: [{ enemy_id: 'EN07', weight: 1 }], pair_chance: 0.25, event_check: 0.1 },
}

export const GUILD_RANKS = {
  silver: { id: 'silver', name: '은패', order: 2, condition: true, grants_text: '은' },
  apprentice: { id: 'apprentice', name: '견습', order: 0, condition: true, grants_text: '견습' },
}

export function rawDefs(over: RawDefs = {}): RawDefs {
  return {
    balance: { balance: balanceJson() },
    trait: TRAITS,
    background: BACKGROUNDS,
    item: ITEMS,
    region: REGIONS,
    guild_rank: GUILD_RANKS,
    ...over,
  }
}

export const makeContent = (over: RawDefs = {}) => new Content(rawDefs(over))

export const APPEARANCE = { body: 'body_base', hair: 'HR03', hair_color: 'hair_chestnut', skin_tone: 'skin_02', decor: [], age_stage_override: null }

export const SEED = '9e3779b97f4a7c15'

export function makeWorld(content = makeContent(), opts: WorldOptions = {}, seed = SEED, background = 'bg_river'): World {
  return World.create(content, {
    familyName: '조약돌', familySeed: seed, foundedUtc: 1789500000000,
    character: { name: '모라', background, birthSeason: 'spring', appearance: APPEARANCE },
  }, opts)
}

// 장비를 만들어 그 슬롯에 장착한다(기존 장착은 버린다)
export function equip(world: World, defId: string, grade?: 'common' | 'good' | 'rare' | 'legendary'): string {
  const ch = world.state.character!
  const inst = createItemInstance(world.content, world.state, defId, grade, {
    gen: 1, char_uid: ch.uid, age: 18, location: 'T00', source: 'test',
  })
  world.state.inventory.equipped[world.content.get('item', defId).slot] = inst.uid
  return inst.uid
}

// 인물 능력치를 한 번에 덮어쓴다
export function setStats(world: World, v: Partial<Record<'str' | 'dex' | 'kno' | 'wil' | 'soc' | 'luk', number>>): void {
  Object.assign(world.state.character!.stats, v)
}

export function setTraits(world: World, ids: string[]): void {
  world.state.character!.traits = ids.map((id) => ({ id, since_age: 18, source: 'new' as const }))
}

// 원하는 색인이 나오도록 u32를 고른다(weightedPick의 역). 나머지 호출은 막는다
// weights = 그 추첨에 넘어갈 가중치(테스트가 기대값으로 적는다), index = 뽑힐 색인
export function scriptedRng(picks: { weights: number[]; index: number }[], d20s: number[] = []) {
  let i = 0
  let j = 0
  const fail = (): never => {
    throw new Error('scriptedRng: 예정에 없던 호출')
  }
  return {
    nextU32(): number {
      const p = picks[i++] ?? fail()
      const total = p.weights.reduce((a, b) => a + b, 0)
      const before = p.weights.slice(0, p.index).reduce((a, b) => a + b, 0)
      return Math.floor(((before + p.weights[p.index]! / 2) / total) * 0x100000000)
    },
    d20(): number {
      const v = d20s[j++]
      return v ?? fail()
    },
    bounded: fail,
    int: fail,
    chance: fail,
    weightedIndex: fail,
    pick: fail,
  }
}
