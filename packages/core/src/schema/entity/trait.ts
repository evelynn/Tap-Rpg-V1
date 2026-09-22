// 특성(trait) 스키마. 근거: CONTENT_SCHEMA §5.6, 16 §2.7, 06, 09 §7(변이 수치).
import { z } from 'zod'
import {
  condition, counterNames, def, effMin, EVENT_TRIGGERS, id, int, line, modifier, nonNegInt, obj, posInt, ratio, ref,
  regionFilter, stat,
} from '../common'
import { aiHooksSchema } from './trait-hooks'

// 획득 경로. type: event는 표시 전용 — 실제 부여는 그 사건 결과의 add_trait가 한다(W1 교차 검사).
export const traitAcquireSchema = z.discriminatedUnion('type', [
  obj({ type: z.literal('condition'), condition }),
  obj({
    type: z.literal('counter'),
    counter: z.string().superRefine((name, ctx) => {
      counterNames.lock()
      if (!counterNames.has(name)) ctx.addIssue({ code: 'custom', message: `등록되지 않은 카운터: ${name}`, params: { rule: 'V3' } })
    }),
    // 있으면 거르개에 맞는 장소별 카운터를 합산한다
    where: regionFilter.optional(),
    threshold: posInt,
  }),
  obj({ type: z.literal('event'), event_id: ref('event'), choice: z.string() }),
])

const statTable = z.partialRecord(stat, int)

// 변이 수치의 단일 출처(balance에 변이 섹션을 두지 않는다). 변이 종류는 코드 열거(DS-30).
const mutationSchema = obj({
  stat_add: statTable,
  stat_floor: int,
  natural_cap_add: statTable,
  no_aging_loss: z.boolean(),
  blocks_lifespan_extension: z.boolean(),
  time_ratio: obj({ day: ratio, night: ratio }),
  // 출정 중 그 시간대에만 적용
  time_modifiers: obj({ day: z.array(modifier), night: z.array(modifier) }),
  // 시간대와 무관. 마을 규칙은 in_town 조건으로 쓴다
  modifiers: z.array(modifier),
  thirst: obj({
    per_min: int,
    day_sortie: int,
    night_win: int,
    elite_boss: int,
    auto_drink: obj({ sortie_gte: int, town_gte: int }),
    // id는 중첩 이름공간 thirst_stage
    stages: z.array(obj({
      id,
      from: nonNegInt,
      modifiers: z.array(modifier).optional(),
      night_ratio: ratio.optional(),
      line: line.optional(),
    })).min(1),
  }),
  blood_rest: obj({ min: effMin, thirst_add: int, cures: z.literal('serious') }),
  cellar_rest_sec: int,
  // 조건이 참이면 그 판단 지점의 사건을 모두 뺀다
  blocked_triggers: z.array(obj({ trigger: z.enum(EVENT_TRIGGERS), when: condition })),
  sleep: obj({ add_years: int, cap: int }),
})

export const traitSchema = def({
  name: z.string(),
  short_name: z.string().optional(),
  kind: z.enum(['innate', 'acquired', 'mutation']),
  subkind: z.enum(['constitution', 'talent', 'temperament', 'negative', 'story']),
  acquired_class: z.enum(['unique', 'cumulative', 'negative']).optional(),
  inheritable: z.boolean(),
  inherit_class: z.enum(['positive', 'negative']).optional(),
  acquire: traitAcquireSchema.optional(),
  replaces: ref('trait').optional(),
  exclusive_with: z.array(ref('trait')).optional(),
  modifiers: z.array(modifier),
  ai_hooks: aiHooksSchema.optional(),
  reason_phrase: z.string().optional(),
  name_adj: z.string().optional(),
  lines: z.array(line).min(2),
  // 신규 선천 특성 추첨 가중치(06 §6.3)
  birth_weight: nonNegInt.optional(),
  // 출생 분배에서 가중하는 능력치(05 §2.2). 가산값은 balance.growth.trait_birth_add
  birth_stat_weights: z.array(stat).optional(),
  mutation: mutationSchema.optional(),
}).superRefine((t, ctx) => {
  const add = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })

  if (t.kind === 'innate') {
    if (t.acquire) add('acquire', '선천 특성은 acquire를 두지 않는다(출생 추첨·유전으로 얻는다)')
    if (t.birth_weight === undefined) add('birth_weight', '선천 특성은 birth_weight가 필요하다')
  } else if (!t.acquire) {
    add('acquire', `${t.kind} 특성은 획득 경로 acquire가 필요하다`)
  }
  if (t.kind === 'acquired' && !t.acquired_class) add('acquired_class', '후천 특성은 acquired_class가 필요하다')
  if (t.inheritable && !t.inherit_class) add('inherit_class', '유전 가능 특성은 inherit_class가 필요하다')
  if ((t.kind === 'mutation') !== (t.mutation !== undefined)) {
    add('mutation', t.kind === 'mutation' ? '변이 특성은 mutation 수치가 필요하다' : 'mutation 필드는 변이 특성 전용이다')
  }
})

export type Trait = z.infer<typeof traitSchema>
