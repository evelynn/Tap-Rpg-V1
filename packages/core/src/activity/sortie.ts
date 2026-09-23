// 출정 시작·진행·종료(04 §7), 이동과 귀환, 적자 기록(04 §4.3).
import { chainMissions, type SortieChoice } from '../ai/index'
import { earnCoins, expectedSpend, sellPrice } from '../economy/index'
import { rewardUnits } from '../events/index'
import { addJournal } from '../journal/index'
import { thirstOnSortieStart } from '../life/index'
import { characterOf } from '../rules/context'
import { addSkillUses, addXp } from '../rules/growth'
import { SLOTS, type Effect } from '../schema/index'
import type { Sortie } from '../state/activity'
import type { TempMod } from '../state/common'
import { issueUid } from '../state/uid'
import { renderTemplate } from '../text/index'
import type { World } from '../sim/world'

// 저장 스키마에 자리가 없어 카운터로 세는 값(T11 후보)
export const COUNTERS = {
  sorties: 'sorties',
  safeReturns: 'safe_returns',
  sortieDefeats: 'sortie_defeats', // 이번 출정에서 쓰러진 횟수(무사 귀환 판정)
  townStep: 'town_step', // 마을 루틴 진행 단계(0 = 완료)
  pendingSec: 'pending_sec', // 사건이 더한 연출 시간(add_time)을 다음 행동으로 넘긴다
} as const

// 사건이 더한 연출 시간(add_time)·회복약 연출 시간은 다음 행동 길이로 넘긴다(저장 칸이 없어 카운터로 둔다, I44 후보)
export function addPendingSec(world: World, sec: number): void {
  if (sec <= 0) return
  const ch = characterOf(world)
  ch.counters[COUNTERS.pendingSec] = (ch.counters[COUNTERS.pendingSec] ?? 0) + Math.round(sec)
}

export function takePendingSec(world: World): number {
  const ch = characterOf(world)
  const n = ch.counters[COUNTERS.pendingSec] ?? 0
  ch.counters[COUNTERS.pendingSec] = 0
  return n
}

export const currentSortie = (world: World): Sortie => {
  const s = world.state.current_activity.sortie
  if (!s) throw new Error('진행 중인 출정이 없다')
  return s
}

export const townId = (world: World): string => world.content.list('region').find((r) => r.kind === 'town')!.id

export const sortieElapsedMin = (world: World): number => characterOf(world).eff_min - currentSortie(world).started_eff_min

// 출정 구성(04 §7.2·§7.3·§7.4). 던전 방 배열은 층에 들어설 때 만든다(07 §5.2)
export function sortiePlan(world: World, choice: SortieChoice): Sortie['plan'] {
  const b = world.content.balance
  const att = world.content.get('attitude', world.state.policies.attitude)
  if (choice.activity === 'hunt') {
    const jitter = b.activity_ai.hunt.target_jitter
    // 새 인물의 첫 출정은 태도와 무관하게 고정 수(무작위 가감 없음)
    const target = world.test(b.first_sortie.when)
      ? b.first_sortie.encounters
      : att.hunt_target_encounters + world.rng.world.int(-jitter, jitter)
    return { target_encounters: Math.max(1, target), safety_cap: b.activity_ai.hunt.safety_cap_encounters }
  }
  if (choice.activity === 'adventure') {
    const r = world.content.get('region', choice.location_id)
    const want = world.rng.world.int(att.adventure_scenes[0], att.adventure_scenes[1])
    const range = r.kind === 'adventure_route' ? r.scenes : ([want, want] as [number, number])
    return { scenes: Math.max(1, Math.max(range[0], Math.min(range[1], want))) }
  }
  return { rooms: [], gate: true }
}

// 대기 scope의 일시 수정자를 켠다(ARCHITECTURE §3)
function wakeTempMods(mods: TempMod[], from: TempMod['scope'], to: TempMod['scope']): { kept: TempMod[]; woken: TempMod[] } {
  const woken: TempMod[] = []
  const kept: TempMod[] = []
  for (const m of mods) (m.scope === from ? woken : kept).push(m)
  return { kept, woken: woken.map((m) => ({ ...m, scope: to })) }
}

