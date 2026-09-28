// 가문(16 §5.3) + CONTENT_SCHEMA §6의 C2·C10·C12·C14·C25와 가문 누적 카운터.
import { z } from 'zod'
import { END_KINDS, FAMILY_ROLES, GRADES, MUTATIONS, SEASONS, SPECIALIZATIONS } from '../schema/index'
import { appearanceSchema } from './character'
import { defId, effMinV, flagValue, intV, nat, s, scopedFlagKey, statRecord, uid, utcMs } from './common'

// 자녀·후계 후보(16 §5.4.2). 만들 때 모든 값을 확정해 저장한다
export const candidateSchema = s({
  uid,
  name: z.string(),
  relation: z.enum(['direct', 'collateral', 'adopted']),
  created_at_parent_age: intV,
  birth_stats: statRecord,
  traits: z.array(s({ id: defId, from: z.enum(['parent', 'other_parent', 'new']) })),
  appearance: appearanceSchema,
  episodes: z.array(z.string()),
  is_default: z.boolean(),
})
export type Candidate = z.infer<typeof candidateSchema>

// 끝난 생애(16 §5.3 life_record). book의 모양은 T10(생애의 책, 18 §7.1)이 정한다
export const lifeRecordSchema = s({
  gen: intV.min(1),
  char_uid: uid,
  name: z.string(),
  epithet: z.string(),
  family_role: z.enum(FAMILY_ROLES),
  end_age: intV,
  end_kind: z.enum(END_KINDS),
  retire_role: defId.nullable(),
  cause: s({
    location: defId,
    risk: z.string(),
    lethal_source: z.string().nullable(),
    injuries_at_end: z.array(z.string()),
    decisive_check: s({ dice: intV, total: intV, dc: intV }).nullable(),
  }).nullable(),
  attitudes_used: z.record(defId, effMinV),
  specialization: z.enum(SPECIALIZATIONS),
  job2: z.string().nullable().default(null), // D79
  techniques: z.array(z.string()).default([]), // D79 익힌 기술 id
  mutation: z.enum(MUTATIONS),
  peak_level: intV.min(1),
  summary: s({ sorties: nat, encounters: nat, defeats: nat, serious_injuries: nat, discoveries: nat, coins_earned: nat }),
  life_flags: z.record(scopedFlagKey('life'), flagValue),
  unfinished: z.array(z.string()),
  relics_passed: z.array(uid),
  major_entry_ids: z.array(nat),
  attitude_log: z.array(s({ eff_min: effMinV, attitude: defId })),
  birth_season: z.enum(SEASONS),
  retire_age: intV,
  guild_rank: defId,
  long_sleep: s({ cause: z.string(), sleep_age: intV }).nullable(),
  received_relic_uids: z.array(uid),
  mutation_eff_min: effMinV.nullable(),
  book: z.record(z.string(), z.unknown()).nullable(),
  // D87: 계승 때 뽑히지 않은 후계 후보(가계도 가는 테두리). 옛 기록은 빈 목록
  candidates_passed: z.array(s({ name: z.string(), relation: z.enum(FAMILY_ROLES), episodes: z.array(z.string()) })).default([]),
})
export type LifeRecord = z.infer<typeof lifeRecordSchema>

export const familySchema = s({
  family_id: uid,
  name: z.string(),
  // 64비트 소문자 16진(I05: 그대로 해시한다)
  family_seed: z.string().regex(/^[0-9a-f]{16}$/, 'family_seed는 16자리 소문자 16진이다'),
  generation: intV.min(1),
  founded_utc: utcMs,
  // 종류별 다음 일련번호. jr = 다음 일지 id
  next_uid: s({ ch: intV.min(1), it: intV.min(1), jr: nat, sortie: intV.min(1) }),
  chronicle: z.array(lifeRecordSchema),
  // C14: 도감은 종류별 키
  codex: s({
    items: z.record(defId, s({ first_gen: intV, first_char: uid, grades_seen: z.array(z.enum(GRADES)), first_place: defId.optional() })),
    seen: z.record(defId, s({ first_gen: intV })).default({}), // D87 본 적 있음(상점 진열·사건 제안)
    enemies: z.record(defId, s({ first_gen: intV, defeats: nat, first_name: z.string().optional() })),
    events: z.record(defId, s({ first_gen: intV, choices: z.array(z.string()).optional() })),
    locations: z.record(defId, s({ first_gen: intV, first_name: z.string().optional(), first_age: intV.optional() })),
  }),
  discovered_locations: z.array(defId),
  // C30: 가문 수첩에 적힌 발견 지점(07 §6.5, 12 §7.4). 인물의 발견(C17)은 생애 단위라 따로 둔다. 이 칸이 없던 저장은 빈 목록
  discovery_points: z.array(defId).default([]),
  bonds: z.array(s({ npc_id: defId, gen: intV, key: z.string(), text: z.string() })),
  flags: z.record(scopedFlagKey('fam'), flagValue),
  flag_meta: z.record(scopedFlagKey('fam'), s({ set_gen: intV })), // C12
  event_counts: z.record(defId, nat), // C2
  counters: z.record(z.string(), nat), // num family_counter.{counter}
  unlocks: s({ backgrounds: z.array(defId), appearances: z.array(z.string()), titles: z.array(z.string()) }),
  achievements: z.record(defId, s({ gen: intV, char_uid: uid })),
  notices_shown: z.record(z.string(), intV), // C25
  // 가문 수첩 요령(12 §7.7, D79)
  technique_note: s({ tech_id: z.string(), gen: intV.min(1) }).nullable().default(null),
  // 가호 별빛(01 §19, D78). 이 칸이 없던 저장은 별빛 1
  blessing: s({ charges: nat, total_used: nat }).default({ charges: 1, total_used: 0 }),
  keepsakes: z.array(s({ name: z.string(), from_def_id: defId, gen: intV, text: z.string() })),
  retirees: z.array(s({ char_uid: uid, name: z.string(), retired_age: intV, role: defId, visible_until_heir_age: intV })),
  candidates: z.record(uid, candidateSchema), // C10: 후보 단일 저장
})
export type Family = z.infer<typeof familySchema>
