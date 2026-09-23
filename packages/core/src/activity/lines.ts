// 활동 층이 쓰는 문형 슬롯(14 §4·§5.1)과 기록 도우미. 문장은 콘텐츠(text 종류)에 있다.
import type { Content } from '../content/index'
import { render } from '../events/index'
import { registerTextSlot } from '../schema/index'

// 코어가 부르는 문형 id. 번들에 없으면 콘텐츠 검사 V2가 잡는다
export const ACTIVITY_TEXT = {
  hunt_win: 'journal.hunt.win',
  hunt_win_detail: 'journal.hunt.win_detail',
  hunt_enemy_first_detail: 'journal.hunt.enemy_first_detail',
  adventure_scene: 'journal.adventure.scene',
  adventure_scene_detail: 'journal.adventure.scene_detail',
  adventure_map_detail: 'journal.adventure.map_detail',
  dungeon_room: 'journal.dungeon.room',
  dungeon_room_detail: 'journal.dungeon.room_detail',
  dungeon_gate: 'journal.dungeon.gate',
  dungeon_gate_detail: 'journal.dungeon.gate_detail',
  dungeon_retreat: 'journal.dungeon.retreat',
  dungeon_retreat_detail: 'journal.dungeon.retreat_detail',
  travel_depart: 'journal.travel.depart',
  travel_depart_rain: 'journal.travel.depart_rain',
  travel_depart_detail: 'journal.travel.depart_detail',
  rest_camp: 'journal.rest.camp',
  rest_inn: 'journal.rest.inn',
  potions_detail: 'journal.sortie.potions_detail',
  town_prep: 'journal.town.prep',
  discovery_place: 'journal.discovery.place',
  discovery_place_detail: 'journal.discovery.place_detail',
  guild_rank: 'journal.growth.guild_rank',
} as const

export type ActivityTextKey = keyof typeof ACTIVITY_TEXT

for (const id of Object.values(ACTIVITY_TEXT)) registerTextSlot(id, '활동 층(04·07)')

// 문형 변형은 난수가 아니라 seq로 고른다(같은 저장이면 같은 문장)
export function line(content: Content, key: ActivityTextKey, values: Record<string, string | number> = {}, seq = 0): string {
  const def = content.get('text', ACTIVITY_TEXT[key])
  return render(def.variants[Math.abs(Math.trunc(seq)) % def.variants.length]!, values)
}
