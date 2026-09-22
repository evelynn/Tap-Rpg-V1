import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { enemyStats, registerTextSlot, type ContentKind } from '../../src/core'
import { buildIndex } from '../../src/pack/index-defs'
import type { RawDef } from '../../src/pack/read'
import { KIND_SCHEMAS } from '../../src/validate/kind-schemas'
import { runSemanticChecks } from '../../src/validate/rules'

// 코어가 부르는 문형 id 예(V2 텍스트 슬롯). 첫 검사 때 잠기므로 먼저 등록한다
registerTextSlot('journal.test.slot')

type Obj = Record<string, unknown>

// 정의 하나. balance 밖은 실제 종류 스키마를 통과해야 한다(규칙은 S01을 통과한 데이터만 본다)
function def(kind: ContentKind, value: Obj): RawDef {
  if (kind !== 'balance') {
    const r = KIND_SCHEMAS[kind].safeParse(value)
    assert.ok(r.success, `${kind} ${String(value.id)}: ${r.error?.message}`)
  }
  return { kind, id: String(value.id), value, pack: 't', file: `${kind}/${String(value.id)}.json`, pointer: '' }
}

// 결과를 "코드 파일#포인터"로. codes를 주면 그 코드만
function run(defs: RawDef[], ...codes: string[]): string[] {
  return runSemanticChecks(buildIndex(defs).index)
    .filter((i) => codes.length === 0 || codes.includes(i.code))
    .map((i) => `${i.severity === 'warn' ? 'warn ' : ''}${i.code} ${i.file}#${i.pointer}`)
}

const FORMULA = {
  normal: {
    hp: { base: 8, per_level: 2.3 }, ac: { base: 10, div: 3 }, hit: { base: 2, div: 3 },
    dmg_min: { base: 1, div: 6 }, dmg_max: { base: 2, div: 2.5 },
    xp: { base: 6, per_level: 3 }, coins: { base: 3, per_level: 1.5, growth: 1.08 },
  },
  elite: { hp_mult: 2.5, ac_add: 0, hit_add: 2, dmg_mult: 1.3, xp_mult: 2.5, coins_mult: 2.5 },
  boss: { hp_mult: 5, ac_add: 2, hit_add: 3, dmg_mult: 1.5, xp_mult: 10, coins_mult: 10 },
  rounding: { base: 'round', hp_mult: 'round', dmg_mult: 'ceil', xp_coins_mult: 'floor' },
} as const

// 규칙이 읽는 필드만 둔 balance(5.1 값)
const BALANCE = def('balance', {
  id: 'balance',
  ui: { line_max: 28, name_len: [1, 6], family_name_len: [2, 8] },
  check_kinds: {
    _comment: '설명 키는 이름공간이 아니다',
    forage: { partial: true, dc: { kind: 'region' } },
    ambush: { partial: false, dc: { kind: 'region' } },
    haggle: { partial: true, dc: { kind: 'fixed', value: 12 } },
    persuade: { partial: true, dc: { kind: 'event' } },
    flee: { partial: false, dc: { kind: 'level_formula', base: 10, div: 2, source: 'max_enemy_level' } },
    attack_event: { partial: false, partial_event_defined: true, dc: { kind: 'event' } },
    pathfinding: { partial: false, dc: { kind: 'region' } },
  },
  economy: { tier_levels: [[1, 5], [6, 11]], drops: {}, carry_limits: { potion: 4 } },
  defeat: { rescuers: { field: [] }, rescuer_lines: {} },
  enemy_formula: FORMULA,
  first_sortie: { guaranteed_event: { event: 'L01', choice: 'go' } },
})

const choice = (id: string, over: Obj = {}): Obj => ({
  id, label: id, short: '갔다', tags: ['safe'], risk: 'none', outcomes: { always: { effects: [] } }, ...over,
})
const event = (id: string, over: Obj = {}) =>
  def('event', {
    id, name: id, category: 'life', triggers: ['town_return'], condition: true, weight: 5,
    allow_serious_injury: false, hold: 'none', intro: { lines: ['첫 줄', '둘째 줄'], tag: 'town' },
    choices: [choice('go')], ...over,
  })
const enemy = (id: string, over: Obj = {}) =>
  def('enemy', {
    id, name: '여울 들쥐', family: 'rat', level: 1, rank: 'normal', hp: 10, ac: 10, hit: 2, damage: [1, 2], xp: 9,
    coins: 5, specials: [], sprite_family: 'rat', palette_id: 'p', lines: ['가', '나', '다'], victory_lines: ['가', '나'],
    exit_line: '달아났다', ...over,
  })
