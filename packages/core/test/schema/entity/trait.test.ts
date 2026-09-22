import { assertIssue, assertValid, edit } from './setup'
import { describe, it } from 'node:test'
import { traitAcquireSchema, traitSchema } from '../../../src/schema/entity/index'

// 16 §2.7 TI06 예시(short_name null → 06 기록 표기) + birth_weight(06 §6.3)
const TI06 = {
  id: 'TI06', name: '호기심 많음', short_name: '호기심',
  kind: 'innate', subkind: 'temperament', inheritable: true, inherit_class: 'positive',
  modifiers: [{ target: 'trap_encounter_add', op: 'add', value: 0.10 }],
  ai_hooks: {
    activity_weight_add: { adventure: 10 },
    location_score_add: [{ when: { location_kind: ['adventure_route'] }, value: 10 }],
    choice_tag_bonus: { new_path: 2, info: 1 },
  },
  reason_phrase: '호기심을 참지 못하고',
  lines: ['{name:은/는} 처음 보는 길목에서 걸음을 멈췄다.', '낯선 발자국을 따라 조금 더 걸었다.'],
  birth_weight: 14,
}

// 16 §2.7 TI07 예시(retreat_hp_add 10 → 0.10, DS-29)
const TI07 = {
  id: 'TI07', name: '겁이 많음', short_name: '겁',
  kind: 'innate', subkind: 'temperament', inheritable: true, inherit_class: 'positive',
  modifiers: [
    { target: 'check.fear', op: 'add', value: -2 },
    { target: 'check.ambush', op: 'add', value: 1 },
  ],
  ai_hooks: { retreat_hp_add: 0.10, choice_tag_bonus: { safe: 2, bold: -2 }, activity_weight_add: { dungeon: -5 } },
  reason_phrase: '겁이 많아',
  lines: ['겁이 많은 {name:은/는} 한 번 더 뒤를 돌아봤다.', '조심성 덕분에 매복을 한 걸음 먼저 피했다.'],
  birth_weight: 12,
}

// acquire counter + where(5.6, DS-23)
const TA02 = {
  id: 'TA02', name: '어둠을 견딘 자', short_name: '어둠 견딤',
  kind: 'acquired', subkind: 'story', acquired_class: 'cumulative', inheritable: false,
  acquire: { type: 'counter', counter: 'safe_returns', where: { dungeon_group: 'bell_mine', dungeon_depth_gte: 2 }, threshold: 10 },
  modifiers: [
    { target: 'check.fear', op: 'add', value: 2 },
    { target: 'dark_penalty_ignore', op: 'flag', value: true },
  ],
  ai_hooks: { activity_weight_add: { dungeon: 5 } },
  lines: ['등불이 흔들려도 {name:은/는} 걸음을 늦추지 않았다.', '이 어둠은 처음이 아니다. 숨을 고르고 내려갔다.'],
}

// acquire condition(5.6 예시) + replaces
const TA07 = {
  id: 'TA07', name: '겁을 이긴 자', short_name: '용기',
  kind: 'acquired', subkind: 'temperament', acquired_class: 'cumulative', inheritable: false,
  acquire: {
    type: 'condition',
    condition: { all: [{ has_trait: 'TI07' }, { num: { key: 'counter.fear_successes', op: '>=', value: 5 } }] },
  },
  replaces: 'TI07', exclusive_with: ['TI07'],
  modifiers: [{ target: 'check.fear', op: 'add', value: 1 }],
  ai_hooks: { choice_tag_bonus: { bold: 1 } },
  lines: ['다섯 번째 어둠 앞에서 떨지 않았다.', '겁 많던 아이는 오늘 처음으로 앞장섰다.'],
}

// acquire event(표시 전용)
const TA01 = {
  id: 'TA01', name: '다리의 은인',
  kind: 'acquired', subkind: 'story', acquired_class: 'unique', inheritable: false,
  acquire: { type: 'event', event_id: 'C01-3', choice: 'rescue' },
  modifiers: [{ target: 'price_mult', op: 'add', value: -0.10, when: { in_town: true } }],
  lines: ['대장간 보름이 값을 부르다 말고 고개를 저었다.', '다리의 은인이라며 광부촌 아이들이 뒤를 따랐다.'],
}

