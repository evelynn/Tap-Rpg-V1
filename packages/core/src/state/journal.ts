// 일지 기록(16 §5.6). 문장은 렌더링이 끝난 문자열로 저장한다(13 §9).
import { z } from 'zod'
import { JOURNAL_IMPORTANCE, JOURNAL_TAGS, SEASONS } from '../schema/index'
import { defId, effMinV, intV, nat, s, uid } from './common'

export const CHECK_RESULTS = ['crit_success', 'success', 'partial', 'failure', 'crit_failure'] as const
export type CheckResult = (typeof CHECK_RESULTS)[number]

// 18 §4.1·§7.1 선별용 하위 종류
export const JOURNAL_SUBS = [
  'rank', 'spec', 'age', 'level5', 'family_first', 'rare_gain', 'relic_mark', 'trait_gain', 'trait_react',
  'serious', 'gate_first', 'final_check', 'birth', 'relic_return', 'blessing', 'tech', 'depart',
] as const

// 판정 기록(05 §6.6): parts는 주사위를 뺀 항(능력치·숙련·보정 이름별)
export const checkRecordSchema = s({
  dice: intV.min(1).max(20),
  parts: z.array(s({ label: z.string(), value: intV })),
  total: intV,
  dc: intV,
  result: z.enum(CHECK_RESULTS),
  reroll: s({ first: intV.min(1).max(20), second: intV.min(1).max(20) }).optional(), // 기적의 주사위(05 §6.2, D78): 처음·다시 굴린 주사위
  kind: defId.optional(), // 판정 종류(balance.check_kinds 키). 일지 전투·탐험 필터가 쓴다(03 §5.2). 없는 옛 기록도 읽는다
})
export type CheckRecord = z.infer<typeof checkRecordSchema>

export const journalRefsSchema = s({
  event_id: defId.optional(),
  item_uid: uid.optional(),
  npc_id: defId.optional(),
  location_id: defId.optional(),
  sortie_id: uid.optional(),
  not_taken: z.array(z.string()).optional(),
  by_policy: z.boolean().optional(),
})

// 행동 결과가 들고 있다가 적용 때 id·시점을 받는 기록(16 §5.7 resolved_action.journal)
const draftShape = {
  tag: z.enum(JOURNAL_TAGS),
  importance: z.enum(JOURNAL_IMPORTANCE),
  line: z.string(),
  detail: z.string().optional(),
  check: checkRecordSchema.optional(),
  reason: z.string().optional(),
  bundle_count: intV.min(1).optional(),
  sub: z.enum(JOURNAL_SUBS).optional(),
  refs: journalRefsSchema.optional(),
}
export const journalDraftSchema = s({ ...draftShape, importance: draftShape.importance.optional() })
export type JournalDraft = z.infer<typeof journalDraftSchema>

export const journalEntrySchema = s({
  id: nat, // 가문 전체 일련번호(family.next_uid.jr)
  gen: intV.min(1),
  char_uid: uid,
  eff_min: effMinV,
  age: intV,
  season: z.enum(SEASONS),
  ...draftShape,
  offline: z.boolean(),
})
export type JournalEntry = z.infer<typeof journalEntrySchema>
