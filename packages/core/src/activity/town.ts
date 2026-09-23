// 귀환 후 마을 루틴(04 §8)과 이동·야영·휴식·치료 행동.
import { dungeonTargets } from '../ai/index'
import { endGuildAidIfDue, isBankrupt, startGuildAid, townPrep, treatmentCost } from '../economy/index'
import { fireScheduledEvents, runJudgment, runTownReturnEffects } from '../events/index'
import { addJournal, closeBundle } from '../journal/index'
import { characterOf } from '../rules/context'
import { applyBloodRest, cellarRestSec } from '../life/index'
import { addFatigue } from '../rules/fatigue'
import { innFee } from '../rules/cost'
import { maxHp } from '../rules/derived'
import { camp, tickInjuries, townRest } from '../recovery/index'
import { fieldSoldLine } from '../items/bag'
import { modValue } from '../rules/modifiers'
import type { JournalDraft } from '../state/journal'
import type { ActionResolver, ResolvedDraft, World } from '../sim/world'
import { travelSec } from '../ai/index'
import { autoDrink, tickSortieBody } from './field'
import { addPendingSec, fieldPoint, takePendingSec } from './judgment'
import { line } from './lines'
import { runtimeOf } from './runtime'
import { arrivePlace, arriveTown, beginReturn, closeSortie, COUNTERS, currentSortie, townId } from './sortie'
import { generateRooms } from './dungeon'

// 마을 루틴 단계(04 §8). 0 = 완료
export const TOWN_STEPS = { arrive: 1, treatment: 2, rest: 3, prep: 4, family: 5, done: 0 } as const

const stepOf = (world: World): number => characterOf(world).counters[COUNTERS.townStep] ?? TOWN_STEPS.done
const setStep = (world: World, n: number): void => void (characterOf(world).counters[COUNTERS.townStep] = n)

const secOf = (v: number | [number, number], rng: { int(a: number, b: number): number }): number =>
  typeof v === 'number' ? v : rng.int(v[0], v[1])

export const needsSeriousTreatment = (world: World): boolean => characterOf(world).injuries.some((i) => i.grade === 'serious')

export function needsRest(world: World): boolean {
  const b = world.content.balance.recovery.town_rest_when
  const ch = characterOf(world)
  return ch.hp < maxHp(world) * b.hp_ratio_lt || ch.fatigue > b.fatigue_gt
}

// 길드 등급 갱신(01 §8.3): 조건을 만족하는 가장 높은 등급으로 올린다
export function updateGuildRank(world: World): boolean {
  const { content } = world
  const ch = characterOf(world)
  const ranks = [...content.list('guild_rank')].sort((a, b) => a.order - b.order)
  let best = ch.guild_rank
  for (const r of ranks) if (world.test(r.condition)) best = r.id
  if (content.get('guild_rank', best).order <= content.get('guild_rank', ch.guild_rank).order) return false
  ch.guild_rank = best
  addJournal(world, { tag: 'growth', sub: 'rank', line: line(content, 'guild_rank', { rank: content.get('guild_rank', best).name }) })
  return true
}

// ── 이동 ──

export const travelResolver: ActionResolver = {
  resolve(world: World): ResolvedDraft {
    const b = world.content.balance
    const s = currentSortie(world)
    const back = world.state.current_activity.state === 'return'
    const place = world.content.get('region', s.location_id)
    let sec = travelSec(world, s.location_id)
    if (back) {
      // 던전 중간 귀환은 지나온 방마다 시간을 더한다(04 §12.2)
      if (s.activity === 'dungeon') sec += b.actions.dungeon_retreat_sec_per_room * s.progress
      if ((characterOf(world).counters[COUNTERS.sortieDefeats] ?? 0) > 0) sec = Math.round(sec * b.defeat.return_travel_mult)
      sec += modValue(world, 'return_travel_sec_add', 0)
    }
    const journal: JournalDraft[] = back ? [] : [{
      tag: 'travel',
      line: s.weather === 'rain' ? line(world.content, 'travel_depart_rain') : line(world.content, 'travel_depart', { place: place.name }),
      detail: line(world.content, 'travel_depart_detail', { name: characterOf(world).name, place: place.name }),
      refs: { location_id: s.location_id, sortie_id: s.id },
    }]
    return { duration_sec: Math.max(1, sec) + takePendingSec(world), outcome: back ? 'return' : 'arrive', effects: [], journal }
  },
  apply(world: World, action): void {
    const b = world.content.balance
    const back = action.outcome === 'return'
    addFatigue(world, b.actions.travel_leg.fatigue + modValue(world, 'travel_fatigue_add', 0))
    tickSortieBody(world, action.duration_sec / 60)
    if (back) {
      closeBundle(world) // 출정 종료: 열린 묶음을 마을 기록보다 먼저 남긴다(14 §4)
      // 현장 정리 기록은 출정마다 묶어서 한 줄(08 §9.3 3)
      const ch = characterOf(world)
      const sold = ch.counters[COUNTERS.fieldSold] ?? 0
      if (sold) addJournal(world, fieldSoldLine(sold))
      ch.counters[COUNTERS.fieldSold] = 0
      arriveTown(world)
      return
    }
    arrivePlace(world)
    const s = currentSortie(world)
    if (s.activity === 'dungeon') s.plan = { rooms: generateRooms(world, s.location_id), gate: true }
  },
}

