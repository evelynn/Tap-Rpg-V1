import { assertIssue, assertValid, edit } from './setup'
import { describe, it } from 'node:test'
import {
  achievementSchema, backgroundSchema, descendantReactionSchema, epithetSchema, propSchema, retireRoleSchema,
} from '../../../src/schema/entity/index'

describe('background (12 §8.1)', () => {
  const river = { id: 'bg_river', name: '여울의 아이', start_skill: null, fixed_stat: null, unlock: null, intro_line: '여울가 풀밭에서 뛰놀며 자랐다.' }
  const inn = {
    id: 'bg_inn', name: '여관집 아이', start_skill: 'negotiation', fixed_stat: 'soc', unlock: { achievement: 'AC10' },
    intro_line: "'도토리 모자' 부엌에서 손님 이야기를 들으며 자랐다.",
  }
  it('처음부터 해금·업적 해금 통과', () => {
    assertValid(backgroundSchema, river)
    assertValid(backgroundSchema, inn)
  })
  it('null 필드는 생략하지 않고 null로 적는다', () => {
    assertIssue(backgroundSchema, edit(river, { unlock: undefined }), 'unlock')
  })
  it('모르는 숙련·능력치는 실패', () => {
    assertIssue(backgroundSchema, edit(inn, { start_skill: 'cooking' }), 'start_skill')
    assertIssue(backgroundSchema, edit(inn, { fixed_stat: 'cha' }), 'fixed_stat')
  })
})

describe('achievement (12 §8.4)', () => {
  const cases: [string, unknown, unknown[]][] = [
    ['AC01', { all: [{ discovered: 'H1' }, { discovered: 'H2' }, { discovered: 'H3' }, { discovered: 'A1' }] }, [{ kind: 'start_option', id: 'birth_season' }]],
    ['AC02', { all: [{ visited: 'D1' }, { visited: 'D2' }, { visited: 'D3' }] }, [{ kind: 'family_tab', id: 'mine_section' }]],
    ['AC09', { codex_count_gte: { codex: 'items', count: 13 } }, [{ kind: 'background', id: 'bg_smithy' }]],
    ['AC10', { num: { key: 'family_counter.inn_rests', op: '>=', value: 100 } }, [{ kind: 'background', id: 'bg_inn' }]],
    ['AC11', { defeated: 'EB03' }, [{ kind: 'title', text: '종지기의 가문' }, { kind: 'appearance', id: 'bell_pin' }]],
    ['AC13', { age_gte: 78 }, [{ kind: 'appearance', id: 'starsleep_silver' }]],
    ['AC15', { codex_complete: 'enemies' }, [{ kind: 'family_tab', id: 'enemy_art' }]],
    ['AC16', { discovery_found: 'A4-6' }, [{ kind: 'title', text: '길을 본 자' }]],
    ['AC17', { num: { key: 'counter.map_fragments', op: '>=', value: 8 } }, [{ kind: 'family_tab', id: 'full_map' }]],
  ]
  for (const [id, condition, rewards] of cases) {
    it(`${id} 통과`, () => assertValid(achievementSchema, { id, name: id, condition, rewards }))
  }
  const ac = { id: 'AC13', name: '긴 삶', condition: { age_gte: 78 }, rewards: [], line: '{name:이/가} 일흔여덟 번째 봄을 맞았다.' }
  it('line 선택, 보상 판별자 검사', () => {
    assertValid(achievementSchema, ac)
    assertIssue(achievementSchema, edit(ac, { rewards: [{ kind: 'coins', amount: 100 }] }), 'rewards.0.kind')
    assertIssue(achievementSchema, edit(ac, { rewards: [{ kind: 'start_option', id: 'free_stats' }] }), 'rewards.0.id')
  })
  it('조건 키가 2개면 V3', () => {
    assertIssue(achievementSchema, edit(ac, { condition: { age_gte: 78, visited: 'D1' } }), 'condition', 'V3')
  })
})

