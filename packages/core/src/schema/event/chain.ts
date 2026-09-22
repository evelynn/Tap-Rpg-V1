// 연속 사건 줄기 정의(CONTENT_SCHEMA §5.9, 10 §7). chains/<ID>.json 한 파일 = 줄기 1개.
import { z } from 'zod'
import { condition, line, obj, posInt, template } from '../common'

// 파생 플래그 키에 소문자로 들어가므로 대문자·숫자·_ 만(하이픈 없음)
export const CHAIN_ID_PATTERN = /^[A-Z][A-Z0-9_]*$/

export const chainSchema = obj({
  id: z.string().regex(CHAIN_ID_PATTERN, '줄기 id는 대문자로 시작하고 대문자·숫자·_ 만 쓴다'),
  name: z.string(),
  stages: posInt,
  outcomes: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/, 'outcome은 snake_case다')).min(1),
  family_once: z.boolean(),
  inheritable: z.boolean(),
  resume_at: z.array(obj({ stage: posInt, when: condition, line })),
  unfinished_line: template,
  stage_summaries: z.array(template),
  mission_bonus: z.boolean().optional(), // 기본 true
  major_branch_stage: posInt.optional(),
}).superRefine((c, ctx) => {
  const add = (message: string, path: PropertyKey[]) => ctx.addIssue({ code: 'custom', message, path })
  if (c.stage_summaries.length !== c.stages) add(`stage_summaries는 단계 수(${c.stages})만큼 필요하다`, ['stage_summaries'])
  if (new Set(c.outcomes).size !== c.outcomes.length) add('outcomes 이름이 겹친다', ['outcomes'])
  c.resume_at.forEach((r, i) => {
    if (r.stage > c.stages) add(`단계 수(${c.stages})를 넘는다`, ['resume_at', i, 'stage'])
  })
  if (c.major_branch_stage !== undefined && c.major_branch_stage > c.stages) add(`단계 수(${c.stages})를 넘는다`, ['major_branch_stage'])
})

export type Chain = z.infer<typeof chainSchema>
