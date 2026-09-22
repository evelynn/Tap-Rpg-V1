// 플래그 키 등록표(16 §5.2, CONTENT_SCHEMA §5.8). flags.json = 이 정의의 배열.
// 키 묶음은 id 꼬리에 자리 {place}·{kind}·{role}을 적고 family에 그 자리의 종류를 적는다.
import { z } from 'zod'
import { CONTENT_KIND_NAMES, FLAG_KEY_PATTERN, FLAG_SCOPES, NESTED_REF_KINDS, modifier, obj, range } from '../common'
import type { Chain } from './chain'

const V19 = { rule: 'V19' }
const SLOT_TAIL = /_\{([a-z][a-z0-9_]*)\}$/

export const flagDefSchema = obj({
  id: z.string().regex(FLAG_KEY_PATTERN, '플래그 키 형식이 아니다(범위.snake_case)'),
  scope: z.enum(FLAG_SCOPES),
  value: z.union([z.literal('bool'), obj({ int: range })]),
  family: z.record(z.string(), z.enum([...CONTENT_KIND_NAMES, ...NESTED_REF_KINDS, 'specialization'])).optional(),
  set_by: z.string(),
  read_by: z.string(),
  // trip 플래그가 켜져 있는 동안의 수정자. set_trip_flag에는 두지 않는다(여러 사건이 세워도 효과 하나)
  trip_modifiers: z.array(modifier).optional(),
}).superRefine((f, ctx) => {
  const add = (message: string, path: PropertyKey[]) => ctx.addIssue({ code: 'custom', message, path, params: V19 })
  if (!f.id.startsWith(`${f.scope}.`)) add(`id 접두가 scope(${f.scope})와 다르다`, ['scope'])
  const slot = SLOT_TAIL.exec(f.id)?.[1]
  const keys = Object.keys(f.family ?? {})
  if (slot && (keys.length !== 1 || keys[0] !== slot)) add(`키 묶음 자리 {${slot}}의 종류를 family에 하나만 적는다`, ['family'])
  if (!slot && keys.length > 0) add('키 묶음이 아닌 플래그는 family를 쓰지 않는다', ['family'])
  if (f.trip_modifiers && f.scope !== 'trip') add('trip_modifiers는 trip 플래그에만 쓴다', ['trip_modifiers'])
})

export type FlagDef = z.infer<typeof flagDefSchema>

// 줄기 플래그 키의 단일 출처(§5.9, 10 §7). 파생 등록도 규칙 층도 이 함수로만 키를 만든다.
const lower = (id: string) => id.toLowerCase()
export const chainStageKey = (chainId: string) => `life.${lower(chainId)}_stage`
export const chainDoneKey = (chainId: string) => `fam.${lower(chainId)}_done`
export const chainOutcomeKey = (chainId: string, outcome: string) => `fam.${lower(chainId)}_${outcome}`
export const chainUnfinishedKey = (chainId: string) => `fam.${lower(chainId)}_unfinished`

// 줄기 정의에서 로더가 파생 등록하는 키(§5.9). outcome done은 완료 플래그와 같은 키라 하나로 친다.
export function derivedChainFlags(chain: Pick<Chain, 'id' | 'stages' | 'outcomes'>): FlagDef[] {
  const src = `줄기 ${chain.id} 파생`
  const bool = (id: string): FlagDef => ({ id, scope: 'fam', value: 'bool', set_by: src, read_by: src })
  return [
    { id: chainStageKey(chain.id), scope: 'life', value: { int: [0, chain.stages] }, set_by: src, read_by: src },
    bool(chainDoneKey(chain.id)),
    ...chain.outcomes.filter((o) => o !== 'done').map((o) => bool(chainOutcomeKey(chain.id, o))),
    { id: chainUnfinishedKey(chain.id), scope: 'fam', value: { int: [1, Math.max(1, chain.stages - 1)] }, set_by: src, read_by: src },
  ]
}
