// W3 테스트 공통: 조건·효과 임시 등록 + 검사 도우미.
// 조건·효과는 W4가 등록하지만 묶음끼리 import하지 않으므로, 테스트가 CONTENT_SCHEMA §4.1·§4.2 파라미터대로 직접 등록한다(§9 W2·W3 규칙).
// 첫 파싱 때 등록부가 잠기므로 테스트 파일 맨 위에서 import한다. node --test는 파일마다 프로세스가 따로다.
import assert from 'node:assert/strict'
import { z } from 'zod'
import {
  END_KINDS, effectList, exactlyOne, flagKey, int, MUTATIONS, obj, posInt, ratio, ref, regionFilter, regionKind,
  registerCondition, registerEffect, season, skill, SPECIALIZATIONS, timeOfDay,
} from '../../../src/schema/common'

const CODEX = ['items', 'enemies', 'events', 'locations'] as const

registerCondition('age_gte', int)
registerCondition('location_kind', z.array(regionKind))
registerCondition('season', z.array(season))
registerCondition('time_of_day', timeOfDay)
registerCondition('last_trip_time', timeOfDay)
registerCondition('has_trait', ref('trait'))
registerCondition('received_relic', ref('item'))
registerCondition('flag', z.union([flagKey(), obj({ key: flagKey(), value: z.union([z.boolean(), int]) })]))
registerCondition('skill_rank_gte', obj({ skill, rank: int }))
registerCondition('specialization', z.array(z.enum(SPECIALIZATIONS)))
registerCondition('mutation', z.enum(MUTATIONS))
registerCondition('in_town', z.boolean())
registerCondition('visited', ref('region'))
registerCondition('discovered', ref('region'))
registerCondition('discovery_found', ref('discovery'))
registerCondition('defeated', ref('enemy'))
registerCondition('codex_count_gte', obj({ codex: z.enum(CODEX), count: int }))
registerCondition('codex_complete', z.enum(CODEX))
registerCondition('life_end_kind', z.array(z.enum(END_KINDS)))
registerCondition('died_at', regionFilter)

registerEffect(
  'add_consumable',
  { consumable_id: ref('consumable').optional(), tier: z.literal('current').optional(), count: posInt },
  '',
  exactlyOne('consumable_id', 'tier'),
)
registerEffect('chance', { p: ratio, then: effectList, else: effectList.optional() })

function issues(schema: z.ZodType, value: unknown): z.core.$ZodIssue[] {
  const r = schema.safeParse(value)
  return r.success ? [] : r.error.issues
}

const fmt = (list: z.core.$ZodIssue[]) => list.map((i) => `${i.path.map(String).join('.')}: ${i.message}`)

// 통과해야 한다(실패하면 이슈 목록을 보여 준다)
export function assertValid(schema: z.ZodType, value: unknown): void {
  assert.deepEqual(fmt(issues(schema, value)), [])
}

// 그 경로에 이슈가 있어야 한다. rule을 주면 이슈의 params.rule도 확인한다
export function assertIssue(schema: z.ZodType, value: unknown, path: string, rule?: string): void {
  const list = issues(schema, value)
  const hit = list.find((i) => i.path.map(String).join('.') === path)
  assert.ok(hit, `경로 '${path}' 이슈가 없다: ${JSON.stringify(fmt(list))}`)
  if (rule) assert.equal((hit as { params?: { rule?: string } }).params?.rule, rule)
}

// 얕은 복사 + 덮어쓰기/지우기(값 undefined = 키 삭제)
export function edit(base: object, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete out[k]
    else out[k] = v
  }
  return out
}