const hunt = (id: string, over: Obj = {}) =>
  def('region', {
    id, name: '여울 들판', kind: 'hunting_ground', level_range: [1, 5], level_mid: 3, travel_sec: 20, unlock: true,
    rescuers: 'field', background_id: 'bg', encounters: [{ enemy_id: 'EN01', weight: 1 }], pair_chance: 0.1,
    event_check: 0.2, ...over,
  })
const town = (id: string, facility = 'inn') =>
  def('region', {
    id, name: '여울 마을', kind: 'town', unlock: true, background_id: 'bg',
    facilities: [{ id: facility, name: '여관', npc_id: 'N01' }],
  })
const item = (id: string, over: Obj = {}) =>
  def('item', {
    id, name: '누비옷', slot: 'armor', tier: 1, grade_mode: 'rolled', unique: false, cursed: false, sources: [],
    sellable: true, visual_group: 'cloth', story_template: '{name:이/가} 입던 옷', description: '천 옷', ...over,
  })
const chain = (id: string, stages: number) =>
  def('chain', {
    id, name: '광부의 지도', stages, outcomes: ['rescue'], family_once: true, inheritable: true, resume_at: [],
    unfinished_line: '끝나지 않은 이야기 — {chain_name}', stage_summaries: Array(stages).fill('단계'),
  })
const effects = (...list: Obj[]) => ({ outcomes: { always: { effects: list } } })

// 기본 세계: 참조가 모두 풀리는 최소 묶음
const WORLD = [
  BALANCE,
  def('enemy_family', { id: 'rat', name: '들쥐', sprite_family: 'rat' }),
  enemy('EN01'),
  hunt('H1'),
  town('T00'),
  def('npc', { id: 'N01', name: '세나', role: '여관 주인', home: 'T00', speech: { style: '다정', samples: [] }, events: [], relation_default: 0 }),
  event('L01'),
  def('text', { id: 'journal.test.slot', variants: ['{name:이/가} 쉬었다'] }),
  def('flag', { id: 'life.l01_marked_{place}', scope: 'life', value: 'bool', family: { place: 'region' }, set_by: 'L01', read_by: 'L01' }),
]

describe('runSemanticChecks — 기본 세계', () => {
  it('참조가 모두 풀리면 이슈가 없다', () => {
    assert.deepEqual(run(WORLD), [])
  })
})

