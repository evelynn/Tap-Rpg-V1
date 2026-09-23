// 인물(16 §5.4) + CONTENT_SCHEMA §6의 C3~C8·C15~C17·C19~C24.
// 나이·생애 단계·최대 체력·방어·명중은 저장하지 않고 계산한다.
import { z } from 'zod'
import {
  ACTIVITIES, FAMILY_ROLES, INJURY_GRADES, SEASONS, SKILLS, SPECIALIZATIONS, STATS, TIME_OF_DAY,
} from '../schema/index'
import {
  defId, effMinV, flagValue, intV, nat, s, savedEffect, scopedFlagKey, statRecord, tempModSchema, uid,
} from './common'

export const appearanceSchema = s({
  body: z.string(),
  hair: z.string(),
  hair_color: z.string(),
  skin_tone: z.string(),
  decor: z.array(z.string()),
  age_stage_override: z.string().nullable(),
})
export type Appearance = z.infer<typeof appearanceSchema>

// source: parent / other_parent / new / acquired. inactive = 활성 목록에서 빠짐(replaced: TA07이 TI07 대체,
// displaced: 후천 6 초과로 밀려난 누적형, 06 §1.1). 출생 기록 유전(12 §3.2)을 위해 지우지 않는다
export const characterTraitSchema = s({
  id: defId,
  since_age: intV,
  source: z.enum(['parent', 'other_parent', 'new', 'acquired']),
  inactive: z.enum(['replaced', 'displaced']).optional(),
})
export type CharacterTrait = z.infer<typeof characterTraitSchema>

export const characterSchema = s({
  uid,
  name: z.string(),
  generation: intV.min(1),
  family_role: z.enum(FAMILY_ROLES),
  parent_uid: uid.nullable(),
  parent_call: z.string().nullable(),
  background: defId,
  appearance: appearanceSchema,
  birth_season: z.enum(SEASONS),
  birth_stats: statRecord,
  stats: statRecord, // 현재 원값(나이 보정 포함, 장비·특성 제외)
  stat_growth: z.array(s({ level: intV, stat: z.enum(STATS) })),
  life_stat_mods: z.array(s({ stat: z.enum(STATS), value: intV, source: z.string() })),
  stat_use_points: z.record(z.enum(STATS), z.number().min(0)), // C21 사용 점수 U
  level: intV.min(1),
  xp: nat, // 현재 레벨 안에서의 값
  skills: z.record(z.enum(SKILLS), s({ uses: z.number().min(0), rank: nat })), // 전문화 배수로 소수 누적
  traits: z.array(characterTraitSchema),
  injuries: z.array(s({ grade: z.enum(INJURY_GRADES), stat: z.enum(STATS), remaining_min: effMinV, source: z.string() })),
  hp: intV,
  fatigue: nat,
  eff_min: effMinV,
  retire_age: intV,
  lifespan_extended: z.boolean(),
  specialization: z.enum(SPECIALIZATIONS),
  f01_presentations: nat,
  spec_deferred_until_level: intV.nullable(),
  mutation: s({ trait_id: defId, since_age: intV, long_sleep_age: intV, thirst: z.number().min(0) }).nullable(), // 갈증: 분당 증가를 소수로 누적(I73)
  guild_rank: defId,
  coins: nat,
  location: defId,
  counters: z.record(z.string(), nat),
  counters_at: z.record(z.string(), z.record(defId, nat)), // C15 장소별 카운터
  flags: z.record(scopedFlagKey('life'), flagValue),
  temp_mods: z.array(tempModSchema),
  quest: s({
    event_id: defId,
    location_id: defId,
    enemy_id: defId,
    goal_wins: intV.min(1),
    wins: nat,
    reward: s({ coin_units: z.number().min(0), xp_units: z.number().min(0) }),
    accepted_eff_min: effMinV,
    deadline: z.literal('next_sortie'),
  }).nullable(),
  event_counts: z.record(defId, nat),
  event_last_min: z.record(defId, effMinV),
  recent_life_events: z.array(defId),
  event_pity: z.record(defId, nat), // C16
  npc_relations: z.record(defId, intV.min(-100).max(100)),
  visited: z.array(defId),
  defeated: z.array(defId),
  children: z.array(uid), // family.candidates의 uid(C10)
  heir_preferred: uid.nullable(),
  attitude_log: z.array(s({ eff_min: effMinV, attitude: defId })),
  last_trip_time: z.enum(TIME_OF_DAY).nullable(), // C3
  guild_aid: s({ active: z.boolean(), started_eff_min: effMinV.nullable(), recovered: z.boolean() }), // C4
  scheduled_events: z.array(s({
    event_id: defId,
    at: z.enum(['next_town_return', 'next_camp', 'eff_min']),
    due_eff_min: effMinV.nullable(),
  })), // C5
  shop_discounts: z.array(s({
    ratio: z.number().min(0).max(1),
    uses_left: intV.min(1),
    facility: defId.nullable(),
    expires_eff_min: effMinV.nullable(),
  })), // C6
  next_visit_mods: z.record(defId, z.array(savedEffect)), // C7 장소별 대기 dungeon_mod·temp_mod
  line_variant_last: z.record(defId, nat), // C8
  discoveries: z.array(defId), // C17
  map_fragments: z.array(defId),
  discovery_fail_bonus: z.record(defId, nat),
  chain_mission: z.record(defId, s({ priority_sorties: nat, pending_since_eff_min: effMinV.nullable() })), // C19
  deficit: z.record(defId, s({ recent_net: z.array(intV), excluded_until_decision: nat.nullable() })), // C20
  decision_seq: nat,
  miss_streak: nat, // C22
  activity_streak: s({ activity: z.enum(ACTIVITIES), k: intV.min(1) }).nullable(), // C23
  low_cap_streak: nat, // C24
})
export type Character = z.infer<typeof characterSchema>
