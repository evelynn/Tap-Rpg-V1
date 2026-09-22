// NPC와 이름 풀 스키마. 근거: CONTENT_SCHEMA §5.6, 16 §2.8·§2.9.
import { z } from 'zod'
import { def, int, obj, posInt, ref } from '../common'

// 후손 반응은 descendant_reaction 종류로 옮겼다(DS-10)
export const npcSchema = def({
  name: z.string(),
  role: z.string(),
  home: ref('region'),
  facility: z.string().optional(),
  portrait_id: z.string().optional(),
  speech: obj({ style: z.string(), samples: z.array(z.string()) }),
  events: z.array(ref('event')),
  // 세대 교대 담당자(02 §8.10)
  successors: z.array(obj({ from_generation: posInt, name: z.string() })).optional(),
  relation_default: int.min(-100).max(100),
})

// 엔진은 모든 풀을 합친다(팩은 배열 패치 없이 풀을 더한다). 이름 길이 규칙은 balance.ui.name_len
export const namePoolSchema = def({
  given_names: z.array(z.string()),
  family_names: z.array(z.string()),
  partner_jobs: z.array(z.string()).optional(),
})
