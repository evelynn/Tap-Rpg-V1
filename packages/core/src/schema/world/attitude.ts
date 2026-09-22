// 태도 스키마(CONTENT_SCHEMA §5.2). id는 ref('attitude') 대상이다.
import { z } from 'zod'
import { activity, activityRisk, choiceTag, condition, def, int, nonNegInt, obj, posInt, range, ratio, ref, weight } from '../common'

export const attitudeSchema = def({
  name: z.string(),
  reason_label: z.string(),
  order: int,
  activity_weights: z.record(activity, weight),
  retreat_hp: ratio,
  return_fatigue: nonNegInt,
  max_risk: activityRisk,
  max_risk_adventure: activityRisk.nullish(),
  dungeon_depth_offset: int,
  gate_risk_limit: int,
  lethal_gate_risk_limit: int,
  gate_hp_ratio: ratio,
  potion_reserve_n: nonNegInt,
  dungeon_safety_k: z.number().min(0),
  buy_targets: z.record(ref('carry_group'), nonNegInt),
  bandage_use_at: nonNegInt,
  eval_mult: obj({ weapon: z.number().min(0), armor: z.number().min(0) }),
  light_treat: obj({ min_injuries: posInt, if_dungeon_candidate: z.boolean() }),
  reserve_ratio: ratio,
  hunt_target_encounters: posInt,
  adventure_scenes: range,
  location_target_risk: int,
  fit_coef: obj({ very_low: ratio, low: ratio, normal: ratio, high: ratio, high_adventure: ratio.optional() }),
  retreat_camp: z.boolean(),
  shortcut: obj({ chance: ratio, force_when: condition.optional() }),
  disarm_when: condition,
  chest_break: z.boolean(),
  tag_scores: z.record(choiceTag, int),
  medium_risk_penalty: int,
  low_success_penalty: int,
  event_pref_line: z.string(),
})

export type Attitude = z.infer<typeof attitudeSchema>