// ── 야영 ──

export const campResolver: ActionResolver = {
  resolve(world: World): ResolvedDraft {
    const sec = world.content.balance.recovery.camp.sec + takePendingSec(world)
    return {
      duration_sec: sec,
      outcome: 'camp',
      effects: [],
      journal: [{ tag: 'rest', line: line(world.content, 'rest_camp', {}, currentSortie(world).camps), refs: { location_id: currentSortie(world).location_id } }],
    }
  },
  apply(world: World, action): void {
    const s = currentSortie(world)
    camp(world)
    s.camps += 1
    tickSortieBody(world, action.duration_sec / 60)
    world.state.current_activity.state = s.activity === 'dungeon' ? 'dungeon' : s.activity === 'adventure' ? 'adventure' : 'hunt'
    fieldPoint(world, 'camp')
  },
}

// ── 마을 휴식(여관·길드 숙소) ──

// 04 §8 3단계: 여관비를 낼 수 있으면 여관, 아니면 길드 숙소
const restKind = (world: World): 'inn' | 'lodging' => (characterOf(world).coins >= innFee(world) ? 'inn' : 'lodging')

// 흡혈귀는 여관 대신 지하 저장고를 쓴다(09 §7.4: 비용은 같고 시간만 다르다)
function restSec(world: World, kind: 'inn' | 'lodging'): number {
  const b = world.content.balance
  const cellar = cellarRestSec(world)
  if (kind === 'inn' && cellar !== null) return cellar
  return kind === 'inn' ? b.actions.inn.sec[0] : b.actions.guild_lodging.sec[0]
}

export const innResolver: ActionResolver = {
  resolve(world: World): ResolvedDraft {
    const kind = restKind(world)
    return { duration_sec: restSec(world, kind) + takePendingSec(world), outcome: kind, effects: [], journal: [] }
  },
  apply(world: World, action): void {
    // 한 행동 = 휴식 1회다. 더 쉬어야 하면 마을 루틴이 이 행동을 다시 잡는다(04 §8 "최대 2회")
    const kind = action.outcome === 'inn' ? 'inn' : 'lodging'
    const first = townRest(world, kind, 1)
    const r = first.times === 0 && kind === 'inn' ? townRest(world, 'lodging', 1) : first
    // 문장 변형은 마을 귀환 수 + 여관 숙박 수로 고른다(같은 저장이면 같은 문장, 한 귀환에 두 번 묵어도 바뀐다)
    const ch = characterOf(world)
    const seq = (ch.counters[COUNTERS.sorties] ?? 0) + (ch.counters.inn_rests ?? 0)
    addJournal(world, { tag: 'rest', line: line(world.content, 'rest_inn', {}, seq), refs: { location_id: ch.location } })
    tickInjuries(world, action.duration_sec / 60)
    if (r.hp === 0 || !needsRest(world)) setStep(world, TOWN_STEPS.prep)
  },
}

// ── 중상 치료 ──

export const treatmentResolver: ActionResolver = {
  resolve(world: World): ResolvedDraft {
    const inj = world.content.balance.injury.serious
    const ch = characterOf(world)
    const paid = !ch.mutation && ch.coins >= treatmentCost(world, 'serious')
    const min = ch.mutation
      ? world.content.get('trait', ch.mutation.trait_id).mutation!.blood_rest.min
      : paid ? inj.clinic_min : inj.free_min
    // 치료 기록(14 §5.1 [마을]). 피의 휴식은 변이 쪽이 제 기록을 남긴다
    const journal: JournalDraft[] = ch.mutation ? [] : [paid
      ? {
        tag: 'town',
        line: line(world.content, 'town_treatment'),
        detail: line(world.content, 'town_treatment_detail', { name: ch.name, coins: treatmentCost(world, 'serious') }),
      }
      : {
        tag: 'town',
        line: line(world.content, 'town_treatment_free'),
        detail: line(world.content, 'town_treatment_free_detail', { name: ch.name }),
      }]
    return { duration_sec: Math.round(min * 60) + takePendingSec(world), outcome: paid ? 'clinic' : 'free', effects: [], journal }
  },
  apply(world: World, action): void {
    const ch = characterOf(world)
    if (ch.mutation) {
      // 피의 휴식(09 §7.4): 무료, 치유 등급과 갈증 +20은 변이 정의가 소유한다
      for (const d of applyBloodRest(world).journal) addJournal(world, d)
    } else {
      if (action.outcome === 'clinic') ch.coins = Math.max(0, ch.coins - treatmentCost(world, 'serious'))
      ch.injuries = ch.injuries.filter((i) => i.grade !== 'serious')
    }
    tickInjuries(world, action.duration_sec / 60)
    world.state.current_activity.state = 'town_idle'
    setStep(world, TOWN_STEPS.rest)
  },
}