// 출정 시작: 확정 결과 없이 상태만 만든다(난수는 구성에만 쓴다)
export function startSortie(world: World, choice: SortieChoice): Sortie {
  const { content, state } = world
  const b = content.balance
  const ch = characterOf(world)
  const ca = state.current_activity
  const plan = sortiePlan(world, choice)
  const s: Sortie = {
    id: issueUid(state.family, 'sortie'),
    activity: choice.activity,
    location_id: choice.location_id,
    time_of_day: choice.time_of_day,
    weather: choice.weather,
    started_eff_min: ch.eff_min,
    plan,
    progress: 0,
    trip_flags: {},
    temp_mods: [],
    dungeon_mods: [],
    quest_wins: ch.quest && ch.quest.location_id === choice.location_id ? 0 : null,
    loot: { coins: 0, item_uids: [], materials: {} },
    potions_used: 0,
    events_this_sortie: 0,
    camps: 0,
    discovery_attempts: [],
    exclusive_used: [],
    fate_offered: false,
  }
  // 낮 출정 1회 시작 갈증(09 §7.5)
  for (const d of thirstOnSortieStart(world, choice.time_of_day).journal) addJournal(world, d)
  const { kept, woken } = wakeTempMods(ch.temp_mods, 'next_sortie', 'sortie')
  ch.temp_mods = kept
  s.temp_mods.push(...woken)
  ca.sortie = s
  ca.state = 'travel'
  ca.next_sortie_override = null
  ch.counters[COUNTERS.sortieDefeats] = 0
  ch.counters[COUNTERS.townStep] = 0
  ch.decision_seq += 1

  // 반복 계수(04 §5.2)와 상한 알림(04 §4.4)
  const streak = ch.activity_streak
  ch.activity_streak = streak && streak.activity === choice.activity ? { activity: choice.activity, k: streak.k + 1 } : { activity: choice.activity, k: 1 }
  ch.low_cap_streak = choice.low_cap_only ? ch.low_cap_streak + 1 : 0
  if (ch.low_cap_streak === b.activity_ai.low_cap_notice_streak) {
    addJournal(world, { tag: 'town', line: b.activity_ai.lines.low_cap })
  }
  if (choice.forced_nearby) addJournal(world, { tag: 'town', line: b.activity_ai.lines.forced_nearby })

  // 임무 보류 시계(04 §3.3): 이번에 가지 않은 줄기는 보류로 센다
  for (const m of chainMissions(world)) {
    const cm = ch.chain_mission[m.key] ?? { priority_sorties: 0, pending_since_eff_min: null }
    if (m.location_id === choice.location_id) {
      ch.chain_mission[m.key] = { priority_sorties: cm.priority_sorties + 1, pending_since_eff_min: null }
    } else {
      ch.chain_mission[m.key] = { priority_sorties: 0, pending_since_eff_min: cm.pending_since_eff_min ?? ch.eff_min }
    }
  }

  // 장착 장비의 출정 충전 초기화(I38: 출정·생애 초기화는 활동 층이 한다)
  for (const slot of SLOTS) {
    const uid = state.inventory.equipped[slot]
    const inst = uid ? state.item_instances[uid] : undefined
    if (inst?.charges) delete inst.charges
  }
  return s
}

// 이동 도착(J7): 방문 기록, 이번 방문 대기 효과, 활동 상태로 전이
export function arrivePlace(world: World): void {
  const { state } = world
  const ch = characterOf(world)
  const s = currentSortie(world)
  ch.location = s.location_id
  if (!ch.visited.includes(s.location_id)) ch.visited.push(s.location_id)
  const pending = ch.next_visit_mods[s.location_id]
  if (pending) {
    delete ch.next_visit_mods[s.location_id]
    for (const e of pending) {
      if (e.type === 'temp_mod') {
        const t = e as unknown as { modifier: TempMod['modifier']; count?: number; duration_min?: number }
        s.temp_mods.push({ modifier: t.modifier, scope: 'sortie', remaining: t.count ?? null, expires_eff_min: null, source_event: null })
      } else s.dungeon_mods.push(e)
    }
  }
  state.current_activity.state = s.activity === 'dungeon' ? 'dungeon' : s.activity === 'adventure' ? 'adventure' : 'hunt'
}

// 귀환 시작(04 §2.2). 이미 귀환 중이면 아무 일도 하지 않는다
export function beginReturn(world: World): void {
  const ca = world.state.current_activity
  if (ca.sortie && ca.state !== 'return') ca.state = 'return'
}

// 이번 출정 전리품의 값어치(동전 + 재료 판매가 + 장비 판매가)
function sortieIncome(world: World, s: Sortie): number {
  let sum = s.loot.coins
  for (const id of Object.keys(s.loot.materials).sort()) sum += world.content.get('material', id).sell_price * (s.loot.materials[id] ?? 0)
  for (const uid of s.loot.item_uids) {
    const inst = world.state.item_instances[uid]
    if (inst) sum += sellPrice(world, inst) ?? 0
  }
  return sum
}

