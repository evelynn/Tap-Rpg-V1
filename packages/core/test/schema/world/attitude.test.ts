import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { attitudeSchema } from '../../../src/schema/world/index'
import { clone, expectFail, expectOk, registerTestVocabulary } from './helpers'

registerTestVocabulary()

// CONTENT_SCHEMA §5.2 표의 모험적 값
const adventurous = {
  id: 'adventurous', name: '모험적', reason_label: '모험적', order: 1,
  activity_weights: { hunt: 30, adventure: 45, dungeon: 25 },
  retreat_hp: 0.4, return_fatigue: 70, max_risk: 'normal', max_risk_adventure: 'high',
  dungeon_depth_offset: 0, gate_risk_limit: 2, lethal_gate_risk_limit: -1,
  gate_hp_ratio: 0.7, potion_reserve_n: 1, dungeon_safety_k: 1.3,
  buy_targets: { potion: 3, ration: 2, bandage: 1, moon_wine: 2 },
  bandage_use_at: 2, eval_mult: { weapon: 1.0, armor: 1.0 },
  light_treat: { min_injuries: 2, if_dungeon_candidate: true },
  reserve_ratio: 0.3, hunt_target_encounters: 10, adventure_scenes: [4, 5], location_target_risk: 0,
  fit_coef: { very_low: 0.6, low: 0.9, normal: 1.0, high: 0.8, high_adventure: 0.8 },
  retreat_camp: false,
  shortcut: { chance: 0.5, force_when: { any: [{ trait_hook: 'prefer_shortcut' }, { skill_rank_gte: { skill: 'mobility', rank: 2 } }] } },
  disarm_when: { any: [{ skill_rank_gte: { skill: 'search', rank: 2 } }, { trait_hook: 'attempt_disarm' }] },
  chest_break: false,
  tag_scores: { safe: 1, thrift: 1, rest: 1, kindness: 2, info: 3, new_path: 3, reward: 2, bold: 1 },
  medium_risk_penalty: 0, low_success_penalty: -1,
  event_pref_line: '정보·새 길',
}

describe('attitude', () => {
  it('5.2 모험적 예시가 통과한다', () => {
    expectOk(attitudeSchema, adventurous)
  })

  it('max_risk_adventure는 null도 받는다(안정적·도전적)', () => {
    expectOk(attitudeSchema, { ...adventurous, id: 'stable', max_risk_adventure: null })
  })

  it('16의 옛 필드 potion_target은 모르는 필드다(DS-11)', () => {
    expectFail(attitudeSchema, { ...adventurous, potion_target: 3 })
  })

  it('tag_scores는 선택지 태그 전부가 필요하다', () => {
    const a = clone(adventurous) as Record<string, any>
    delete a.tag_scores.bold
    assert.deepEqual(expectFail(attitudeSchema, a), ['tag_scores.bold'])
  })

  it('활동 위험 등급 오타, 조건 단말 키 2개', () => {
    const a = clone(adventurous) as Record<string, any>
    a.max_risk = 'medium'
    a.disarm_when = { trait_hook: 'attempt_disarm', in_town: true }
    const paths = expectFail(attitudeSchema, a)
    assert.ok(paths.includes('max_risk'), paths.join())
    assert.ok(paths.includes('disarm_when'), paths.join())
  })
})
