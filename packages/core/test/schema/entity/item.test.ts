import { assertIssue, assertValid, edit } from './setup'
import { describe, it } from 'node:test'
import { itemSchema, itemSourceSchema } from '../../../src/schema/entity/index'

// 16 §2.5 W07 예시. null 필드는 뺐고(`?` = 생략), 5.5 신설 reacquire·description·appraisal_override를 더했다.
const W07 = {
  id: 'W07', name: '종이 달린 짧은 검', slot: 'weapon', tier: 3,
  grade_mode: 'fixed', fixed_grade: 'rare', unique: true, stat: 'dex',
  modifiers: [
    { target: 'check.fear', op: 'add', value: 2 },
    { target: 'ambush_negate', op: 'charges_per_sortie', value: 1 },
  ],
  single_use: false, cursed: false,
  sources: [{ kind: 'event', id: 'C01-3', detail: 'rescue' }],
  reacquire: { pool: ['W06'], grade: 'rare' },
  sellable: false, appraisal_override: 5500,
  visual_group: 'V07',
  story_template: '{generation}대 {name:이/가} 무너진 갱도 다리를 다시 놓고 {npc}에게 받았다.',
  description: '작은 종이 먼저 운다.', lore: { tale: '이야기', npc: '세나', secret: { text: '무서우면 흔들어', reveal: 'inherited' } },
}

// J01 구조자 고정(5.5)
const J01 = {
  id: 'J01', name: '낡은 호각', slot: 'accessory', tier: 1,
  grade_mode: 'fixed', fixed_grade: 'good', unique: true,
  modifiers: [
    { target: 'rescuer_override', op: 'set', value: 'whistle_family' },
    { target: 'defeat_loss_mult', op: 'mul', value: 0.4 },
    { target: 'defeat_item_loss_chance', op: 'set', value: 0.2 },
  ],
  cursed: false,
  sources: [{ kind: 'event', id: 'C02-3' }],
  reacquire: { pool: ['J02'], grade: 'rare' },
  sellable: false, appraisal_override: 211,
  visual_group: 'V_J01', story_template: '토리가 고맙다며 목에 걸어 주었다.', description: '위험할 때 불면 누군가 온다.', lore: { tale: '이야기' },
}

// R03 1회용 유물
const R03 = {
  id: 'R03', name: '별잠 물병', slot: 'relic', tier: 4,
  grade_mode: 'fixed', fixed_grade: 'rare', unique: true,
  modifiers: [
    { target: 'serious_heal', op: 'charges_total', value: 1 },
    { target: 'final_check_add', op: 'add', value: 5 },
  ],
  single_use: true, keepsake_after_use: '빈 별잠 물병', cursed: false,
  sources: [{ kind: 'event', id: 'F02', detail: 'bottle' }],
  reacquire: { pool: ['W08', 'A06'], grade: 'rare' },
  sellable: false, appraisal_override: 22500,
  visual_group: 'V_R03', story_template: '별잠 샘에서 물을 병에 담아 돌아왔다.', description: '별잠 샘의 물 한 모금.', lore: { tale: '이야기' },
}

// W08: shop 2항목(대장간 금패 + 길드 특별 상점 pick_group) + 흡혈귀 수정자(09 §7.7)
const W08 = {
  id: 'W08', name: '은빛 광맥 장검', slot: 'weapon', tier: 4,
  grade_mode: 'rolled', unique: false, stat: 'str',
  modifiers: [
    { target: 'damage_vs.bat', op: 'add', value: 3 },
    { target: 'check.stat.soc', op: 'add', value: -1, when: { mutation: 'vampire' } },
    { target: 'equip_eval_mult', op: 'mul', value: 0.9, when: { mutation: 'vampire' } },
  ],
  cursed: false,
  sources: [{ kind: 'shop' }, { kind: 'drop', id: 'D2' }, { kind: 'guild_special' }],
  shop: [
    { facility: 'smithy', guild_rank_req: 'gold' },
    { facility: 'guild', guild_rank_req: 'gold', grades: ['rare'], pick_group: 'guild_t2' },
  ],
  sellable: true,
  visual_group: 'V_W08', story_template: '중층 은빛 광맥 옆에서 찾았다.', description: '은빛 광맥이 어둠 속 날갯짓을 비춘다.', lore: { tale: '이야기' },
}

