// 활동 층이 쓰는 문형 슬롯(14 §4·§5.1)과 기록 도우미. 문장은 콘텐츠(text 종류)에 있다.
import type { Content } from '../content/index'
import { render } from '../events/index'
import { registerTextSlot } from '../schema/index'

// 코어가 부르는 문형 id. 번들에 없으면 콘텐츠 검사 V2가 잡는다
export const ACTIVITY_TEXT = {
  hunt_win: 'journal.hunt.win',
  hunt_win_detail: 'journal.hunt.win_detail',
  hunt_win_detail_no_coins: 'journal.hunt.win_detail_no_coins',
  hunt_enemy_first_detail: 'journal.hunt.enemy_first_detail',
  adventure_scene: 'journal.adventure.scene',
  adventure_scene_detail: 'journal.adventure.scene_detail',
  adventure_map_detail: 'journal.adventure.map_detail',
  adventure_map: 'journal.adventure.map',
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
  rest_second_wind: 'journal.rest.second_wind',
  rest_second_wind_detail: 'journal.rest.second_wind_detail',
  rest_inn: 'journal.rest.inn',
  rest_no_rain_detail: 'journal.rest.no_rain_detail',
  rest_rain_detail: 'journal.rest.rain_detail',
  rest_recover_detail: 'journal.rest.recover_detail',
  rest_recover_hp_detail: 'journal.rest.recover_hp_detail',
  rest_recover_fatigue_detail: 'journal.rest.recover_fatigue_detail',
  potions_detail: 'journal.sortie.potions_detail',
  town_prep: 'journal.town.prep',
  town_prep_no_coins: 'journal.town.prep_no_coins',
  town_treatment: 'journal.town.treatment',
  town_treatment_detail: 'journal.town.treatment_detail',
  town_treatment_free: 'journal.town.treatment_free',
  town_treatment_free_detail: 'journal.town.treatment_free_detail',
  discovery_place: 'journal.discovery.place',
  discovery_place_detail: 'journal.discovery.place_detail',
  discovery_place_again_detail: 'journal.discovery.place_again_detail',
  guild_rank: 'journal.growth.guild_rank',
  dungeon_quiet_detail: 'journal.dungeon.quiet_detail',
  gate_turn_back_detail: 'journal.dungeon.gate_turn_back_detail',
  gate_lost_detail: 'journal.dungeon.gate_lost_detail',
  rescued_detail: 'journal.injury.rescued_detail',
  quest_complete_detail: 'journal.town.quest_complete_detail',
  quest_partial_detail: 'journal.town.quest_partial_detail',
  quest_cancel_detail: 'journal.town.quest_cancel_detail',
  quest_unpaid_detail: 'journal.town.quest_unpaid_detail',
  deficit_detail: 'journal.town.deficit_detail',
  guild_rank_detail: 'journal.growth.guild_rank_detail',
  guild_rank_plain_detail: 'journal.growth.guild_rank_plain_detail',
} as const

export type ActivityTextKey = keyof typeof ACTIVITY_TEXT

for (const id of Object.values(ACTIVITY_TEXT)) registerTextSlot(id, '활동 층(04·07)')

// 문형 변형은 난수가 아니라 seq로 고른다(같은 저장이면 같은 문장)
export function line(content: Content, key: ActivityTextKey, values: Record<string, string | number> = {}, seq = 0): string {
  const def = content.get('text', ACTIVITY_TEXT[key])
  return render(def.variants[Math.abs(Math.trunc(seq)) % def.variants.length]!, values)
}
