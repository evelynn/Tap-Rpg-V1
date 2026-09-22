// 연출 소품(prop) 스키마. animation 효과의 props가 가리킨다(15 소품).
import { z } from 'zod'
import { def } from '../common'

export const propSchema = def({
  name: z.string(),
  asset_id: z.string(),
})