// 5.6 TM01 mutation 전체(09 §7)
const TM01 = {
  id: 'TM01', name: '달의 갈증', short_name: '달의 갈증',
  kind: 'mutation', subkind: 'story', inheritable: false,
  acquire: { type: 'event', event_id: 'F03', choice: 'accept' },
  modifiers: [],
  lines: ['{name:은/는} 잔을 비웠다. 달빛이 조금 달게 느껴졌다.', '해가 뜨자 {name:은/는} 망토 깃을 올렸다.'],
  mutation: {
    stat_add: { str: 1, dex: 1, wil: 1, soc: -1 }, stat_floor: 1,
    natural_cap_add: { str: 1, dex: 1 },
    no_aging_loss: true, blocks_lifespan_extension: true,
    time_ratio: { day: 0.2, night: 0.8 },
    time_modifiers: {
      night: [
        { target: 'hit', op: 'add', value: 1 },
        { target: 'damage_mult', op: 'mul', value: 1.1 },
        { target: 'breather_mult', op: 'mul', value: 2 },
        { target: 'recovery_coef', op: 'set', value: 1.0 },
      ],
      day: [
        { target: 'check.all', op: 'add', value: -2 },
        { target: 'fatigue_gain_mult', op: 'mul', value: 1.5 },
        { target: 'recovery_coef', op: 'set', value: 0.7 },
      ],
    },
    modifiers: [
      { target: 'recovery_coef', op: 'set', value: 0.9, when: { in_town: true } },
      {
        target: 'shop_surcharge', op: 'add', value: 0.2,
        when: { all: [{ in_town: true }, { last_trip_time: 'day' }, { not: { flag: 'life.f03_clue' } }] },
      },
    ],
    thirst: {
      per_min: 2, day_sortie: 5, night_win: -3, elite_boss: -15,
      auto_drink: { sortie_gte: 60, town_gte: 40 },
      stages: [
        { id: 'calm', from: 0 },
        { id: 'thirsty', from: 40, modifiers: [{ target: 'check.stat.soc', op: 'add', value: -1 }], line: '목이 말랐다. 달이 뜨기를 기다렸다.' },
        { id: 'starving', from: 70, modifiers: [{ target: 'check.all', op: 'add', value: -1 }], night_ratio: 1.0, line: '{name:은/는} 사람들 곁에 오래 머물지 않았다.' },
        { id: 'brink', from: 90, modifiers: [{ target: 'check.all', op: 'add', value: -1 }], night_ratio: 1.0, line: '갈증이 한계에 가까워졌다.' },
        { id: 'limit', from: 100, line: '{name:은/는} 더는 견딜 수 없었다.' },
      ],
    },
    blood_rest: { min: 6, thirst_add: 20, cures: 'serious' },
    cellar_rest_sec: 120,
    blocked_triggers: [{ trigger: 'camp', when: { time_of_day: 'day' } }],
    sleep: { add_years: 30, cap: 118 },
  },
}

describe('trait: 검증 기준 예시', () => {
  for (const [label, trait] of Object.entries({ TI06, TI07, TA02, TA07, TA01, TM01 })) {
    it(`${label} 통과`, () => assertValid(traitSchema, trait))
  }
})

describe('trait: kind별 규칙', () => {
  it('innate인데 acquire가 있으면 실패', () => {
    assertIssue(traitSchema, edit(TI06, { acquire: { type: 'counter', counter: 'wins', threshold: 150 } }), 'acquire')
  })
  it('innate인데 birth_weight가 없으면 실패', () => {
    assertIssue(traitSchema, edit(TI06, { birth_weight: undefined }), 'birth_weight')
  })
  it('acquired·mutation인데 acquire가 없으면 실패', () => {
    assertIssue(traitSchema, edit(TA02, { acquire: undefined }), 'acquire')
    assertIssue(traitSchema, edit(TM01, { acquire: undefined }), 'acquire')
  })
  it('후천은 acquired_class, 유전 가능은 inherit_class 필수', () => {
    assertIssue(traitSchema, edit(TA02, { acquired_class: undefined }), 'acquired_class')
    assertIssue(traitSchema, edit(TI06, { inherit_class: undefined }), 'inherit_class')
  })
  it('mutation 필드는 변이 전용이고 변이에는 필수', () => {
    assertIssue(traitSchema, edit(TI06, { mutation: TM01.mutation }), 'mutation')
    assertIssue(traitSchema, edit(TM01, { mutation: undefined }), 'mutation')
  })
  it('lines는 2개 이상', () => {
    assertIssue(traitSchema, edit(TI06, { lines: ['하나뿐'] }), 'lines')
  })
})

describe('trait: 훅과 변이 세부', () => {
  it('등록되지 않은 ai_hooks 키는 실패', () => {
    assertIssue(traitSchema, edit(TI06, { ai_hooks: { no_such_hook: 1 } }), 'ai_hooks')
  })
  it('retreat_hp_add는 ratio(옛 pct_point 10은 실패)', () => {
    assertIssue(traitSchema, edit(TI07, { ai_hooks: { retreat_hp_add: 10 } }), 'ai_hooks.retreat_hp_add')
  })
  it('훅 안 조건도 검사한다', () => {
    assertIssue(traitSchema, edit(TI06, { ai_hooks: { location_score_add: [{ when: { bogus: 1 }, value: 10 }] } }), 'ai_hooks.location_score_add.0.when.bogus', 'V3')
  })
  it('갈증 단계 id는 ID 형식, blocked_triggers는 판단 지점 열거', () => {
    const bad = (patch: Record<string, unknown>) => edit(TM01, { mutation: { ...TM01.mutation, ...patch } })
    assertIssue(traitSchema, bad({ thirst: { ...TM01.mutation.thirst, stages: [{ id: '1calm', from: 0 }] } }), 'mutation.thirst.stages.0.id')
    assertIssue(traitSchema, bad({ blocked_triggers: [{ trigger: 'dawn', when: true }] }), 'mutation.blocked_triggers.0.trigger')
  })
})

describe('traitAcquireSchema', () => {
  it('3형 통과', () => {
    assertValid(traitAcquireSchema, { type: 'counter', counter: 'wins', threshold: 150 })
    assertValid(traitAcquireSchema, TA07.acquire)
    assertValid(traitAcquireSchema, TA01.acquire)
  })
  it('등록되지 않은 카운터는 V3', () => {
    assertIssue(traitAcquireSchema, { type: 'counter', counter: 'deep_returns', threshold: 10 }, 'counter', 'V3')
  })
  it('모르는 type·threshold 0은 실패', () => {
    assertIssue(traitAcquireSchema, { type: 'birth' }, 'type')
    assertIssue(traitAcquireSchema, { type: 'counter', counter: 'wins', threshold: 0 }, 'threshold')
  })
})