// 적자 활동 제외(04 §4.3): 최근 window회 수지의 합이 음수면 exclude_decisions회 동안 후보에서 뺀다
export function recordDeficit(world: World, s: Sortie): void {
  const { content } = world
  const ch = characterOf(world)
  const r = content.get('region', s.location_id)
  if (r.deficit_exempt === 'always') return
  if (r.deficit_exempt === 'during_aid' && ch.guild_aid.active) return
  const cfg = content.balance.activity_ai.deficit
  const net = Math.round(sortieIncome(world, s) - expectedSpend(world))
  const prev = ch.deficit[s.location_id] ?? { recent_net: [], excluded_until_decision: null }
  const recent = [...prev.recent_net, net].slice(-cfg.window)
  const excluded = recent.length >= cfg.min_sorties && recent.reduce((a, b) => a + b, 0) < 0
  ch.deficit[s.location_id] = {
    recent_net: recent,
    excluded_until_decision: excluded ? ch.decision_seq + cfg.exclude_decisions : prev.excluded_until_decision,
  }
  if (excluded && prev.excluded_until_decision === null) {
    addJournal(world, { tag: 'town', line: renderTemplate(cfg.line, { place: r.name }) })
  }
}

// 사건 정의 안에서 effect 하나를 찾는다(의뢰 정산 문장이 accept_quest 효과에 있다)
function findEffect(list: readonly Effect[], type: string): Effect | null {
  for (const e of list) {
    if (e.type === type) return e
    for (const v of Object.values(e)) {
      if (!Array.isArray(v) || !v.length || typeof v[0] !== 'object' || v[0] === null || !('type' in (v[0] as object))) continue
      const r = findEffect(v as Effect[], type)
      if (r) return r
    }
  }
  return null
}

// 길드 의뢰 정산(11 L06, 04 §3.3): 기한은 다음 출정 하나다. 달성 비율로 보상을 주고 의뢰를 지운다
export function settleQuest(world: World, s: Sortie): void {
  const ch = characterOf(world)
  const q = ch.quest
  if (!q || s.started_eff_min < q.accepted_eff_min) return
  ch.quest = null
  const unit = rewardUnits(world, q.location_id)
  const cancelled = ch.injuries.some((i) => i.grade === 'serious')
  const ratio = cancelled ? 0 : Math.min(1, q.wins / q.goal_wins)
  const coins = Math.floor(ratio * q.reward.coin_units * unit.coins)
  const xp = Math.floor(ratio * q.reward.xp_units * unit.xp)
  earnCoins(world, coins)
  if (xp > 0) addXp(world, world.rng.life, xp)
  const key = cancelled ? 'cancel' : ratio >= 1 ? 'complete' : 'partial'
  const ev = world.content.has('event', q.event_id) ? world.content.get('event', q.event_id) : null
  const eff = ev ? ev.choices.flatMap((c) => Object.values(c.outcomes).flatMap((o) => (o ? findEffect(o.effects, 'accept_quest') ?? [] : []))) : []
  const lines = (eff[0] as unknown as { lines?: Record<string, string> } | undefined)?.lines
  if (lines?.[key]) {
    addJournal(world, { tag: 'town', line: renderTemplate(lines[key], { coins, place: world.content.get('region', q.location_id).name }) })
  }
}

// 마을 도착(J1 앞): 출정 집계와 마을 루틴 시작. 출정 객체는 마을 정비가 재료를 팔 때까지 남긴다
export function arriveTown(world: World): void {
  const { content, state } = world
  const ch = characterOf(world)
  const s = currentSortie(world)
  ch.location = townId(world)
  ch.last_trip_time = s.time_of_day
  ch.counters[COUNTERS.sorties] = (ch.counters[COUNTERS.sorties] ?? 0) + 1
  if ((ch.counters[COUNTERS.sortieDefeats] ?? 0) === 0) {
    ch.counters[COUNTERS.safeReturns] = (ch.counters[COUNTERS.safeReturns] ?? 0) + 1
    const at = (ch.counters_at[COUNTERS.safeReturns] ??= {})
    at[s.location_id] = (at[s.location_id] ?? 0) + 1
    addSkillUses(world, 'survival', content.balance.skills.use_counts.safe_return)
  }
  settleQuest(world, s)
  recordDeficit(world, s)
  // 출정 동안만 살아 있는 일시 수정자는 여기서 끝난다
  s.temp_mods = []
  s.trip_flags = {}
  state.current_activity.state = 'town_idle'
  ch.counters[COUNTERS.townStep] = 1
}

// 마을 정비까지 끝나면 출정 객체를 지운다(재료 판매가 loot를 읽는다)
export function closeSortie(world: World): void {
  world.state.current_activity.sortie = null
}