describe('epithet (12 §7.5)', () => {
  it('1·8·15순위 예시 통과', () => {
    assertValid(epithetSchema, {
      id: 'ep_moon_cup', priority: 1,
      condition: { all: [{ mutation: 'vampire' }, { received_relic: 'R04' }] },
      template: '{parent_call}의 잔을 비운 {name}',
    })
    assertValid(epithetSchema, {
      id: 'ep_deep_sleep', priority: 8,
      condition: { all: [{ life_end_kind: ['died'] }, { died_at: { ids: ['D3'] } }] },
      template: '심층에 잠든 {name}',
    })
    assertValid(epithetSchema, { id: 'ep_river', priority: 15, condition: true, template: '여울의 {name}' })
  })
  it('템플릿 문법 오류는 V5, 빈 거르개는 실패', () => {
    assertIssue(epithetSchema, { id: 'ep_x', priority: 2, condition: true, template: '달그늘의 {name' }, 'template', 'V5')
    assertIssue(epithetSchema, { id: 'ep_x', priority: 2, condition: { died_at: {} }, template: 'x' }, 'condition.died_at')
  })
})

describe('retire_role (09 §4.1)', () => {
  const instructor = {
    id: 'instructor', name: '길드 교관', base_points: 0,
    score: [
      { when: { skill_rank_gte: { skill: 'melee', rank: 4 } }, points: 1 },
      { when: { has_trait: 'TA05' }, points: 2 },
      { when: { specialization: ['guardian'] }, points: 1 },
      { when: { defeated: 'EB02' }, points: 1 },
    ],
    tie_winner: false,
    heir_modifiers: [],
    heir_events: ['S07-T1', 'S07-T2'],
    letter_gift: [],
    until_heir_age: 30,
    family_flag: 'fam.retired_instructor',
  }
  const inn = {
    ...instructor, id: 'inn', name: '길드 앞 작은 여관 주인',
    score: [{ when: { has_trait: 'TA04' }, points: 2 }],
    heir_modifiers: [{ target: 'inn_cost_mult', op: 'mul', value: 0.5 }],
    heir_events: [], family_flag: 'fam.retired_inn',
  }
  const letters = {
    ...instructor, id: 'letters', name: '편지를 보내는 가족', base_points: 1,
    score: [{ when: { age_gte: 60 }, points: 1 }],
    tie_winner: true, heir_events: [],
    letter_gift: [{
      type: 'chance', p: 0.5,
      then: [{ type: 'add_consumable', consumable_id: 'CP06', count: 2 }],
      else: [{ type: 'add_consumable', consumable_id: 'CP01', count: 1 }],
    }],
    family_flag: 'fam.retired_letters', fallback_name: '길드에 이름을 남긴 선배',
  }
  it('교관·여관 주인·편지 가족 통과', () => {
    assertValid(retireRoleSchema, instructor)
    assertValid(retireRoleSchema, inn)
    assertValid(retireRoleSchema, letters)
  })
  it('family_flag는 fam. 범위만', () => {
    assertIssue(retireRoleSchema, edit(instructor, { family_flag: 'life.retired_instructor' }), 'family_flag')
  })
  it('letter_gift 효과 문법(V4)', () => {
    assertIssue(retireRoleSchema, edit(letters, { letter_gift: [{ type: 'no_such_effect' }] }), 'letter_gift.0.type')
    assertIssue(retireRoleSchema, edit(letters, { letter_gift: [{ type: 'add_consumable', count: 1 }] }), 'letter_gift.0', 'V4')
  })
})

describe('descendant_reaction (12 §7.6)', () => {
  const dr = {
    id: 'dr_c01_rescue', flag: 'fam.c01_rescue', window_generations: 3,
    events: ['C01-FAM-THANKS'], npc: 'N05', summary: '감사의 식탁',
  }
  it('예시·영구·키 묶음 플래그 통과', () => {
    assertValid(descendantReactionSchema, dr)
    assertValid(descendantReactionSchema, edit(dr, { window_generations: 'permanent', npc: undefined }))
    assertValid(descendantReactionSchema, edit(dr, { id: 'dr_death', flag: 'fam.death_{place}', window_generations: 1, npc: undefined }))
  })
  it('기간 0·life. 플래그는 실패', () => {
    assertIssue(descendantReactionSchema, edit(dr, { window_generations: 0 }), 'window_generations')
    assertIssue(descendantReactionSchema, edit(dr, { flag: 'life.c01_rescue' }), 'flag')
  })
})

describe('prop', () => {
  it('통과, asset_id 필수', () => {
    assertValid(propSchema, { id: 'book', name: '책', asset_id: 'prop_book' })
    assertIssue(propSchema, { id: 'book', name: '책' }, 'asset_id')
  })
})
