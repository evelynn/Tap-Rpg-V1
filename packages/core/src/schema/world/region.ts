// 장소 스키마(CONTENT_SCHEMA §5.3). kind 판별 유니온: 마을·사냥터·던전 층·모험 경로.
import { z } from 'zod'
import {
  ROOM_KINDS,
  SCENE_KINDS,
  condition,
  def,
  effectList,
  id,
  int,
  line,
  modifier,
  nonNegInt,
  obj,
  posInt,
  range,
  ratio,
  ref,
  template,
  weight,
  weightTable,
} from '../common'
import { DC_GRADES } from './balance'

// 모든 장소 공통
const common = {
  name: z.string(),
  descend_sec: nonNegInt.optional(),
  unlock: condition,
  guild_rank_req: ref('guild_rank').optional(),
  patrol_zone: z.boolean().default(false),
  fallback: z.boolean().default(false),
  aid_allowed: z.boolean().default(false),
  deficit_exempt: z.enum(['always', 'during_aid', 'never']).default('never'),
  closes_on_succession: z.boolean().default(false),
  weather_exempt: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
  background_id: z.string(),
  feature_words: z.array(z.string()).optional(),
}

// 마을 밖 장소에만 있는 필드. rescuers는 기본값을 두지 않는다(코드가 표 키 이름을 모르게).
const field = {
  ...common,
  level_range: range,
  level_mid: int,
  travel_sec: nonNegInt,
  rescuers: ref('rescuer_table'),
}

const encounters = z.array(obj({ enemy_id: ref('enemy'), weight })).min(1)

// 시설 id가 facility 이름공간을 정의한다. 판매 목록은 장비·소모품의 shop에만 둔다.
export const facilitySchema = obj({
  id,
  name: z.string(),
  npc_id: ref('npc'),
  good_stock: nonNegInt.optional(),
  services: z.array(z.enum(['inn', 'lodging', 'light_treatment', 'clinic', 'free_treatment', 'special_shop'])).optional(),
})

export const townSchema = def({
  kind: z.literal('town'),
  ...common,
  facilities: z.array(facilitySchema).min(1),
})

export const huntingGroundSchema = def({
  kind: z.literal('hunting_ground'),
  ...field,
  encounters,
  pair_chance: ratio,
  event_check: ratio,
})

// 치명 관문이면 turn_back 말고도 이 문장들이 모두 필요하다
const LETHAL_LINES = ['lethal_blocked', 'lethal_auto_entry', 'death_line', 'suggest_lethal_off', 'suggest_default'] as const

export const gateSchema = obj({
  enemy_id: ref('enemy'),
  lethal: z.boolean(),
  remnant: obj({ enemy_id: ref('enemy') }),
  first_clear: effectList.optional(),
  lines: obj({
    turn_back: line,
    lethal_blocked: obj({ line, detail: template }).optional(),
    lethal_auto_entry: line.optional(),
    death_line: line.optional(),
    suggest_lethal_off: template.optional(),
    suggest_default: template.optional(),
  }),
}).superRefine((g, ctx) => {
  if (!g.lethal) return
  for (const k of LETHAL_LINES) {
    if (g.lines[k] === undefined) ctx.addIssue({ code: 'custom', path: ['lines', k], message: `치명 관문은 lines.${k}가 필요하다` })
  }
})

export const dungeonFloorSchema = def({
  kind: z.literal('dungeon_floor'),
  ...field,
  // group 값이 dungeon_group 이름공간을 정의한다. depth 연속 검사는 W1.
  dungeon: obj({ group: id, depth: posInt }),
  quiet_line: line.optional(),
  encounters,
  pair_chance: ratio,
  rooms: range,
  room_weights: weightTable(ROOM_KINDS),
  trap_table: z.array(obj({ trap_id: ref('trap'), weight })).min(1),
  treasure_table: obj({ chest: weight, vein: weight }),
  gate: gateSchema,
})

// 발견 지점. id가 discovery 이름공간을 정의한다.
export const discoverySchema = obj({
  id,
  name: z.string(),
  condition: condition.default(true),
  dc: obj({ grade: z.enum(DC_GRADES) }),
  check: ref('check_kind').default('pathfinding'),
  effects: effectList.optional(),
  modifiers: z.array(modifier).optional(),
  event_weight_mult: z.record(ref('event'), z.number().min(0)).optional(),
  map_fragment: ref('map_fragment').optional(),
  notebook_line: template.optional(),
  shift_line: template.optional(),
})

export const adventureRouteSchema = def({
  kind: z.literal('adventure_route'),
  ...field,
  scenes: range,
  scene_weights: weightTable(SCENE_KINDS),
  encounters,
  pair_chance: ratio,
  discoveries: z.array(discoverySchema),
  // id가 map_fragment 이름공간을 정의한다
  map_fragments: z.array(obj({ id, name: z.string() })),
})

export const regionSchema = z.discriminatedUnion(
  'kind',
  [townSchema, huntingGroundSchema, dungeonFloorSchema, adventureRouteSchema],
  { error: '장소 kind는 town·hunting_ground·dungeon_floor·adventure_route 중 하나다' },
)

export type Region = z.infer<typeof regionSchema>
