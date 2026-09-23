// 행동 결정 알고리즘(04 §3): 시간대 → 첫 출정 고정 → 사건 목적지 → 임무 → 가중 선택 → 장소 선택 → 날씨.
import { characterOf, type RuleContext } from '../rules/context'
import type { Rng } from '../rules/random'
import { weightedPick } from '../rules/random'
import type { TIME_OF_DAY, WEATHERS } from '../schema/index'
import { WEATHERS as WEATHER_LIST } from '../schema/index'
import { seasonAt } from '../time/index'
import { filterPlaces, fixedDestination, type Candidate } from './candidates'
import { activityWeights, dungeonTargets, pickActivity, pickLocation, priorityMission } from './score'
import { activityOf, type Activity } from './risk'

export type TimeOfDay = (typeof TIME_OF_DAY)[number]
export type Weather = (typeof WEATHERS)[number]

export type DecideWorld = RuleContext & { rng: { world: Rng } }

export interface SortieChoice {
  activity: Activity
  location_id: string
  time_of_day: TimeOfDay
  weather: Weather
  source: 'first_sortie' | 'override' | 'destination' | 'mission' | 'weighted' | 'fallback'
  forced_nearby: boolean // 4.4 (2) 고정 장소가 F4에서 떨어져 이번 출정만 고정을 무시했다
  low_cap_only: boolean // 4.4 순찰 구역만 남았다
}

// 시간대(04 §7.8, F9): 기본 낮/밤 비율, 변이는 제 time_ratio와 갈증 단계 night_ratio(09 §7.3)
export function pickTimeOfDay(w: DecideWorld): TimeOfDay {
  const ch = characterOf(w)
  let night = w.content.balance.time.day_night_ratio[1]
  if (ch.mutation) {
    const m = w.content.get('trait', ch.mutation.trait_id).mutation
    if (m) {
      night = m.time_ratio.night
      const stage = [...m.thirst.stages].sort((a, b) => a.from - b.from).filter((s) => s.from <= ch.mutation!.thirst).pop()
      if (stage?.night_ratio !== undefined) night = stage.night_ratio
    }
  }
  return w.rng.world.chance(night) ? 'night' : 'day'
}

// 날씨(01 §1.3): 출정 시작 계절의 가중치
export function pickWeather(w: DecideWorld): Weather {
  const ch = characterOf(w)
  const b = w.content.balance
  const season = seasonAt(ch.eff_min, ch.birth_season, b.time)
  const table = b.weather.season_weights[season]
  return WEATHER_LIST[weightedPick(w.rng.world, WEATHER_LIST.map((x) => table[x]))]!
}

// 이번 결정의 후보(F1~F8). 고정 장소가 모두 떨어지면 고정을 무시하고 다시 거른다(04 §4.4)
export function decideCandidates(w: RuleContext, night: boolean): { cands: Candidate[]; forcedNearby: boolean } {
  const gather = (ignoreDestination: boolean): Candidate[] => {
    const field = filterPlaces(w, { night, ignoreDestination }).filter((c) => c.activity !== 'dungeon')
    const fixed = ignoreDestination ? null : fixedDestination(w)
    // 목적지 고정 중이면 던전도 고정 장소만 본다(F5). 아니면 묶음별 목표 층을 쓴다(04 §6.2)
    const dungeon = fixed !== null
      ? filterPlaces(w, { night, ignoreDestination }).filter((c) => c.activity === 'dungeon')
      : dungeonTargets(w, night, { night })
    return [...field, ...dungeon]
  }
  const first = gather(false)
  if (first.length || fixedDestination(w) === null) return { cands: first, forcedNearby: false }
  return { cands: gather(true), forcedNearby: true }
}

// 후보가 하나도 없을 때의 대체 장소(01 §7.1 순찰 구역, region.fallback)
export function fallbackPlace(w: RuleContext): Candidate | null {
  const all = filterPlaces(w, { night: false, ignoreDestination: true, skipRiskFilters: true })
  return all.find((c) => w.content.get('region', c.id).fallback) ?? all[0] ?? null
}

// 다음 출정을 고른다. 중상 치료·마을 루틴은 부르는 쪽이 먼저 처리한다
export function decideSortie(w: DecideWorld): SortieChoice {
  const b = w.content.balance
  const time_of_day = pickTimeOfDay(w)
  const night = time_of_day === 'night'
  const finish = (activity: Activity, location_id: string, source: SortieChoice['source'], forced = false, lowCap = false): SortieChoice =>
    ({ activity, location_id, time_of_day, weather: pickWeather(w), source, forced_nearby: forced, low_cap_only: lowCap })

  // 사건이 정한 목적지(set_destination·accept_quest)
  const override = w.state.current_activity.next_sortie_override
  if (override && w.content.has('region', override.location_id)) return finish(override.activity, override.location_id, 'override')

  // 첫 출정 고정(04 §11, D21)
  const fs = b.first_sortie
  if (w.test(fs.when)) return finish(fs.activity, fs.location, 'first_sortie')

  const { cands, forcedNearby } = decideCandidates(w, night)
  if (!cands.length) {
    const fb = fallbackPlace(w)
    if (!fb) throw new Error('출정 후보가 하나도 없다(대체 장소 region.fallback도 없다)')
    return finish(fb.activity, fb.id, 'fallback', forcedNearby)
  }
  const lowCapOnly = cands.every((c) => w.content.get('region', c.id).patrol_zone)

  // 목적지 고정(F5)이 남긴 후보가 하나뿐이면 그곳으로 간다
  const fixed = forcedNearby ? null : fixedDestination(w)
  if (fixed !== null && cands.some((c) => c.id === fixed)) {
    return finish(activityOf(w.content.get('region', fixed).kind), fixed, 'destination', forcedNearby, lowCapOnly)
  }

  // 임무 우선 처리(04 §3.3)
  const m = priorityMission(w, cands)
  if (m) return finish(m.activity, m.location_id, 'mission', forcedNearby, lowCapOnly)

  const { weights, byActivity } = activityWeights(w, cands)
  const act = pickActivity(w.rng.world, weights)
  if (act === null) {
    const fb = fallbackPlace(w)
    if (!fb) throw new Error('활동 가중치가 모두 0이고 대체 장소도 없다')
    return finish(fb.activity, fb.id, 'fallback', forcedNearby, lowCapOnly)
  }
  const place = pickLocation(w, w.rng.world, byActivity[act])
  return finish(act, place, 'weighted', forcedNearby, lowCapOnly)
}