describe('V2 참조 무결성', () => {
  it('없는 정의·중첩 이름공간·record 키 참조', () => {
    const r = run([
      ...WORLD,
      hunt('H2', {
        encounters: [{ enemy_id: 'EN01', weight: 1 }, { enemy_id: 'EN99', weight: 1 }],
        unlock: { any: [{ discovery_found: 'A1-9' }, { visited: 'H1' }] },
        rescuers: 'dungeon',
      }),
      item('A01', { modifiers: [{ target: 'check.nope', op: 'add', value: 1 }, { target: 'check.forage', op: 'add', value: 1 }] }),
      def('attitude', ATTITUDE),
    ])
    assert.deepEqual(r, [
      'V2 region/H2.json#/unlock/any/0/discovery_found',
      'V2 region/H2.json#/rescuers',
      'V2 region/H2.json#/encounters/1/enemy_id',
      'V2 item/A01.json#/modifiers/0/target',
      'V2 attitude/stable.json#/buy_targets/ration',
    ])
  })

  it('발견 지점 check 기본값(pathfinding)도 참조로 본다', () => {
    const route = def('region', {
      id: 'A1', name: '여울 들길', kind: 'adventure_route', level_range: [1, 8], level_mid: 4, travel_sec: 25, unlock: true,
      rescuers: 'field', background_id: 'bg', scenes: [3, 5], scene_weights: { path: 1 },
      encounters: [{ enemy_id: 'EN01', weight: 1 }], pair_chance: 0.1,
      discoveries: [{ id: 'A1-1', name: '둑', dc: { grade: 'easy' } }], map_fragments: [],
    })
    assert.deepEqual(run([...WORLD, route]), [])
    const noPathfinding = def('balance', { ...BALANCE.value, check_kinds: { forage: { partial: true, dc: { kind: 'region' } } } })
    assert.deepEqual(run([...WORLD.slice(1), noPathfinding, route], 'V2'), ['V2 region/A1.json#/discoveries/0/check'])
  })

  it('던전 group마다 depth 1..n이 빈틈·중복 없이 이어진다', () => {
    const floor = (id: string, group: string, depth: number) =>
      def('region', {
        id, name: id, kind: 'dungeon_floor', level_range: [6, 11], level_mid: 8, travel_sec: 40, unlock: true,
        rescuers: 'field', background_id: 'bg', dungeon: { group, depth }, encounters: [{ enemy_id: 'EN01', weight: 1 }],
        pair_chance: 0.25, rooms: [4, 6], room_weights: { combat: 1 }, trap_table: [{ trap_id: 'trap_spike', weight: 1 }],
        treasure_table: { chest: 70, vein: 30 },
        gate: { enemy_id: 'EN01', lethal: false, remnant: { enemy_id: 'EN01' }, lines: { turn_back: '돌아섰다' } },
      })
    const trap = def('trap', {
      id: 'trap_spike', name: '가시 발판', detect_dc_offset: 0, evade: { check: 'forage', dc_offset: 0 }, disarm_dc_offset: 4,
      fail: [{ type: 'damage', hp_ratio: 0.1 }], lines: { detect: '가', disarm: '나', evade: '다', fail: '라' },
    })
    const ok = [floor('D1', 'mine', 1), floor('D2', 'mine', 2), floor('X1', 'cave', 1)]
    assert.deepEqual(run([...WORLD, trap, ...ok]), [])
    const bad = [floor('D1', 'mine', 1), floor('D3', 'mine', 3), floor('X1', 'cave', 1), floor('X2', 'cave', 1)]
    assert.deepEqual(run([...WORLD, trap, ...bad]), [
      'V2 region/D1.json#/dungeon/depth',
      'V2 region/X2.json#/dungeon/depth',
    ])
  })

  it('코어가 부르는 문형 id와 첫 출정 보장 사건 선택지', () => {
    const r = run([...WORLD.filter((d) => d.kind !== 'text' && d.id !== 'L01'), event('L01', { choices: [choice('rest')] })])
    assert.deepEqual(r, ['V2 #', 'V2 balance/balance.json#/first_sortie/guaranteed_event/choice'])
  })
})

describe('V1 중첩 이름공간 중복', () => {
  it('두 마을이 같은 시설 id를 쓰면 오류', () => {
    assert.deepEqual(run([...WORLD, town('T01', 'inn')], 'V1'), ['V1 region/T01.json#/facilities/0/id'])
  })
})

describe('V19 플래그 키와 바인딩', () => {
  const flagCond = (key: string) => ({ condition: { flag: key } })
  it('등록표 고정 키·키 묶음·파생 키', () => {
    const r = run([
      ...WORLD,
      chain('C01', 1),
      event('C01-1', { category: 'chain', chain: { id: 'C01', stage: 1 }, ...flagCond('life.l01_marked_H1') }),
      event('L02', flagCond('life.l01_marked_H9')),
      event('L03', flagCond('life.nobody_knows')),
      event('L04', { condition: { num: { key: 'flag.life.c01_stage', op: '>=', value: 1 } } }),
      event('L05', flagCond('life.l01_marked_{place}')),
    ])
    assert.deepEqual(r, ['V2 event/L02.json#/condition/flag', 'V19 event/L03.json#/condition/flag'])
  })

  it('바인딩은 {place} 또는 그 사건 context_vars 변수', () => {
    const cv = { context_vars: [{ var: 'rumor_place', selector: 'rumor_place', params: { chain_next_chance: 0.5 } }] }
    const set = (key: string) => choice('go', effects({ type: 'set_flag', key }))
    const r = run([
      ...WORLD,
      event('L02', { ...cv, choices: [set('life.l01_marked_{rumor_place}')] }),
      event('L03', { choices: [set('life.l01_marked_{rumor_place}')] }),
      event('L04', { choices: [choice('go', effects({ type: 'temp_mod', modifier: { target: 'hit', op: 'add', value: 1 }, scope: 'next_visit', location: '{target_place}' }))] }),
      item('A01', { modifiers: [{ target: 'location_score.{rumor_place}', op: 'add', value: 1 }, { target: 'location_score.{place}', op: 'add', value: 1 }] }),
    ])
    assert.deepEqual(r, [
      'V19 event/L03.json#/choices/0/outcomes/always/effects/0/key',
      'V19 event/L04.json#/choices/0/outcomes/always/effects/0/location',
      'V19 item/A01.json#/modifiers/0/target',
    ])
  })

  it('줄기 파생 키를 등록표에 다시 적으면 경고', () => {
    const dup = def('flag', { id: 'fam.c01_done', scope: 'fam', value: 'bool', set_by: 'C01', read_by: 'C01' })
    assert.deepEqual(run([...WORLD, chain('C01', 1), event('C01-1', { category: 'chain', chain: { id: 'C01', stage: 1 } }), dup]), [
      'warn V19 flag/fam.c01_done.json#/id',
    ])
  })
})

