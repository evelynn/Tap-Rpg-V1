// 길드 등급 스키마(01 §8.3). 순서는 order, 조건은 데이터 조건식(DS-21).
import { z } from 'zod'
import { condition, def, line, nonNegInt } from '../common'

export const guildRankSchema = def({
  name: z.string(),
  order: nonNegInt,
  condition,
  grants_text: z.string(),
  line: line.optional(),
})
