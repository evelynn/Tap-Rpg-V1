// balance 싱글턴 스키마(CONTENT_SCHEMA §5.1). 모든 섹션과 섹션 안 키가 필수다(기본값 없음).
// 숫자는 코드가 아니라 이 데이터에서 읽는다. ID 참조는 ref로 선언해 V2 대상이 된다.
import { z } from 'zod'
import {
  END_KINDS,
  ENEMY_RANKS,
  EVENT_TRIGGERS,
  CHOICE_RISKS,
  ROOM_KINDS,
  SCENE_KINDS,
  SPECIALIZATIONS,
  STATS,
  activity,
  activityRisk,
  animationAction,
  condition,
  effMin,
  effectList,
  grade,
  id,
  int,
  journalTag,
  lifeStage,
  line,
  modifier,
  modifierTargets,
  nonNegInt,
  numRange,
  obj,
  posInt,
  range,
  ratio,
  ref,
  refRegistry,
  season,
  skill,
  slot,
  template,
  units,
  weather,
  weight,
  weightTable,
} from '../common'

// 판정 난이도 등급(check.dc_fixed·dc_step의 키, 발견 지점 dc.grade)
export const DC_GRADES = ['easy', 'normal', 'hard', 'very_hard', 'legend'] as const

// 사망 제안 규칙의 문맥(엔진이 사망 기록에서 계산, 07 §8.3)
export const DEATH_CTX = [
  'armor_tier_below_level_tier', 'effective_level_below_gate', 'potions_at_start_lte', 'serious_injuries_gte',
] as const

// record 모양 섹션에도 _note·_comment(문자열)를 허용한다(§2.3). 설명 키를 뺀 뒤 record로 검사한다.
// common.ts의 obj()는 strict 객체만 다루므로 여기서 감싼다(공통 골격 승격 후보).
function noted<T extends z.ZodType>(record: T) {
  return z.preprocess((v) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return v
    return Object.fromEntries(
      Object.entries(v).filter(([k, x]) => !((k === '_note' || k === '_comment') && typeof x === 'string')),
    )
  }, record)
}

const num = z.number()
const nonNeg = z.number().min(0) // 배수·계수
const div = z.number().positive() // 나눗수
const dcGrade = z.enum(DC_GRADES)
const enemyRank = z.enum(ENEMY_RANKS)
const roomKind = z.enum(ROOM_KINDS)
const endKind = z.enum(END_KINDS)
const ratioPair = z.tuple([ratio, ratio])
const ratioRange = ratioPair.refine(([lo, hi]) => lo <= hi, '범위 [최소, 최대]는 최소 ≤ 최대여야 한다')
const size = z.tuple([posInt, posInt])
const cost = obj({ base: nonNeg, per_level: nonNeg })
// 개수 → 가중치 표({"1": 70, "2": 30})
const countKey = z.string().regex(/^(0|[1-9]\d*)$/, '개수 키는 0 이상 정수 문자열이다')
const countWeights = z.record(countKey, weight)
// 문형 id(journal.family.childhood). ID_PATTERN에 점이 없어 ref('text')를 쓸 수 없다.
const textRef = z
  .string()
  .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, '문형 id 형식이 아니다')
  .register(refRegistry, { kind: 'text' })

// 판정 종류 1개(check_kinds의 값). dc.kind별 모양은 5.1 필드 규칙.
const dcSpec = z.discriminatedUnion('kind', [
  obj({ kind: z.literal('region'), offset: int.optional() }),
  obj({ kind: z.literal('fixed'), value: int }),
  obj({ kind: z.literal('event') }),
  obj({ kind: z.literal('enemy_ac') }),
  obj({ kind: z.literal('level_formula'), base: int, div, source: z.enum(['max_enemy_level', 'region_level']) }),
])

export const checkKindSchema = obj({
  name: z.string(),
  stat: z.enum([...STATS, 'weapon']),
  skill: skill.nullable(),
  partial: z.boolean(),
  partial_event_defined: z.boolean().optional(),
  dc: dcSpec,
  gate_add: int.optional(),
  luck_div: div.optional(),
  partial_effects: effectList.optional(),
  partial_mult: ratio.optional(),
  fail_effects: effectList.optional(),
})