describe('V5 템플릿 변수', () => {
  it('조사 쌍은 스키마가 렌더러 파서로 거른다(V5)', () => {
    const r = KIND_SCHEMAS.item.safeParse({ ...item('A02').value, story_template: '{item:은/가} 낡았다' }) // 은/는이 맞다
    assert.deepEqual(r.success ? [] : r.error.issues.map((i) => (i as { params?: { rule?: string } }).params?.rule), ['V5'])
  })

  it('등록되지 않은 변수·사건 변수·사건 변수 파라미터', () => {
    const r = run([
      ...WORLD,
      item('A01', { story_template: '{name:이/가} {foo}를 {friend}에게 받았다' }),
      event('L02', {
        context_vars: [{ var: 'friend', selector: 'random_friend_name' }],
        intro: { lines: ['{friend:과/와} 만났다', '반가웠다'], tag: 'bond' },
        choices: [choice('go', effects({ type: 'set_destination', place_var: 'target_place', scope: 'next_sortie' }))],
      }),
    ])
    assert.deepEqual(r, [
      'V5 event/L02.json#/choices/0/outcomes/always/effects/0/place_var',
      'V5 item/A01.json#/story_template',
      'V5 item/A01.json#/story_template',
    ])
  })

  it('context_vars의 place_var는 앞 항목 변수', () => {
    const cv = (order: Obj[]) => event('L06', { context_vars: order })
    const place = { var: 'target_place', selector: 'best_hunting_ground', params: { max_risk: 'normal' } }
    const foe = { var: 'enemy', selector: 'main_enemy_of', params: { place_var: 'target_place' } }
    assert.deepEqual(run([...WORLD, cv([place, foe])]), [])
    assert.deepEqual(run([...WORLD, cv([foe, place])]), ['V5 event/L06.json#/context_vars/0/params/place_var'])
  })
})

describe('V6 한 줄 길이', () => {
  it('가장 긴 대입(이름 6자·번들의 가장 긴 장소 이름)으로 상한을 본다', () => {
    const line = (text: string) => ({ intro: { lines: [text, '짧다'], tag: 'hunt' } })
    const r = run([
      ...WORLD,
      hunt('H2', { name: '아주아주 길고 긴 이름의 사냥터' }),
      event('L02', line('{name:이/가} {place:으로/로} 떠났다')),
      event('L03', line('{name:이/가} 들판에서 한참 쉬었다')),
      def('text', { id: 'journal.test.long', variants: ['{name:이/가} {place:으로/로} 떠났다'], max_len: 40 }),
    ])
    // L02: 이름 6자+이, 가장 긴 장소 이름 17자+로, 떠났다 → 30자 > 28. 문형은 max_len 40이라 통과
    assert.deepEqual(r, ['V6 event/L02.json#/intro/lines/0'])
  })
})

describe('V3 교차 검사', () => {
  it('special.{special}.{param}와 trait_hook 이름', () => {
    const mods = [
      { target: 'special.screech.fatigue', op: 'add', value: 1 },
      { target: 'special.screech.volume', op: 'add', value: 1 },
      { target: 'special.roar.fatigue', op: 'add', value: 1 },
    ]
    const r = run([...WORLD, item('A01', { modifiers: mods }), event('L02', { condition: { trait_hook: 'fly_away' } })])
    assert.deepEqual(r, ['V3 event/L02.json#/condition/trait_hook', 'V3 item/A01.json#/modifiers/1/target', 'V3 item/A01.json#/modifiers/2/target'])
  })
})

