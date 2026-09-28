// 선택 대기와 진행 상태(16 §5.7) + C13·C26~C28·C31. 확정 결과(resolved_action)는 13 §8.3.
import { z } from 'zod'
import { ACTIVITIES, ACTIVITY_STATES, END_KINDS, LIFE_STAGES, ROOM_KINDS, SKILLS, STATS, TIME_OF_DAY, WEATHERS } from '../schema/index'
import { defId, effMinV, flagValue, intV, nat, s, savedEffect, scopedFlagKey, tempModSchema, uid } from './common'
import { candidateSchema, lifeRecordSchema } from './family'
import { itemInstanceSchema } from './inventory'
import { journalDraftSchema } from './journal'

export const pendingChoiceSchema = s({
  kind: z.enum(['fate', 'branch']),
  event_id: defId,
  presented_eff_min: effMinV,
  location: defId,
  choices_visible: z.array(z.string()),
  excluded: z.array(z.string()),
  pre_rolled: z.record(z.string(), intV.min(1).max(20)), // {choice_id: d20}
  pre_chance: z.record(z.string(), z.number().min(0).max(1)), // {effect_path: 0~1}
  context: z.record(z.string(), z.unknown()),
  preview_rendered: z.record(z.string(), z.unknown()),
})
export type PendingChoice = z.infer<typeof pendingChoiceSchema>

export const sortieSchema = s({
  id: uid,
  activity: z.enum(ACTIVITIES),
  location_id: defId,
  time_of_day: z.enum(TIME_OF_DAY),
  weather: z.enum(WEATHERS),
  started_eff_min: effMinV,
  plan: z.union([
    s({ rooms: z.array(z.enum(ROOM_KINDS)), gate: z.boolean() }),
    s({ scenes: intV.min(1) }),
    s({ target_encounters: intV.min(1), safety_cap: intV.min(1) }),
  ]),
  progress: nat,
  // C13: 수정자는 저장하지 않고 등록표 trip_modifiers에서 읽는다
  trip_flags: z.record(scopedFlagKey('trip'), s({
    value: flagValue,
    remaining: s({ encounters: intV.min(1).optional(), rooms: intV.min(1).optional(), scenes: intV.min(1).optional() }).nullable(),
  })),
  temp_mods: z.array(tempModSchema),
  dungeon_mods: z.array(savedEffect),
  quest_wins: nat.nullable(),
  loot: s({ coins: nat, item_uids: z.array(uid), materials: z.record(defId, nat) }),
  potions_used: nat,
  events_this_sortie: nat,
  camps: nat, // C26
  discovery_attempts: z.array(defId), // C27
  exclusive_used: z.array(z.string()), // C28
  fate_offered: z.boolean(),
  start: s({ level: intV.min(1), xp: nat, coins: nat, jr: nat }).optional(), // 최근 요약(14 §1.1, D77, C33): 떠날 때 레벨·경험·소지금·일지 일련번호
  // C32: 아직 닫히지 않은 일지 묶음(14 §4 사냥 조우·던전 전투 방). 닫히면 기록 1개가 되고 칸을 지운다.
  // single = 1개로 닫힐 때 그대로 남길 개별 기록, rows = 펼침 내역(최대 10줄)
  journal_bundle: s({
    tag: z.enum(['hunt', 'dungeon']),
    count: intV.min(1),
    coins: nat,
    depth: nat,
    rows: z.array(z.string()),
    single: journalDraftSchema,
  }).optional(),
})
export type Sortie = z.infer<typeof sortieSchema>

export const ACTION_KINDS = ['encounter', 'room', 'scene', 'gate', 'travel', 'camp', 'inn', 'town', 'treatment', 'event'] as const
export type ActionKind = (typeof ACTION_KINDS)[number]

// 확정 결과가 담는 조각. 16 §5.7은 effect[]라고만 적었으나 행동 해석기는 콘텐츠 효과(type)와
// 제 결과 조각(kind: 조우·방·장면·관문 …)을 함께 담는다. 둘 다 받아야 정상 저장이 K4에 걸리지 않는다
export const resolvedPartSchema = z.union([savedEffect, z.looseObject({ kind: z.string() })])

// 확정 결과: 행동 시작 때 난수를 모두 굴려 담고, 시간이 다 차면 적용한다
export const resolvedActionSchema = s({
  seq: intV.min(1),
  kind: z.enum(ACTION_KINDS),
  started_eff_min: effMinV,
  duration_sec: nat,
  rounds: z.array(s({ actor: z.string(), dice: intV, total: intV, target_ac: intV, hit: z.boolean(), damage: nat })).optional(),
  outcome: z.string(),
  effects: z.array(resolvedPartSchema),
  journal: z.array(journalDraftSchema),
  applied: z.boolean(),
})
export type ResolvedAction = z.infer<typeof resolvedActionSchema>

// C31: 판단 지점으로 미룬 생애 진행(sim/life-loop, 04 §2.3). 행동 도중·계승 대기 중 저장해도 잃지 않는다.
// 모양은 코어 타입 그대로다: 나이 알림 = life/aging AgeTick(09 §2.1), 끝낼 생애 = 종류 + 사망 기록(09 §5.4),
// 계승 계획 = succession/succeed SuccessionPlan(12 §1.1 1~2단계 결과, 3~5단계가 읽는다)
export const ageTickSchema = s({
  from: intV,
  to: intV,
  changes: z.array(s({ age: intV, stat: z.enum(STATS), delta: intV })),
  boundary: intV.nullable(),
  stage: z.enum(LIFE_STAGES),
})
export const lifeLoopSchema = s({
  age_ticks: z.array(ageTickSchema),
  pending_end: s({ kind: z.enum(END_KINDS), death: z.looseObject({ final_check: z.looseObject({}) }).nullable() }).nullable(),
  succession: s({
    record: lifeRecordSchema,
    candidates: z.array(candidateSchema),
    defaultHeirUid: uid.nullable(),
    relicUids: z.array(uid),
    settlement: s({
      coins: z.number(), soldValue: z.number(), total: z.number(), ratio: z.number(), transferred: z.number(), capped: z.boolean(),
      keepsakes: z.array(itemInstanceSchema),
    }),
    journal: z.array(journalDraftSchema),
    timeJump: z.boolean(),
    firstPage: z.string(),
  }).nullable(),
  // 마지막으로 [성장] 기록을 남긴 레벨·숙련 단계(05 §3.4·§5.1, D77, C33). 인물이 바뀌었거나 없으면 기록 없이 지금 값으로 맞춘다
  growth_seen: s({ char_uid: uid, level: intV.min(1), ranks: z.record(z.enum(SKILLS), nat) }).nullable().optional(),
})
export type LifeLoopState = z.infer<typeof lifeLoopSchema>
export const emptyLifeLoop = (): LifeLoopState => ({ age_ticks: [], pending_end: null, succession: null })

export const currentActivitySchema = s({
  state: z.enum(ACTIVITY_STATES),
  paused_from: z.enum(ACTIVITY_STATES).nullable(), // 일시정지 직전 상태(재개 때 되돌림)
  next_sortie_override: s({ location_id: defId, activity: z.enum(ACTIVITIES), source_event: defId }).nullable(),
  sortie: sortieSchema.nullable(),
  pending_town_effects: z.array(savedEffect),
  resolved_action: resolvedActionSchema.nullable(),
  life_loop: lifeLoopSchema.default(emptyLifeLoop), // C31. 이 칸이 없던 저장은 빈 값
})
export type CurrentActivity = z.infer<typeof currentActivitySchema>
