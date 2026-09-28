// 배경 띠 고르기(15 §8.3, 01 §1.2 배경 시간대 표, D72). 그림이 아직 없으면 가까운 것으로 내려간다(I87):
// 장소·계절·시간대 → 장소·계절 낮 → 장소 여름·시간대 → 장소 여름 낮 → 장소·시간대(계절 없는 곳, H5) → 장소 한 벌(지하) → H1 여름 낮
import { seasonAt, type World } from '@tap/core'

export type BgTime = 'dawn' | 'day' | 'dusk' | 'night'

// 마을에 있는 상태. 귀환 뒤 마을 정비가 끝날 때까지 출정 객체가 남아 있으므로(activity/sortie closeSortie) 상태로 가른다
const TOWN_STATES = new Set(['town_idle', 'town_prep', 'treatment'])
const shownState = (world: World): string => {
  const ca = world.state.current_activity
  return (ca.state === 'paused' ? ca.paused_from : ca.state) ?? 'town_idle'
}
const outing = (world: World) => (TOWN_STATES.has(shownState(world)) ? null : world.state.current_activity.sortie)

// 01 §1.2: 낮 출정은 떠나는 이동 새벽 · 현장 낮 · 귀환 해질녘, 밤 출정은 끝까지 밤, 마을은 낮(PC 시계 설정은 아직 없다)
export function bgTime(world: World): BgTime {
  const s = outing(world)
  const state = shownState(world)
  if (!s) return 'day'
  if (s.time_of_day === 'night') return 'night'
  if (state === 'travel') return 'dawn'
  if (state === 'return') return 'dusk'
  return 'day'
}

// 보이는 장소: 출정 중이면 목적지 풍경(이동 포함, 03 §15). 지하 목적지로 가는 이동은 A2 세트(15 §8.3, 임시)
// 지하 = 던전 층이거나 날씨가 닿지 않는 곳(01 §1.3 weather_exempt, A4 틈)
export function bgPlace(world: World): string {
  const ch = world.state.character
  const s = outing(world)
  const state = shownState(world)
  const id = s ? s.location_id : ch?.location ?? 'T00'
  if (s && (state === 'travel' || state === 'return') && world.content.has('region', id)) {
    const r = world.content.get('region', id)
    if (r.kind === 'dungeon_floor' || ('weather_exempt' in r && r.weather_exempt === true)) return 'A2'
  }
  return id
}

export function bgCandidates(world: World): string[] {
  const ch = world.state.character
  const p = bgPlace(world).toLowerCase()
  const season = ch ? seasonAt(ch.eff_min, ch.birth_season, world.content.balance.time) : 'summer'
  const t = bgTime(world)
  return [`bg_${p}_${season}_${t}`, `bg_${p}_${season}_day`, `bg_${p}_summer_${t}`, `bg_${p}_summer_day`, `bg_${p}_${t}`, `bg_${p}`, 'bg_h1_summer_day']
}

export function pickBackground(world: World, available: ReadonlySet<string>): string {
  return bgCandidates(world).find((f) => available.has(f)) ?? 'bg_h1_summer_day'
}