describe('V11 부분 성공과 V20 판정 dc', () => {
  const checked = (id: string, check: Obj, partial = true) =>
    choice(id, {
      check,
      outcomes: { success: { effects: [] }, failure: { effects: [] }, ...(partial ? { partial: { effects: [] } } : {}) },
    })
  it('판정 종류의 partial·partial_event_defined와 사건의 partial_allowed', () => {
    const r = run([
      ...WORLD,
      event('L02', {
        choices: [
          checked('a', { kind: 'forage', dc_offset: 0 }),
          checked('b', { kind: 'ambush' }),
          checked('c', { kind: 'attack_event', dc: 12, partial_allowed: true }),
          checked('d', { kind: 'attack_event', dc: 12 }),
          checked('e', { kind: 'forage', partial_allowed: false }),
          checked('f', { any_of: ['forage', 'ambush'] }),
        ],
      }),
    ])
    assert.deepEqual(r, [
      'V11 event/L02.json#/choices/1/outcomes/partial',
      'V11 event/L02.json#/choices/3/outcomes/partial',
      'V11 event/L02.json#/choices/4/outcomes/partial',
      'V11 event/L02.json#/choices/5/outcomes/partial',
    ])
  })

  it('dc 종류별로 사건이 쓸 수 있는 dc·dc_offset(roll_check 포함)', () => {
    const roll = { type: 'roll_check', check: { kind: 'haggle', dc_offset: 2 }, success: [] }
    const r = run([
      ...WORLD,
      event('L02', {
        choices: [
          checked('a', { kind: 'haggle', dc_offset: 2 }, false),
          checked('b', { kind: 'persuade' }, false),
          checked('c', { kind: 'flee' }, false),
          checked('d', { kind: 'haggle', dc: 16 }, false),
          choice('e', effects(roll)),
        ],
      }),
    ])
    assert.deepEqual(r, [
      'V20 event/L02.json#/choices/0/check',
      'V20 event/L02.json#/choices/1/check',
      'V20 event/L02.json#/choices/2/check',
      'V20 event/L02.json#/choices/4/outcomes/always/effects/0/check',
    ])
  })
})

describe('V12 연속 사건', () => {
  it('단계 빈틈·중복, 앞 단계 조건, end_chain outcome', () => {
    const stage = (id: string, n: number, over: Obj = {}) => event(id, { category: 'chain', chain: { id: 'C01', stage: n }, ...over })
    const prev = { condition: { all: [{ chain_stage: { chain: 'C01', stage: 1 } }, { in_town: true }] } }
    const r = run([
      ...WORLD,
      chain('C01', 3),
      stage('C01-1', 1, { choices: [choice('go', effects({ type: 'end_chain', chain_id: 'C01', outcome: 'treasure' }))] }),
      stage('C01-2', 2, prev),
      stage('C01-2b', 2),
    ])
    assert.deepEqual(r, [
      'V12 event/C01-1.json#/choices/0/outcomes/always/effects/0/outcome',
      'V12 event/C01-2b.json#/chain/stage',
      'V12 chain/C01.json#/stages',
      'V12 event/C01-2b.json#/condition',
    ])
  })
})

describe('V15·V4·V9·S01 효과 교차 검사', () => {
  const trait = (id: string, acquire: Obj) =>
    def('trait', { id, name: id, kind: 'acquired', subkind: 'story', acquired_class: 'unique', inheritable: false, acquire, modifiers: [], lines: ['가', '나'] })
  it('acquire type event의 선택지 결과에 add_trait가 있어야 한다', () => {
    const giver = event('L02', { choices: [choice('go', effects({ type: 'if', cond: true, then: [{ type: 'add_trait', trait_id: 'TA01' }] })), choice('stay')] })
    const r = run([
      ...WORLD,
      giver,
      trait('TA01', { type: 'event', event_id: 'L02', choice: 'go' }),
      trait('TA02', { type: 'event', event_id: 'L02', choice: 'stay' }),
      trait('TA03', { type: 'event', event_id: 'L02', choice: 'fly' }),
    ])
    assert.deepEqual(r, ['V15 trait/TA02.json#/acquire', 'V15 trait/TA03.json#/acquire/choice'])
  })

  it('mutate도 획득으로 본다(변이 특성의 acquire)', () => {
    const giver = event('F03', { choices: [choice('go'), choice('accept', effects({ type: 'mutate', trait_id: 'TM01' }))] })
    const r = run([
      ...WORLD,
      giver,
      trait('TM01', { type: 'event', event_id: 'F03', choice: 'accept' }),
      trait('TM02', { type: 'event', event_id: 'F03', choice: 'accept' }),
    ], 'V15')
    assert.deepEqual(r, ['V15 trait/TM02.json#/acquire'])
  })

  it('mutate는 변이 특성, damage hp는 경고, tier는 단계 수 이하', () => {
    // mutate는 cost가 필요한 효과(V8)라 선택 대기 사건으로 쓴다
    const preview = { benefit: '이득', cost: '대가', reversible: false }
    const r = run([
      ...WORLD,
      trait('TA01', { type: 'condition', condition: true }),
      item('A09', { tier: 3 }),
      event('L02', {
        choices: [choice('go', { preview, ...effects(
          { type: 'mutate', trait_id: 'TA01' },
          { type: 'damage', hp: 3 },
          { type: 'add_random_item', tier: 5, grade_weights: { common: 1 } },
        ) }), choice('stay', { preview })],
        hold: 'branch', preview: { body: '본문' }, hold_line: '고민한다',
      }),
    ])
    assert.deepEqual(r, [
      'V4 event/L02.json#/choices/0/outcomes/always/effects/0/trait_id',
      'warn V9 event/L02.json#/choices/0/outcomes/always/effects/1/hp',
      'S01 event/L02.json#/choices/0/outcomes/always/effects/2/tier',
      'S01 item/A09.json#/tier',
    ])
  })
})