// ── 마을 루틴 본체 ──

// 1단계 도착: 밀린 마을 효과 → 예약 사건 → J1 생활 사건(귀환당 1회) → 길드 등급
function applyArrive(world: World): void {
  const town = townId(world)
  runTownReturnEffects(world, world.ports)
  fireScheduledEvents(world, 'next_town_return', town, world.ports)
  runJudgment(world, { trigger: 'town_return', place: town }, world.ports)
  updateGuildRank(world)
  setStep(world, TOWN_STEPS.treatment)
}

// 4단계 정비: 08 §8 순서를 economy가 맡는다(I41)
function applyPrep(world: World): void {
  const rt = runtimeOf(world)
  const ch = characterOf(world)
  const night = ch.last_trip_time === 'night'
  const dungeonCandidate = dungeonTargets(world, night, { night }).length > 0
  const r = townPrep(world, world.rng.loot, rt.shop, { dungeonCandidate, mainPlace: world.state.current_activity.sortie?.location_id ?? null })
  for (const d of r.journal) addJournal(world, d)
  // 14 §4 마을 정비 묶음: 판매·구매·치료·정비비를 1건으로. 한 줄은 쓴 동전, 펼침은 내역
  // 쓴 동전이 없으면 동전 구절을 뺀 문형(14 §4, "동전 0개" 금지)
  const prep = line(world.content, r.spent > 0 ? 'town_prep' : 'town_prep_no_coins', { coins: r.spent })
  addJournal(world, { tag: 'town', line: prep, ...(r.breakdown.length ? { detail: [`${prep}.`, ...r.breakdown].join('\n') } : {}) })
  // 경상 치료 시간(04 §8 2단계, 개당 10초)은 다음 행동으로 넘긴다
  const lightSec = secOf(world.content.balance.activity_ai.town_routine_sec.light_treat_each ?? 0, world.rng.world)
  addPendingSec(world, r.lightTreated * lightSec)
  autoDrink(world, 'town')
  closeSortie(world)
  // 파산·길드 지원(01 §9.6, 08 §11). S06 발화는 시스템 사건이라 T10 훅에 넘긴다.
  // S06의 조건이 `guild_aid_active: false`라 지원을 켜기 전에 발화해야 한다(17 §4 단계 2)
  if (r.bankrupt && !ch.guild_aid.active) {
    rt.onSystemPhase?.(world, 'judgment')
    startGuildAid(world)
  } else endGuildAidIfDue(world)
  setStep(world, TOWN_STEPS.family)
}

// 8단계 편지·가족(D43): S01·S02·S07 발화는 생애·계승(T10)이 가져간다. 훅이 없으면 건너뛴다
function applyFamily(world: World): void {
  runtimeOf(world).onSystemPhase?.(world, 'town_routine_family')
  setStep(world, TOWN_STEPS.done)
}

export const townResolver: ActionResolver = {
  resolve(world: World): ResolvedDraft {
    const cfg = world.content.balance.activity_ai
    const step = stepOf(world)
    const t = cfg.town_routine_sec
    const rng = world.rng.world
    const sec = step === TOWN_STEPS.arrive ? secOf(t.arrive, rng)
      : step === TOWN_STEPS.prep ? secOf(t.sell, rng) + secOf(t.supplies, rng) + secOf(t.gear, rng) + secOf(t.maintenance, rng)
      : step === TOWN_STEPS.family ? secOf(t.family, rng)
      : rng.int(cfg.town_idle_sec[0], cfg.town_idle_sec[1])
    return { duration_sec: sec + takePendingSec(world), outcome: `town_${step}`, effects: [], journal: [] }
  },
  apply(world: World, action): void {
    const step = stepOf(world)
    if (step === TOWN_STEPS.arrive) applyArrive(world)
    else if (step === TOWN_STEPS.prep) applyPrep(world)
    else if (step === TOWN_STEPS.family) applyFamily(world)
    tickInjuries(world, action.duration_sec / 60)
  },
}

export { beginReturn }