// 정예·보스 배수(01 §5.1)와 반올림 방식
const rankMult = obj({ hp_mult: nonNeg, ac_add: int, hit_add: int, dmg_mult: nonNeg, xp_mult: nonNeg, coins_mult: nonNeg })
const rounding = z.enum(['round', 'ceil', 'floor'])

const actionSpec = obj({ sec: range, fatigue: int })
const restSpec = obj({ sec: range, fatigue_reset: z.boolean() })

const deathCtx = z.enum(DEATH_CTX)
const deathRule = z.discriminatedUnion('ctx', [
  obj({ ctx: deathCtx.extract(['armor_tier_below_level_tier']), text: template }),
  obj({ ctx: deathCtx.exclude(['armor_tier_below_level_tier']), value: int, text: template }),
])

// 위험 차 구간: 마지막 구간만 max를 생략하고, max는 오름차순
const riskBands = z
  .array(obj({ max: int.optional(), grade: activityRisk }))
  .min(1)
  .refine(
    (bands) =>
      bands.every((b, i) => (i === bands.length - 1) === (b.max === undefined)) &&
      bands.every((b, i) => i === 0 || b.max === undefined || b.max > bands[i - 1]!.max!),
    '위험 구간은 max 오름차순이고 마지막 구간만 max를 생략한다',
  )

// 장비 평가 가치표 target은 수정자 target 등록부에 있어야 한다
const evalTarget = z.string().superRefine((t, ctx) => {
  modifierTargets.lock()
  if (!modifierTargets.match(t)) ctx.addIssue({ code: 'custom', message: `알 수 없는 수정자 target: ${t}`, params: { rule: 'V3' } })
})

const economy = obj({
  tier_levels: z.array(range).min(1),
  tier_price: z.array(nonNegInt),
  slot_price_mult: z.record(slot, nonNeg),
  grade_price_mult: z.partialRecord(grade, nonNeg),
  tier_base: z.array(obj({ weapon_dmg: range, armor_ac: int, armor_hp: int })),
  grade_stats: z.record(grade, obj({ dmg_mult: nonNeg, hit: int, ac: int })),
  good_effect_chance: ratio,
  rare_effect_count: nonNegInt,
  named_rare_effect_count: nonNegInt,
  sell_ratio: ratio,
  maintenance_ratio: ratio,
  discount_cap: ratio,
  auto_buy_min_improvement: ratio,
  drops: z.record(id, obj({
    chance: ratio,
    grades: z.record(grade, weight),
    legendary_as: z.enum(['named_rare']).optional(),
  })),
  material_drop: z.record(enemyRank, ratio),
  carry_limits: z.record(id, nonNegInt),
  bankruptcy: obj({ coins_lt: nonNegInt, weapon_tier_gap_gte: posInt, or_potions_eq: nonNegInt }),
  aid: obj({
    end_coins: obj({ min: nonNegInt, inn_mult: nonNeg, potion_mult: nonNeg }),
    hunt_coin_mult: nonNeg,
    issue_items: z.partialRecord(slot, ref('item')),
  }),
  starting_kit: obj({
    coins: nonNegInt,
    consumables: z.record(ref('consumable'), posInt),
    items: z.array(ref('item')),
  }),
  shop_restock: z.enum(['season']),
  bag: obj({ auto_sell_rare_bag_gte: posInt, rare_sell_tier_gap: posInt, field_sell_ratio: ratio, pending_box_cap: nonNegInt }),
  drop_pick: obj({ local: weight, local_off_tier: weight, shop: weight }),
}).superRefine((e, ctx) => {
  // 장비 단계 수의 단일 출처는 tier_levels 길이
  const n = e.tier_levels.length
  if (e.tier_price.length !== n) ctx.addIssue({ code: 'custom', path: ['tier_price'], message: `tier_price 길이는 tier_levels 길이(${n})와 같아야 한다` })
  if (e.tier_base.length !== n) ctx.addIssue({ code: 'custom', path: ['tier_base'], message: `tier_base 길이는 tier_levels 길이(${n})와 같아야 한다` })
})

const specialization = obj({
  modifiers: z.array(modifier),
  activity_weight_add: z.partialRecord(activity, int),
  skill_use_mult: z.partialRecord(skill, nonNeg),
  growth: obj({ primary: z.enum(STATS), secondary: z.enum(STATS) }),
  eval_armor_add: num,
})