describe('V17 적 수치', () => {
  // 01 §5.2 등록부: [ID, 레벨, 구분, HP, 방어, 명중, 피해 최소, 최대, XP, 동전]
  const REGISTRY = [
    ['EN01', 1, 'normal', 10, 10, 2, 1, 2, 9, 5], ['EN02', 4, 'normal', 17, 11, 3, 1, 3, 18, 12],
    ['EN03', 8, 'normal', 26, 12, 4, 2, 5, 30, 28], ['EN04', 15, 'normal', 42, 15, 7, 3, 8, 51, 81],
    ['EN05', 7, 'normal', 24, 12, 4, 2, 4, 27, 23], ['EN06', 15, 'normal', 42, 15, 7, 3, 8, 51, 81],
    ['EN07', 23, 'normal', 61, 17, 9, 4, 11, 75, 220], ['EN08', 10, 'normal', 31, 13, 5, 2, 6, 36, 39],
    ['EN09', 18, 'normal', 49, 16, 8, 4, 9, 60, 120], ['EN10', 26, 'normal', 68, 18, 10, 5, 12, 84, 311],
    ['EB01', 13, 'elite', 95, 14, 8, 4, 10, 112, 152], ['EB02', 21, 'elite', 141, 17, 11, 6, 13, 172, 435],
    ['EB03', 29, 'boss', 373, 21, 14, 8, 20, 930, 4330],
  ] as const

  it('기준식이 01 §5.2 등록부 13종과 모두 같다', () => {
    for (const [id, level, rank, hp, ac, hit, dmin, dmax, xp, coins] of REGISTRY) {
      assert.deepEqual(enemyStats(FORMULA, level, rank), { hp, ac, hit, dmg_min: dmin, dmg_max: dmax, xp, coins }, id)
    }
  })

  it('다르면 경고, _note가 있으면 억제', () => {
    const r = run([...WORLD, enemy('EN02', { level: 4, hp: 17, ac: 11, hit: 3, damage: [1, 3], xp: 18, coins: 99 }), enemy('EN03', { hp: 99, _note: '등록부 값' })])
    assert.deepEqual(r, ['warn V17 enemy/EN02.json#'])
  })
})

const ATTITUDE: Obj = {
  id: 'stable', name: '안정적', reason_label: '안정적', order: 0, activity_weights: { hunt: 60, adventure: 30, dungeon: 10 },
  retreat_hp: 0.6, return_fatigue: 60, max_risk: 'normal', max_risk_adventure: null, dungeon_depth_offset: -1,
  gate_risk_limit: -1, lethal_gate_risk_limit: -1, gate_hp_ratio: 0.8, potion_reserve_n: 0, dungeon_safety_k: 2,
  buy_targets: { potion: 4, ration: 2 }, bandage_use_at: 1, eval_mult: { weapon: 0.8, armor: 1.2 },
  light_treat: { min_injuries: 1, if_dungeon_candidate: false }, reserve_ratio: 0.4, hunt_target_encounters: 8,
  adventure_scenes: [3, 4], location_target_risk: -2, fit_coef: { very_low: 0.6, low: 1, normal: 1, high: 0.8 },
  retreat_camp: false, shortcut: { chance: 0 }, disarm_when: { trait_hook: 'attempt_disarm' }, chest_break: false,
  tag_scores: { safe: 3, thrift: 2, rest: 2, kindness: 1, info: 0, new_path: -1, reward: 0, bold: -2 }, medium_risk_penalty: -1, low_success_penalty: -2, event_pref_line: '손해·부상 회피',
}