// J05: 장소 전용 드롭(sources drop 항목) + reacquire.reroll, 저주
const J05 = {
  id: 'J05', name: '속삭이는 종 조각', slot: 'accessory', tier: 4,
  grade_mode: 'fixed', fixed_grade: 'rare', unique: true, cursed: true,
  modifiers: [
    { target: 'check.skill.search', op: 'add', value: 3 },
    { target: 'check.trap_detect', op: 'add', value: 2 },
    { target: 'check.trap_evade', op: 'add', value: 2 },
    { target: 'check.trap_disarm', op: 'add', value: 2 },
    { target: 'check.stat.wil', op: 'add', value: -2 },
  ],
  sources: [{ kind: 'drop', id: 'D3', room: 'treasure', grade_is: 'rare', chance: 0.5, once_per_life: true }],
  reacquire: { reroll: true },
  sellable: true, appraisal_override: 12000,
  visual_group: 'V_J05', story_template: '심층 상자 속에서 혼자 울리고 있었다.', description: '종 조각이 숨은 길을 속삭인다.', lore: { tale: '이야기' },
}

// R01: 길드 특별 상점 전용 고유 — reacquire 금지
const R01 = {
  id: 'R01', name: '귀환의 방울', slot: 'relic', tier: 2,
  grade_mode: 'fixed', fixed_grade: 'rare', unique: true,
  modifiers: [{ target: 'escape_on_defeat', op: 'charges_per_sortie', value: 1 }],
  cursed: false,
  sources: [{ kind: 'guild_special' }],
  shop: [{ facility: 'guild', guild_rank_req: 'silver' }],
  price_override: 2850, sellable: true,
  visual_group: 'V_R01', story_template: '하델이 건넸다.', description: '위험한 순간 방울이 울리면 길이 열린다.', lore: { tale: '이야기' },
}

// J02: 등급별 수정자
const J02 = {
  id: 'J02', name: '들쥐 이빨 목걸이', slot: 'accessory', tier: 1,
  grade_mode: 'rolled', unique: false, cursed: false,
  grade_modifiers: {
    common: [{ target: 'stat.luk', op: 'add', value: 1 }],
    good: [{ target: 'stat.luk', op: 'add', value: 1 }],
    rare: [{ target: 'stat.luk', op: 'add', value: 2 }],
  },
  sources: [{ kind: 'drop', id: 'H1' }],
  sellable: true,
  visual_group: 'V_J02', story_template: '들쥐 굴에서 반짝이던 것이다.', description: '가끔 운이 따른다.', lore: { tale: '이야기' },
}

// W01: 기본 성능 덮어쓰기와 판매가 덮어쓰기
const W01 = {
  id: 'W01', name: '녹슨 검', slot: 'weapon', tier: 1,
  grade_mode: 'fixed', fixed_grade: 'common', unique: false, stat: 'str',
  base: { damage: [1, 4] },
  cursed: false,
  sources: [{ kind: 'start' }, { kind: 'aid' }],
  sellable: true, sell_price_override: 5,
  visual_group: 'V01', story_template: '길드에서 처음 받았다.', description: '이가 빠지고 녹이 슬었다. 그래도 첫 검이다.', lore: { tale: '이야기' },
}

describe('item: 검증 기준 예시', () => {
  for (const [label, item] of Object.entries({ W07, J01, R03, W08, J05, R01, J02, W01 })) {
    it(`${label} 통과`, () => assertValid(itemSchema, item))
  }
})

