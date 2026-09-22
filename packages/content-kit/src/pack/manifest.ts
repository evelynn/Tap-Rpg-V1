// pack.json 스키마(CONTENT_SCHEMA §1.2)
import { z } from 'zod'
import { obj } from '../core'

export const PACK_ID_PATTERN = /^[a-z][a-z0-9_]*$/
const packId = z.string().regex(PACK_ID_PATTERN, '팩 ID는 소문자 snake_case다')

export const manifestSchema = obj({
  id: packId,
  name: z.string().min(1),
  // 비교하지 않고 번들·저장 머리에 기록만 한다
  version: z.string().min(1),
  requires: z.array(packId),
})

export type PackManifest = z.infer<typeof manifestSchema>
