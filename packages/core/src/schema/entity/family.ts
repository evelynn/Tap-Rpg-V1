// 가문 관련 종류: 출신 배경, 가문 업적, 별칭, 은퇴 역할, 후손 반응. 근거: CONTENT_SCHEMA §5.7, 12 §7.5·§7.6·§8, 09 §4.1.
import { z } from 'zod'
import {
  condition, def, effectList, flagKey, int, line, modifier, obj, posInt, ref, skill, stat, template,
} from '../common'

// 12 §8.1. null = 없음(숙련·고정 능력치) / 처음부터 해금
export const backgroundSchema = def({
  name: z.string(),
  start_skill: skill.nullable(),
  fixed_stat: stat.nullable(),
  unlock: obj({ achievement: ref('achievement') }).nullable(),
  intro_line: template,
})

// 12 §8.4. 판정 시점(판단 지점마다, 가문 1회)은 엔진 규칙이고 데이터는 조건만 둔다
export const achievementSchema = def({
  name: z.string(),
  condition,
  rewards: z.array(z.discriminatedUnion('kind', [
    obj({ kind: z.literal('background'), id: ref('background') }),
    obj({ kind: z.literal('appearance'), id: z.string() }),
    obj({ kind: z.literal('title'), text: z.string() }),
    obj({ kind: z.literal('start_option'), id: z.literal('birth_season') }),
    obj({ kind: z.literal('family_tab'), id: z.string() }),
  ])),
  line: line.optional(),
})

// 12 §7.5. 생애 종료 2단계에서 priority 작은 것부터 첫 참 1개
export const epithetSchema = def({
  priority: int,
  condition,
  template,
})

// 09 §4.1. 점수 = base_points + 맞는 score 항목 합, 동점이면 tie_winner
export const retireRoleSchema = def({
  name: z.string(),
  base_points: int,
  score: z.array(obj({ when: condition, points: int })),
  tie_winner: z.boolean(),
  heir_modifiers: z.array(modifier),
  heir_events: z.array(ref('event')),
  letter_gift: effectList,
  until_heir_age: int,
  family_flag: flagKey('fam'),
  fallback_name: z.string().optional(),
})

// 12 §7.6. 기간(플래그를 남긴 인물의 다음 세대 = 1)은 엔진이 family.flag_meta로 계산한다
export const descendantReactionSchema = def({
  flag: flagKey('fam'),
  window_generations: z.union([posInt, z.literal('permanent')]),
  events: z.array(ref('event')),
  npc: ref('npc').optional(),
  summary: z.string(),
})