describe('item: V15 고유 장비', () => {
  it('unique인데 rolled면 실패', () => {
    assertIssue(itemSchema, edit(W07, { grade_mode: 'rolled', fixed_grade: undefined }), 'grade_mode', 'V15')
  })
  it('unique인데 reacquire가 없으면 실패', () => {
    assertIssue(itemSchema, edit(W07, { reacquire: undefined }), 'reacquire', 'V15')
  })
  it('unique인데 sources가 비면 실패', () => {
    assertIssue(itemSchema, edit(W07, { sources: [] }), 'sources', 'V15')
  })
  it('상점 전용 고유에 reacquire가 있으면 실패', () => {
    assertIssue(itemSchema, edit(R01, { reacquire: { reroll: true } }), 'reacquire', 'V15')
  })
  it('reacquire 모양: pool은 1개 이상, reroll은 true만, 둘을 섞지 않는다', () => {
    assertIssue(itemSchema, edit(W07, { reacquire: { pool: [], grade: 'rare' } }), 'reacquire.pool')
    assertIssue(itemSchema, edit(W07, { reacquire: { reroll: false } }), 'reacquire')
    assertIssue(itemSchema, edit(W07, { reacquire: { pool: ['W06'], grade: 'rare', reroll: true } }), 'reacquire')
  })
})

describe('item: 그 밖의 규칙', () => {
  it('저주 장비에 shop이 있으면 실패(V16)', () => {
    assertIssue(itemSchema, edit(J05, { shop: [{ facility: 'general_store' }] }), 'shop', 'V16')
  })
  it('무기는 stat 필수, 무기가 아니면 금지', () => {
    assertIssue(itemSchema, edit(W08, { stat: undefined }), 'stat')
    assertIssue(itemSchema, edit(J02, { stat: 'dex' }), 'stat')
  })
  it('fixed면 fixed_grade 필수, rolled면 금지', () => {
    assertIssue(itemSchema, edit(W01, { fixed_grade: undefined }), 'fixed_grade')
    assertIssue(itemSchema, edit(W08, { fixed_grade: 'rare' }), 'fixed_grade')
  })
  it('모르는 필드·null 생략 필드는 실패(strict)', () => {
    assertIssue(itemSchema, edit(W07, { note: 'x' }), '')
    assertIssue(itemSchema, edit(W07, { shop: null }), 'shop')
  })
  it('주석 칸(D80): lore 필수, {npc}를 쓰면 lore.npc 필수, 글은 120자 이내, 비밀은 열리는 때가 필요', () => {
    assertIssue(itemSchema, edit(W01, { lore: undefined }), 'lore')
    assertIssue(itemSchema, edit(W07, { lore: { tale: '이야기' } }), 'lore')
    assertIssue(itemSchema, edit(W01, { lore: { tale: '가'.repeat(121) } }), 'lore')
    assertIssue(itemSchema, edit(W01, { lore: { tale: '이야기', secret: { text: '비밀' } } }), 'lore.secret.reveal')
  })
  it('수정자 target 오류는 그 경로로', () => {
    assertIssue(itemSchema, edit(W08, { modifiers: [{ target: 'no_such_target', op: 'add', value: 1 }] }), 'modifiers.0.target')
  })
})

describe('itemSourceSchema', () => {
  it('drop·event·discovery는 id 필수', () => {
    assertIssue(itemSourceSchema, { kind: 'drop' }, 'id')
    assertIssue(itemSourceSchema, { kind: 'event' }, 'id')
    assertIssue(itemSourceSchema, { kind: 'discovery' }, 'id')
    assertValid(itemSourceSchema, { kind: 'discovery', id: 'A3-2' })
  })
  it('drop 전용 필드는 다른 kind에 쓰지 않는다', () => {
    assertIssue(itemSourceSchema, { kind: 'shop', room: 'treasure' }, '')
  })
  it('모르는 kind는 실패', () => {
    assertIssue(itemSourceSchema, { kind: 'craft' }, 'kind')
  })
})
