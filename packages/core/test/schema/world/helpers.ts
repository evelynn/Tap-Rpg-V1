// W2 테스트용 조건·효과 임시 등록(CONTENT_SCHEMA §9 "W2·W3 테스트의 조건·효과 등록").
// 파라미터는 §4.1·§4.2 표를 따른다. 첫 파싱 전에 부른다(node --test는 파일마다 프로세스가 따로다).
// 실제 W4 등록부로 같은 예시를 다시 검증하는 것은 합치기 3단계가 한다.
import assert from 'node:assert/strict'
import { z } from 'zod'
import {
  MUTATIONS,
  SPECIALIZATIONS,
  dice,
  effMin,
  effectList,
  exactlyOne,
  flagKey,
  grade,
  int,
  modifier,
  nonNegInt,
  obj,
  posInt,
  ratio,
  ref,
  regionFilter,
  regionKind,
  registerCondition,
  registerEffect,
  skill,
  stat,
  timeOfDay,
  units,
  condition,
} from '../../../src/schema/common'

export function registerTestVocabulary(): void {
  // 조건 단말(§4.1)
  registerCondition('level_gte', int)
  registerCondition('location', z.array(ref('region')))
  registerCondition('location_kind', z.array(regionKind))
  registerCondition('time_of_day', timeOfDay)
  registerCondition('attitude', z.array(ref('attitude')))
  registerCondition('has_trait', ref('trait'))
  registerCondition('trait_hook', z.string())
  registerCondition('skill_rank_gte', obj({ skill, rank: int }))
  registerCondition('guild_rank_gte', ref('guild_rank'))
  registerCondition('specialization', z.array(z.enum(SPECIALIZATIONS)))
  registerCondition('mutation', z.enum(MUTATIONS))
  registerCondition('discovered', ref('region'))
  registerCondition('discovery_found', ref('discovery'))
  registerCondition('defeated', ref('enemy'))
  registerCondition('policy', obj({ key: z.string(), value: z.union([z.boolean(), z.number(), z.string()]) }))
  registerCondition('in_town', z.boolean())
  registerCondition('first_sortie_of_family', z.boolean())
  registerCondition('first_sortie_of_character', z.boolean())
  registerCondition('safe_returns_gte', obj({ count: int, where: regionFilter.optional() }))
  registerCondition('combat_kind', z.array(z.enum(['normal', 'elite_gate', 'boss_gate'])))
  registerCondition('main_place', regionFilter)

  // 효과(§4.2)
  registerEffect('add_fatigue', { value: int })
  registerEffect('damage', { hp: posInt.optional(), hp_ratio: ratio.optional(), dice: dice.optional() }, '', exactlyOne('hp', 'hp_ratio', 'dice'))
  registerEffect('injury', { grade: z.enum(['light', 'serious']), stat: stat.optional() })
  registerEffect(
    'remove_coins',
    { amount: nonNegInt.optional(), units: units.optional(), ratio: ratio.optional(), sortie_income_ratio: ratio.optional() },
    '',
    exactlyOne('amount', 'units', 'ratio', 'sortie_income_ratio'),
  )
  registerEffect('remove_consumable', { carry_groups: z.array(ref('carry_group')), count: posInt })
  registerEffect('add_item', { item_id: ref('item'), grade: grade.optional(), to: z.enum(['bag', 'pending_box', 'bag_or_pending']) })
  registerEffect('add_trait', { trait_id: ref('trait') })
  registerEffect('set_family_flag', { key: flagKey('fam'), value: z.union([z.boolean(), int]).optional() })
  registerEffect('unlock_location', { location_id: ref('region') })
  registerEffect('add_time', { sec: posInt })
  registerEffect('sortie_mod', {
    remaining_add: obj({ encounters: int.optional(), scenes: int.optional() }).optional(),
    return_travel_sec_add: int.optional(),
    camp: obj({ hp_mult: z.number().optional(), fatigue_add: int.optional() }).optional(),
  })
  registerEffect('temp_mod', {
    modifier,
    scope: z.enum(['scene', 'next_scene', 'sortie', 'next_sortie', 'encounters', 'next_decision', 'eff_min', 'next_check', 'next_visit']),
    count: posInt.optional(),
    duration_min: effMin.optional(),
    location: z.string().optional(),
  })
  registerEffect('chance', { p: ratio, then: effectList, else: effectList.optional() })
  registerEffect('start_combat', {
    enemies: z.array(z.union([
      obj({ enemy_id: ref('enemy') }),
      obj({ by_location: z.record(ref('region'), ref('enemy')) }),
      obj({ from_region_table: z.literal(true) }),
    ])).min(1),
    count: z.union([posInt, z.array(obj({ when: condition, count: posInt }))]),
    sequential: z.boolean().optional(),
    first_strike: z.enum(['char', 'enemy', 'default']),
    ambush: z.boolean().default(false),
    pre_check: obj({ kind: ref('check_kind'), dc_offset: int, on_fail: z.array(modifier) }).optional(),
    reward_mult: z.number().optional(),
    on_win: effectList.optional(),
    on_defeat: effectList.optional(),
    on_stalemate: effectList.optional(),
  })
}

// 통과를 확인하고 파싱 결과를 돌려준다. 실패하면 이슈 목록을 보여 준다.
export function expectOk<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value)
  assert.ok(r.success, r.success ? '' : JSON.stringify(r.error.issues, null, 2))
  return r.data
}

// 실패를 확인하고 이슈 경로를 '.'으로 이은 문자열 목록을 돌려준다.
export function expectFail(schema: z.ZodType, value: unknown): string[] {
  const r = schema.safeParse(value)
  assert.ok(!r.success, '실패해야 하는데 통과했다')
  return r.error.issues.map((i) => i.path.join('.'))
}

export function clone<T>(v: T): T {
  return structuredClone(v)
}
