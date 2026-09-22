import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { dungeonFloorSchema, regionSchema } from '../../../src/schema/world/index'
import { clone, expectFail, expectOk, registerTestVocabulary } from './helpers'

registerTestVocabulary()

// CONTENT_SCHEMA §5.3 A1 예시 그대로
const A1 = {
  id: 'A1', name: '여울 들길', kind: 'adventure_route',
  level_range: [1, 8], level_mid: 4, travel_sec: 25,
  unlock: true, patrol_zone: true, fallback: false, aid_allowed: true, deficit_exempt: 'always',
  scenes: [3, 5], scene_weights: { discovery: 25, path: 15, forage: 20, encounter: 20, event: 20 },
  encounters: [{ enemy_id: 'EN01', weight: 50 }, { enemy_id: 'EN02', weight: 50 }], pair_chance: 0.10,
  map_fragments: [{ id: 'A1-M1', name: '오래된 이정표 조각' }, { id: 'A1-M2', name: '무덤가 지도 조각' }],
  discoveries: [
    { id: 'A1-2', name: '버드나무 둑 가는 길', condition: true, dc: { grade: 'normal' },
      effects: [{ type: 'unlock_location', location_id: 'H2' }] },
    { id: 'A1-6', name: '도토리 숲 샘터', condition: { level_gte: 3 }, dc: { grade: 'hard' },
      modifiers: [{ target: 'camp_hp_mult', op: 'mul', value: 1.10, when: { location: ['H1', 'H2', 'A1'] } }] },
    { id: 'A1-5', name: '여울 다리 아래', condition: true, dc: { grade: 'easy' },
      event_weight_mult: { 'C02-1': 2 } },
  ],
  tags: [], rescuers: 'field', background_id: 'bg_river_path',
}

// D3 심층(치명 관문). 수치는 01 §8.1·§8.2, 07 §5.1·§5.3, 관문은 §5.3 gate 예시
const D3 = {
  id: 'D3', name: '종소리 폐광 심층', kind: 'dungeon_floor',
  level_range: [21, 30], level_mid: 25, travel_sec: 60, descend_sec: 40,
  unlock: { all: [{ defeated: 'EB02' }, { guild_rank_gte: 'gold' }] }, guild_rank_req: 'gold',
  weather_exempt: true, tags: ['dark', 'mine'], rescuers: 'dungeon', background_id: 'bg_mine_deep',
  dungeon: { group: 'bell_mine', depth: 3 },
  encounters: [{ enemy_id: 'EN07', weight: 50 }, { enemy_id: 'EN10', weight: 50 }], pair_chance: 0.35,
  rooms: [5, 7], room_weights: { combat: 45, trap: 20, rest: 5, treasure: 15, event: 15 },
  trap_table: ['trap_rock', 'trap_spike', 'trap_dust', 'trap_alarm', 'trap_collapse', 'trap_saw'].map((trap_id) => ({ trap_id, weight: 1 })),
  treasure_table: { chest: 70, vein: 30 },
  gate: {
    enemy_id: 'EB03', lethal: true,
    remnant: { enemy_id: 'EN10' },
    first_clear: [
      { type: 'add_item', item_id: 'W10', to: 'bag_or_pending' },
      { type: 'add_trait', trait_id: 'TA08' },
      { type: 'set_family_flag', key: 'fam.eb03_slain' },
    ],
    lines: {
      turn_back: '관문 앞에서 발길을 돌렸다.',
      lethal_blocked: { line: '부서진 종 앞에서 돌아섰다.',
        detail: '종이 울릴 때마다 발밑이 흔들렸다. 이곳에서 쓰러지면 돌아오지 못한다. (방침에서 치명 위험을 허용하면 도전한다)' },
      lethal_auto_entry: '방침에 따라 부서진 종 앞에 섰다.',
      death_line: '부서진 종 아래에서 눈을 감았다.',
      suggest_lethal_off: '치명 위험 허용을 끄면 부서진 종 앞에서 돌아선다.',
      suggest_default: '종은 준비된 자에게도 무겁게 울렸다.',
    },
  },
}