const appearanceWeights = weightTable(['parent', 'partner', 'random'])

export const balanceSchema = obj({
  id: z.literal('balance'),
  time: obj({
    min_per_year: effMin,
    season_min: effMin,
    start_age: posInt,
    base_retire_age: posInt,
    day_night_ratio: ratioPair,
    season_order: z.array(season).min(1),
  }),
  weather: obj({
    season_weights: z.record(season, z.record(weather, weight)),
    effects: z.record(weather, z.array(modifier)),
  }),
  actions: obj({
    hunt_encounter: actionSpec,
    pair_encounter: actionSpec,
    adventure_scene: actionSpec,
    dungeon_room: actionSpec,
    gate: actionSpec,
    breather: actionSpec,
    travel_leg: actionSpec,
    inn: restSpec,
    guild_lodging: restSpec,
    town_prep: actionSpec,
    potion_sec: nonNegInt,
    light_treatment_sec: nonNegInt,
    dungeon_retreat_sec_per_room: nonNegInt,
  }),
  stats: obj({
    birth_base: nonNegInt,
    birth_points: nonNegInt,
    birth_cap: posInt,
    natural_cap: posInt,
    growth_levels: z.array(posInt),
    luck: obj({ rare_drop_per_point: ratio, rare_drop_cap: ratio, fortune_per_point: ratio }),
    derived: obj({ hp_base: nonNegInt, hp_per_level: nonNegInt, hp_per_str: nonNegInt, ac_base: int, ac_dex_div: div, damage_stat_div: div }),
    fatigue: obj({ max: posInt, penalty_at: nonNegInt, penalty_check_all: int, exhaust_at: posInt }),
    bag_slots: posInt,
    trait_caps: obj({ innate: nonNegInt, acquired: nonNegInt }),
  }),
  growth: obj({
    birth_weights: obj({ base: weight, luk: weight }),
    trait_birth_add: weight,
    parent_best_add: weight,
    use_points: obj({
      combat: nonNeg,
      miss_streak: obj({ count: posInt, points: nonNeg }),
      check: nonNeg,
      event_check: nonNeg,
      injury_or_final: nonNeg,
      trade_return: nonNeg,
      natural_20_luck: nonNeg,
    }),
    decay: ratio,
    alloc: obj({
      use_w: ratio,
      spec_w: ratio,
      primary: ratio,
      secondary: ratio,
      luck: obj({ base: ratio, per_point: ratio, cap: ratio }),
      floor: ratio,
    }),
  }),
  reference_character: obj({
    main_stat_start: posInt,
    stat_up_levels: z.array(posInt),
    melee_rank_levels: z.array(posInt),
    // 판정 종류별 레벨 구간 보정 표(01 §2.4 기준 인물, D46)
    check_bonus: z.record(ref('check_kind'), z.array(obj({ from_level: posInt, value: int })).min(1)),
  }),
  aging: obj({
    life_stages: z.array(obj({ id: lifeStage, from_age: posInt })).min(1),
    milestones: z.array(obj({
      age: posInt,
      every_years: posInt.optional(),
      stat_add: z.partialRecord(z.enum(STATS), int),
      floor: int.optional(),
    })),
    recovery_coef: z.array(obj({ from_age: posInt, value: nonNeg })).min(1),
  }),
  skills: obj({
    rank_thresholds: z.array(posInt),
    max_rank: posInt,
    use_counts: obj({
      combat: nonNegInt,
      elite_gate_combat: nonNegInt,
      boss_combat: nonNegInt,
      natural_20: nonNegInt,
      attack_event_check: nonNegInt,
      mobility_check: nonNegInt,
      miss_streak: obj({ count: posInt, uses: nonNegInt }),
      search_check: nonNegInt,
      scene_or_chest: nonNegInt,
      camp: nonNegInt,
      survival_check: nonNegInt,
      safe_return: nonNegInt,
      negotiation_check: nonNegInt,
      trade_return: nonNegInt,
    }),
  }),
  xp: obj({
    target_min: obj({ base: num, amp: num, tau: num, linear: num }),
    prod_rate: ratio,
    req_round: posInt,
    req_min: posInt,
    max_level: posInt,
    encounter_base: obj({ flat: num, per_level: num }),
    rank_mult: z.record(enemyRank, nonNeg),
    activity_mult: obj({ hunt: nonNeg, adventure: nonNeg, dungeon_room: nonNeg }),
    dungeon_noncombat_mult: nonNeg,
    overlevel_decay: obj({ free_gap: nonNegInt, per_level: ratio, floor: ratio }),
  }),
  check: obj({
    mod_cap: range,
    trait_mod_cap: nonNegInt,
    dc_fixed: z.record(dcGrade, int),
    dc_step: z.record(dcGrade, int),
    region_dc_base: int,
    region_dc_div: div,
    partial_margin: nonNegInt,
    crit: posInt,
    fumble: posInt,
    opposed_base: int,
    success_p_clamp: ratioRange,
    partial_p_bonus: ratio,
    fumble_table: z.array(obj({ weight, effects: effectList, line })).min(1),
  }),
  // 키가 check_kind 이름공간을 정의한다
  check_kinds: noted(z.record(id, checkKindSchema)),
  combat: obj({
    max_rounds: obj({ normal: posInt, elite_gate: posInt, boss_gate: posInt }),
    stalemate_xp_ratio: ratio,
    crit_mult: nonNeg,
    fumble_enemy_bonus: int,
    ambush: obj({ chance: ratio, night_add: ratio, fail_enemy_hit_add: int }),
    flee: obj({ hp_ratio_mult: nonNeg, fail_enemy_hit_add: int }),
    night: obj({
      enemy_level_add: int,
      risk_add: int,
      modifiers: z.array(modifier),
      sight_checks: z.array(ref('check_kind')),
      sight_penalty: int,
    }),
    gate_potion: obj({ hp_ratio_lte: ratio, uses: nonNegInt }),
    dungeon_room_level_div: div,
  }),
  enemy_formula: obj({
    normal: obj({
      hp: obj({ base: num, per_level: num }),
      ac: obj({ base: num, div }),
      hit: obj({ base: num, div }),
      dmg_min: obj({ base: num, div }),
      dmg_max: obj({ base: num, div }),
      xp: obj({ base: num, per_level: num }),
      coins: obj({ base: num, per_level: num, growth: nonNeg }),
    }),
    elite: rankMult,
    boss: rankMult,
    rounding: obj({ base: rounding, hp_mult: rounding, dmg_mult: rounding, xp_coins_mult: rounding }),
  }),
  recovery: obj({
    breather_hp_ratio: ratio,
    camp: obj({ sec: nonNegInt, hp_ratio: ratio, fatigue: int, no_ration_mult: nonNeg }),
    inn: obj({ hp_ratio: ratio, cost, max_times: posInt }),
    lodging: obj({ hp_ratio: ratio, max_times: posInt }),
    town_rest_when: obj({ hp_ratio_lt: ratio, fatigue_gt: nonNegInt }),
    rest_point: obj({ sec: nonNegInt, hp_ratio: ratio, fatigue: int }),
  }),
  injury: obj({
    light_cap: nonNegInt,
    light: obj({ stat_add: int, heal_min: effMin, cost }),
    serious: obj({ stat_add: int, cost, clinic_min: effMin, free_min: effMin }),
  }),
  defeat: obj({
    coin_loss_ratio: ratio,
    material_loss_ratio: ratio,
    item_loss_count: nonNegInt,
    return_travel_mult: nonNeg,
    arrive_hp_ratio: ratio,
    // R01 방울 탈출의 부상 판정 보정(08 §3.5 "부상 판정 +5"). 칸이 없으면 보정 없음
    escape_injury_add: int.optional(),
    // 키 = rescuer_table 이름공간
    rescuers: z.record(id, z.array(obj({ id, weight, line })).min(1)),
    // 키 = rescuer 이름공간(rescuer_override가 가리킴)
    rescuer_lines: z.record(id, line),
    death_suggestions: obj({ max: nonNegInt, rules: z.array(deathRule) }),
  }),
  risk: obj({ bands: riskBands, gear_level_per_tier: int }),
  economy,
  equip_eval: obj({
    v_cap: ratio,
    main_activity_window: posInt,
    max_swaps: nonNegInt,
    value_table: z.array(obj({
      target: evalTarget,
      unit: num.refine((v) => v !== 0, 'unit은 0이 아니어야 한다'),
      value: num,
      mults: z.array(obj({ when: condition, mult: nonNeg })),
    })),
  }),
  inheritance: obj({
    relic_designations_max: nonNegInt,
    relics_passed: z.record(endKind, nonNegInt),
    coin_ratio: z.record(endKind, ratio),
    coin_cap: nonNegInt,
    trait_inherit: obj({ max: nonNegInt, from_parent_max: nonNegInt, chance_positive: ratio, chance_negative: ratio }),
    retiree_visible_until_heir_age: posInt,
    lifespan: obj({ extend_cap: posInt }),
    early_retire: obj({ min_age: posInt, confirm_below: posInt }),
    household_age: range,
    family_forms: obj({ spouse: weight, partner: weight, co_parenting: weight }),
    partner_trait_count: countWeights,
    collateral: obj({ count_weights: countWeights, no_sibling_chance: ratio }),
    adoption: obj({ count_weights: countWeights, disciple_ratio: ratio }),
    sibling_trait_share: ratio,
    appearance: obj({
      direct: obj({ hair: appearanceWeights, eyes: appearanceWeights }),
      collateral: obj({ hair: appearanceWeights }),
    }),
    parent_call: obj({
      options: z.array(obj({ text: z.string(), weight, collateral: z.string() })).min(1),
      adopted: obj({ text: z.string(), chance: ratio }),
    }),
    time_jump_min: effMin,
    fallback_guardian_npc: ref('npc'),
    relic_notice_age: posInt,
    relic_score: obj({
      grade: z.record(grade, nonNeg),
      unique_add: num,
      tier_mult: num,
      story: obj({ worn_min_div: div, worn_cap: nonNeg, record_cap: nonNeg }),
      tie_slot_order: z.array(slot),
    }),
    chronicle_major: obj({ clamp: range, score_gte: num }),
    new_innate_count: z.record(countKey, countWeights),
    innate_reroll_max: nonNegInt,
    childhood: obj({ chance: ratio, max_per_life: nonNegInt, text_id: textRef }),
  }),
  events: obj({
    trigger_chance: z.partialRecord(z.enum(EVENT_TRIGGERS), ratio),
    chain_priority_chance: ratio,
    chain_town_stage_chance: ratio,
    min_gap_sec: nonNegInt,
    max_life_per_sortie: nonNegInt,
    diversity: obj({ recent_window: posInt, same_place_threshold: posInt, same_place_mult: nonNeg }),
    fortune_cap: ratio,
    reward: obj({ check_success_xp_units: units, crit_bonus_mult: nonNeg, fumble_fatigue: int }),
    default_hold_line: line,
    default_hold_animation: obj({ action: animationAction, props: z.array(ref('prop')).optional() }),
    quiet_room: obj({ fatigue: int, line }),
  }),
  choice_ai: obj({
    low_success_p: ratio,
    risk_map: z.record(z.enum(CHOICE_RISKS).exclude(['lethal']), activityRisk),
    reason_lines: obj({
      attitude: template,
      trait_changed: template,
      trait_confirmed: template,
      risk_blocked: template,
      no_option: template,
    }),
    trait_confirm_min_bonus: int,
  }),
  activity_ai: obj({
    filters: obj({ dungeon_block_light_injuries: posInt, no_potion_max_risk: activityRisk }),
    dungeon_fit_max_risk_diff: int,
    // 초 값 하나 또는 [최소, 최대]
    town_routine_sec: z.record(
      z.enum(['arrive', 'light_treat_each', 'sell', 'supplies', 'gear', 'maintenance', 'family', 'depart']),
      z.union([nonNegInt, range]),
    ),
    town_idle_sec: range,
    repeat: obj({ free: nonNegInt, step: ratio, floor: ratio }),
    trait_sum_cap: range,
    mission: obj({ base: int, overdue_min: effMin, overdue_add: int, elder_mult: nonNeg, cap: int, priority_sorties: nonNegInt }),
    explore: obj({ unvisited: int, discovery_left: int }),
    life_stage_weight: z.partialRecord(lifeStage, z.partialRecord(activity, int)),
    location_score: obj({
      base: int,
      risk_diff_mult: num,
      chain_stage: int,
      unvisited: int,
      discovery_left: int,
      travel_div: div,
      trait_cap: range,
      pick_weights: z.array(weight).min(1),
    }),
    deficit: obj({ window: posInt, exclude_decisions: posInt, min_sorties: posInt, line }),
    camp: obj({ max_per_sortie: nonNegInt, max_elapsed_min: effMin }),
    potion_margin: ratio,
    hunt: obj({ target_jitter: nonNegInt, safety_cap_encounters: posInt, safety_cap_min: effMin }),
    adaptation_returns: nonNegInt,
    low_cap_notice_streak: posInt,
    lines: obj({ low_cap: line, forced_nearby: line, lost_destination: line }),
    travel_time_floor: ratio,
  }),
  first_sortie: obj({
    when: condition,
    location: ref('region'),
    activity,
    encounters: posInt,
    guaranteed_drop: obj({ when: condition, encounter: posInt, item: ref('item'), grade }),
    guaranteed_event: obj({
      when: condition,
      after_encounter: posInt,
      event: ref('event'),
      choice: id, // 그 사건의 선택지 id(W1 교차 검사)
      reason: template,
    }),
  }),
  dungeon: obj({
    first_room_kinds: z.array(roomKind).min(1),
    no_repeat: z.array(roomKind),
    max_run: z.partialRecord(roomKind, posInt),
    treasure_guarantee_min_rooms: posInt,
    validate_loss_cap: ratio,
    retries: nonNegInt,
    room_coin_mult: nonNeg,
    loss_model: obj({
      combat_base: ratio,
      pair_mult: nonNeg,
      level_coef: num,
      level_clamp: numRange,
      trap_loss: ratio,
      event: ratio,
    }),
    gate_prep: obj({ hp_below: ratio, max_potions: nonNegInt }),
    chest: obj({
      locked: ratio,
      trapped: ratio,
      lock_tries: nonNegInt,
      coin_units: units,
      material: nonNegInt,
      trap_fail: effectList,
      break: obj({ check: ref('check_kind'), dc_offset: int, downgrade_chance: ratio }),
    }),
    vein: obj({ check: ref('check_kind'), coin_units: units, fail_units: units }),
    trap_flow: obj({ disarm_fail_evade_bonus: int, disarm_parts_units: units }),
    remnant: obj({ rank: enemyRank, level_div: div }),
  }),
  adventure: obj({
    scene_coin_units: units,
    discovery_xp_units: units,
    discovery: obj({ fail_bonus_step: int, fail_bonus_cap: int, notebook_dc_add: int, shifted_per_route: nonNegInt }),
    path: obj({
      check: ref('check_kind'),
      fail: effectList,
      detour_fatigue: int,
      success_next_scene: z.enum(SCENE_KINDS),
    }),
    forage: obj({ check: ref('check_kind'), coin_units: units, crit_potion: nonNegInt }),
    map: obj({ complete_modifiers: z.array(modifier) }),
  }),
  ui: obj({
    window: size,
    compact_window: size,
    detail_window: size,
    line_target: range,
    line_max: posInt,
    line_min_sec: nonNeg,
    important_line_sec: nonNeg,
    line_queue_max: posInt,
    name_len: range,
    family_name_len: range,
    journal_keep: posInt,
    recent_summary_keep: posInt, // 14 §1.1 최근 요약 보존 수(D77)
    last_chapter_keep: posInt,
  }),
  offline: obj({ cap_sec: posInt, min_sec: nonNegInt, autosave_sec: posInt, backups: nonNegInt }),
  // 키는 코드 열거 SPECIALIZATIONS(none 제외, DS-30)
  specializations: noted(z.record(z.enum(SPECIALIZATIONS).exclude(['none']), specialization)),
  policy_defaults: obj({
    attitude: ref('attitude'),
    reserve_custom_range: ratioRange,
    reserve_custom_default: ratio,
  }),
  life_stage_rules: noted(z.partialRecord(lifeStage, obj({
    chain_start: z.boolean(),
    event_journal_tag_mult: z.partialRecord(journalTag, nonNeg),
  }))),
})

export type Balance = z.infer<typeof balanceSchema>
