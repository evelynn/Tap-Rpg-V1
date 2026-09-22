// 난수·오프라인·방침(16 §5.8·§5.9)과 저장 루트(16 §5.1, C1). 저장·불러오기 절차는 T11 몫이다.
import { z } from 'zod'
import { RNG_STREAMS } from '../rng/index'
import type { Content } from '../content/index'
import { characterSchema } from './character'
import { currentActivitySchema, pendingChoiceSchema } from './activity'
import { defId, effMinV, intV, nat, s, utcMs } from './common'
import { familySchema } from './family'
import { inventorySchema, itemInstanceSchema } from './inventory'
import { journalEntrySchema } from './journal'

const hex16 = z.string().regex(/^[0-9a-fA-F]{16}$/)

export const rngStateSchema = s({
  algorithm: z.literal('pcg32'),
  streams: z.record(z.enum(RNG_STREAMS), s({ state: hex16, inc: hex16 })),
})

export const offlineStateSchema = s({
  high_water_utc: utcMs,
  last_exit_utc: utcMs,
  last_settlement: s({
    absent_sec: nat,
    settled_min: effMinV,
    stop_reason: z.string(),
    from_age: intV,
    to_age: intV,
    summary: z.record(z.string(), z.number()),
  }).nullable(),
  clock_anomalies: z.array(s({
    kind: z.enum(['backward', 'forward_jump']),
    now: utcMs,
    hw: utcMs,
    absent: nat.optional(),
  })).max(20),
})

export const policiesSchema = s({
  attitude: defId,
  reserve_mode: z.enum(['attitude_default', 'custom']),
  reserve_custom: z.number().min(0).max(1),
  risk_cap: z.enum(['attitude_default', 'low', 'normal', 'high']),
  lethal_allowed: z.boolean(),
  lethal_scope: s({ gate_battles: z.boolean(), fate_choices: z.boolean() }),
  fate_handling: z.enum(['hold', 'decline_and_continue']),
  auto_specialization: z.enum(['none', 'combat_first', 'search_first', 'higher_skill']),
  auto_equip: z.boolean(),
  destination: defId, // "auto" 또는 장소 id
  destination_warning_ack: z.boolean(),
  family_formation: z.boolean(),
  auto_succession: z.boolean(),
  offline_progress: z.boolean(),
  stage_boundary_stop: z.boolean(),
  lethal_warning_dismissed: z.boolean(),
})
export type Policies = z.infer<typeof policiesSchema>

// 16 §5.9 기본값. 콘텐츠 ID·수치(태도, 사용자 지정 예약금)는 balance.policy_defaults에서 읽는다
export function defaultPolicies(content: Content): Policies {
  const d = content.balance.policy_defaults
  return {
    attitude: d.attitude,
    reserve_mode: 'attitude_default',
    reserve_custom: d.reserve_custom_default,
    risk_cap: 'attitude_default',
    lethal_allowed: false,
    lethal_scope: { gate_battles: true, fate_choices: false },
    fate_handling: 'hold',
    auto_specialization: 'none',
    auto_equip: true,
    destination: 'auto',
    destination_warning_ack: false,
    family_formation: true,
    auto_succession: false,
    offline_progress: true,
    stage_boundary_stop: true,
    lethal_warning_dismissed: false,
  }
}

export const saveBodySchema = s({
  family: familySchema,
  character: characterSchema.nullable(), // 계승 대기 중에는 null
  inventory: inventorySchema,
  item_instances: z.record(z.string(), itemInstanceSchema),
  journal: z.array(journalEntrySchema),
  pending_choice: pendingChoiceSchema.nullable(),
  current_activity: currentActivitySchema,
  rng_state: rngStateSchema,
  offline_state: offlineStateSchema,
  policies: policiesSchema,
})
export type SaveBody = z.infer<typeof saveBodySchema>

export const saveHeaderSchema = s({
  schema_version: intV.min(1),
  app_version: z.string(),
  saved_at_utc: utcMs,
  checksum: z.string(),
  encoding: z.enum(['json', 'gzip']),
  content_packs: z.array(s({ id: z.string(), version: z.string() })), // C1
  content_hash: z.string(),
})

export const saveRootSchema = s({ header: saveHeaderSchema, body: saveBodySchema })
export type SaveRoot = z.infer<typeof saveRootSchema>