const H1 = {
  id: 'H1', name: '여울가 풀밭', kind: 'hunting_ground',
  level_range: [1, 4], level_mid: 2, travel_sec: 20,
  unlock: true, patrol_zone: true, fallback: true, aid_allowed: true, deficit_exempt: 'always',
  encounters: [{ enemy_id: 'EN01', weight: 50 }, { enemy_id: 'EN02', weight: 50 }], pair_chance: 0.1, event_check: 0.08,
  rescuers: 'field', background_id: 'bg_meadow',
}

const T00 = {
  id: 'T00', name: '도토리 여울 마을', kind: 'town', unlock: true, background_id: 'bg_town',
  facilities: [
    { id: 'smithy', name: '여울 대장간', npc_id: 'N02', good_stock: 2 },
    { id: 'inn', name: '여관', npc_id: 'N03', services: ['inn', 'lodging'] },
  ],
}

describe('region: 정상', () => {
  it('5.3 A1 예시가 통과하고 발견 지점 기본값이 채워진다', () => {
    const r = expectOk(regionSchema, A1)
    assert.equal(r.kind, 'adventure_route')
    if (r.kind !== 'adventure_route') return
    assert.equal(r.discoveries[0]!.check, 'pathfinding')
    assert.equal(r.closes_on_succession, false)
  })

  it('D3(치명 관문) 예시가 통과한다', () => {
    const r = expectOk(regionSchema, D3)
    assert.equal(r.kind === 'dungeon_floor' && r.gate.lethal, true)
    assert.equal(r.patrol_zone, false)
  })

  it('사냥터·마을 예시가 통과한다', () => {
    expectOk(regionSchema, H1)
    const t = expectOk(regionSchema, T00)
    assert.equal(t.weather_exempt, false)
  })

  it('치명이 아닌 관문은 turn_back만 있으면 된다', () => {
    const d = clone(D3) as Record<string, any>
    d.gate = { enemy_id: 'EB02', lethal: false, remnant: { enemy_id: 'EN09' }, lines: { turn_back: '관문 앞에서 발길을 돌렸다.' } }
    expectOk(dungeonFloorSchema, d)
  })
})

describe('region: 오류', () => {
  it('모르는 필드(16의 옛 guild_patrol)', () => {
    expectFail(regionSchema, { ...A1, guild_patrol: true })
  })

  it('잘못된 판별자', () => {
    expectFail(regionSchema, { ...H1, kind: 'castle' })
  })

  it('치명 관문의 lines 누락', () => {
    const d = clone(D3) as Record<string, any>
    d.gate.lines = { turn_back: '관문 앞에서 발길을 돌렸다.' }
    const paths = expectFail(regionSchema, d)
    assert.deepEqual(paths.sort(), [
      'gate.lines.death_line', 'gate.lines.lethal_auto_entry', 'gate.lines.lethal_blocked',
      'gate.lines.suggest_default', 'gate.lines.suggest_lethal_off',
    ])
  })

  it('마을에는 권장 레벨이 없다', () => {
    expectFail(regionSchema, { ...T00, level_range: [1, 1] })
  })

  it('마을 밖 장소는 rescuers가 필수다(기본값 없음)', () => {
    const h = clone(H1) as Record<string, any>
    delete h.rescuers
    assert.deepEqual(expectFail(regionSchema, h), ['rescuers'])
  })

  it('발견 지점 dc 등급 오타, 빈 조우 표', () => {
    const a = clone(A1) as Record<string, any>
    a.discoveries[0].dc = { grade: 'medium' }
    a.encounters = []
    const paths = expectFail(regionSchema, a)
    assert.ok(paths.includes('discoveries.0.dc.grade'), paths.join())
    assert.ok(paths.includes('encounters'), paths.join())
  })

  it('방 종류 가중치의 모르는 방', () => {
    const d = clone(D3) as Record<string, any>
    d.room_weights.shrine = 5
    expectFail(regionSchema, d)
  })
})
