// 적 계열·적 스키마(CONTENT_SCHEMA §5.4). 수치는 레벨 오프셋 0일 때의 값이다(그 밖은 balance.enemy_formula).
import { z } from 'zod'
import { ENEMY_RANKS, def, int, line, nonNegInt, posInt, range, ref } from '../common'
import { enemySpecialSchema } from './specials'

// 표시 이름은 {enemy_kind}
export const enemyFamilySchema = def({
  name: z.string(),
  sprite_family: z.string(),
  ecology: z.string().optional(), // 도감 생태 한 줄(02 §7, 12 §7.2, D87)
})

export const enemySchema = def({
  name: z.string(),
  family: ref('enemy_family'),
  level: posInt,
  rank: z.enum(ENEMY_RANKS),
  hp: posInt,
  ac: int,
  hit: int,
  damage: range,
  xp: nonNegInt,
  coins: nonNegInt,
  material_id: ref('material').optional(),
  specials: z.array(enemySpecialSchema),
  lethal: z.boolean().default(false),
  sprite_family: z.string(),
  palette_id: z.string(),
  lines: z.array(line).min(3),
  victory_lines: z.array(line).min(2),
  exit_line: line,
})

export type Enemy = z.infer<typeof enemySchema>
