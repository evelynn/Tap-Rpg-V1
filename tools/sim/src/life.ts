// 한 생애를 끝까지 돌리며 17 §5.2 지표를 관측한다.
//
// 게임 규칙은 다시 구현하지 않는다(17 §5.1): createGameWorld로 만든 세계를 advance로 흘리고,
// 관측은 확정 결과(ResolvedAction)와 저장 상태의 차이만 읽는다. 난수를 쓰지 않으므로 결과는 그대로다.
import {
  ageAt, createGameWorld, submitPendingAuto, SLOTS,
  type Appearance, type Character, type Content, type LifeRecord, type ResolvedAction, type World,
} from '@tap/core'

// 외형은 규칙에 영향이 없다(스프라이트 전용). 결정성을 위해 고정값을 쓴다
const APPEARANCE: Appearance = {
  body: 'body_base', hair: 'HR03', hair_color: 'hair_chestnut', skin_tone: 'skin_02', decor: [], age_stage_override: null,
}

// 가문 생성 시각. 유효 진행 시계만 쓰므로 값 자체는 결과에 영향이 없다(13 §8.3)
const FOUNDED_UTC = 1789500000000

// 한 번에 흘리는 초. 시계는 정수 밀리초라 나눠 흘려도 한 번에 흘린 것과 같다(World.advance).
// 선택 대기·계승 대기가 되면 advance가 그 자리에서 돌아오므로 크게 잡아도 놓치지 않는다
const STEP_SEC = 3600

// 갈증 경보 구간(17 §8 R8)
const THIRST_HIGH = 70

export interface LifeRow {
  // 식별
  attitude: string
  seed: number
  gen: number
  end_kind: string // retired / died / long_sleep / running(시간 상한에서 끊김)
  end_age: number
  minutes: number // 생애 유효 진행 분
  peak_level: number
  // 17 §5.2 지표
  combat_rounds: number | null // 적정 적 1체 전투의 라운드(생애 중앙값)
  combat_hp_loss: number | null // 같은 전투의 체력 손실 %(생애 중앙값)
  sortie_minutes: number | null // 출정 길이 분(생애 중앙값)
  level10_age: number | null
  level20_age: number | null
  retire_level: number | null // 은퇴로 끝난 생애만
  share_hunt: number | null // 출정 시간 비중 %
  share_adventure: number | null
  share_dungeon: number | null
  normal_defeats: number // 구조로 끝난 일반 패배
  fate_offers: number // 운명 사건 제시
  expense_ratio: number | null // 총지출 / 총수입 %
  first5_level2: number | null // 0/1, 새 가문 첫 인물만
  first5_equip: number | null
  first10_check: number | null
  first10_return: number | null
  first10_rest: number | null
  // 관찰 지표(17 §5.2 끝, 합격 기준 없음)
  income: number
  spend: number
  coins_end: number
  death_cause: string | null
  sorties: number
  discoveries: number
  event_repeat_max: number
  bankruptcies: number
  choice_waits: number
  level30: number
  guild_rank: string
  deep_dungeon_age: number | null
  deep_route_age: number | null
  vampire: number
  thirst_end: number
  thirst_max: number
  thirst_high_ratio: number // 갈증 THIRST_HIGH 이상으로 지낸 시간 비율 %
  // 집계에서만 쓰는 지도(CSV 열에는 넣지 않는다)
  fate_by_event: Record<string, number>
  consumables: Record<string, number>
}

export interface LifeOptions {
  attitude: string
  seed: number
  minutes: number // 생애당 유효 진행 분 상한
  lives: number // 한 가문에서 이어 볼 생애 수
}

// 시드 번호 → 가문 시드(16자리 소문자 16진)
export const seedHex = (n: number): string => (n >>> 0).toString(16).padStart(16, '0')

// 전투 결과를 담은 확정 결과 조각. 사냥은 통째로, 던전 방·관문·모험 장면은 enc 안에 들어 있다
interface EncounterLike {
  type: 'encounter'
  combat: { round_count: number; hp_start: number; hp_end: number; max_hp: number; rewards: { level: number }[] }
  defeat: { outcome: string } | null
}

// 확정 결과 안의 전투를 모두 찾는다(행동 종류마다 담기는 자리가 다르다, life-loop findDeath와 같은 방식)
function encountersIn(value: unknown, depth: number, out: EncounterLike[]): void {
  if (depth > 4 || typeof value !== 'object' || value === null) return
  if (Array.isArray(value)) {
    for (const v of value) encountersIn(v, depth + 1, out)
    return
  }
  const rec = value as Record<string, unknown>
  if (rec.type === 'encounter' && typeof rec.combat === 'object' && rec.combat !== null) {
    out.push(rec as unknown as EncounterLike)
    return
  }
  for (const v of Object.values(rec)) encountersIn(v, depth + 1, out)
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

// 생애 하나를 보는 동안 쌓는 값
interface Acc {
  charUid: string
  gen: number
  income: number
  spend: number
  rounds: number[]
  hpLoss: number[]
  sortieMin: number[]
  actMin: Record<string, number>
  defeats: number
  fateOffers: number
  fateByEvent: Record<string, number>
  choiceWaits: number
  level10: number | null
  level20: number | null
  level30: boolean
  level2Min: number | null
  firstEquipMin: number | null
  firstReturnMin: number | null
  firstRestMin: number | null
  firstCheckMin: number | null
  bankruptcies: number
  firstVisitAge: Record<string, number>
  vampire: boolean
  thirstMax: number
  thirstHighMin: number
  consumables: Record<string, number>
  consumablePrev: Record<string, number>
  eventRepeatMax: number
  seenSorties: Set<string>
  seenChoice: string | null
  lastJournalId: number
  aidActive: boolean
  visitedSeen: number
  equipKey: string | null
  // 생애가 끝나면 인물이 사라지므로 마지막으로 본 값을 들고 있는다
  lastEffMin: number
  lastCoins: number
  lastThirst: number
  lastLevel: number
  lastRank: string
  lastDiscoveries: number
  lastSorties: number
}

function newAcc(ch: Character): Acc {
  return {
    charUid: ch.uid, gen: ch.generation, income: 0, spend: 0, rounds: [], hpLoss: [], sortieMin: [], actMin: {},
    defeats: 0, fateOffers: 0, fateByEvent: {}, choiceWaits: 0, level10: null, level20: null, level30: false,
    level2Min: null, firstEquipMin: null, firstReturnMin: null, firstRestMin: null, firstCheckMin: null,
    bankruptcies: 0, firstVisitAge: {}, vampire: false, thirstMax: 0, thirstHighMin: 0, consumables: {},
    consumablePrev: {}, eventRepeatMax: 0, seenSorties: new Set(), seenChoice: null, lastJournalId: -1,
    aidActive: ch.guild_aid.active, visitedSeen: 0, equipKey: null,
    lastEffMin: ch.eff_min, lastCoins: ch.coins, lastThirst: 0, lastLevel: ch.level, lastRank: ch.guild_rank,
    lastDiscoveries: 0, lastSorties: 0,
  }
}

// 동전 출입을 인물의 coins 접근자로 가른다. 게임 규칙은 모두 ch.coins를 읽고 쓰므로 수입·지출이 갈라진다
function watchCoins(ch: Character, acc: Acc): void {
  let coins = ch.coins
  Object.defineProperty(ch, 'coins', {
    configurable: true,
    enumerable: true,
    get: () => coins,
    set: (v: number) => {
      const d = v - coins
      if (d > 0) acc.income += d
      else acc.spend -= d
      coins = v
    },
  })
}

class Watcher {
  private acc: Acc | null = null
  private closed = 0
  readonly rows: LifeRow[] = []

  constructor(private readonly world: World, private readonly opts: LifeOptions) {
    const apply = world.applyAction.bind(world)
    // 확정 결과는 적용되는 순간에만 손에 잡힌다(다음 행동이 덮어쓴다). 적용 전후를 둘러싸 전투·휴식을 센다
    world.applyAction = (action: ResolvedAction): void => {
      const level = world.state.character?.level ?? 0
      apply(action)
      this.onAction(action, level)
      this.sync()
    }
    this.sync()
  }

  // 선택 대기를 푼 뒤처럼 행동 밖에서 상태가 바뀐 곳에서도 부른다
  sync(): void {
    const st = this.world.state
    while (st.family.chronicle.length > this.closed) {
      const rec = st.family.chronicle[this.closed]!
      if (this.acc) this.rows.push(this.finish(this.acc, rec))
      this.closed += 1
      this.acc = null
    }
    const ch = st.character
    if (!ch) return
    if (!this.acc || this.acc.charUid !== ch.uid) {
      this.acc = newAcc(ch)
      watchCoins(ch, this.acc)
    }
    this.sample(ch)
  }

  // 시간 상한에서 끊긴 생애도 한 줄로 남긴다
  closeRunning(): void {
    const ch = this.world.state.character
    if (!this.acc || !ch) return
    this.rows.push(this.finish(this.acc, null))
    this.acc = null
  }

  private onAction(action: ResolvedAction, level: number): void {
    const a = this.acc
    if (!a) return
    if (action.kind === 'inn' && a.firstRestMin === null) a.firstRestMin = this.world.state.character?.eff_min ?? 0
    const found: EncounterLike[] = []
    encountersIn(action.effects, 0, found)
    for (const enc of found) {
      const c = enc.combat
      // 적정 적 1체 전투(17 §5.2): 적 레벨이 인물 레벨 ±1인 1체 전투
      const foe = c.rewards.length === 1 ? c.rewards[0] : undefined
      if (foe && Math.abs(foe.level - level) <= 1) {
        a.rounds.push(c.round_count)
        if (c.max_hp > 0) a.hpLoss.push((100 * (c.hp_start - c.hp_end)) / c.max_hp)
      }
      // 일반 패배 = 구조로 끝난 패배(치명 탈출·사망은 뺀다)
      if (enc.defeat?.outcome === 'rescued') a.defeats += 1
    }
  }

  private sample(ch: Character): void {
    const a = this.acc!
    const st = this.world.state
    const time = this.world.content.balance.time
    const age = ageAt(ch.eff_min, time)

    const thirst = ch.mutation?.thirst ?? 0
    if (thirst >= THIRST_HIGH) a.thirstHighMin += Math.max(0, ch.eff_min - a.lastEffMin)
    a.lastEffMin = ch.eff_min
    a.lastCoins = ch.coins
    a.lastThirst = thirst
    a.lastLevel = Math.max(a.lastLevel, ch.level)
    a.lastRank = ch.guild_rank
    a.lastDiscoveries = ch.discoveries.length
    a.lastSorties = ch.counters.sorties ?? 0
    a.thirstMax = Math.max(a.thirstMax, thirst)
    if (ch.mutation) a.vampire = true

    if (a.level2Min === null && ch.level >= 2) a.level2Min = ch.eff_min
    if (a.level10 === null && ch.level >= 10) a.level10 = age
    if (a.level20 === null && ch.level >= 20) a.level20 = age
    if (ch.level >= 30) a.level30 = true

    // 장비 교체: 장착 슬롯 조합이 처음 바뀐 시점(첫 5분 항목, 01 §17)
    const eq = SLOTS.map((s) => st.inventory.equipped[s] ?? '').join('|')
    if (a.equipKey === null) a.equipKey = eq
    else if (eq !== a.equipKey) {
      a.equipKey = eq
      if (a.firstEquipMin === null) a.firstEquipMin = ch.eff_min
    }

    for (const id of ch.visited.slice(a.visitedSeen)) a.firstVisitAge[id] ??= age
    a.visitedSeen = ch.visited.length

    if (ch.guild_aid.active && !a.aidActive) a.bankruptcies += 1
    a.aidActive = ch.guild_aid.active

    const now = st.inventory.consumables
    for (const id of new Set([...Object.keys(a.consumablePrev), ...Object.keys(now)])) {
      const used = (a.consumablePrev[id] ?? 0) - (now[id] ?? 0)
      if (used > 0) a.consumables[id] = (a.consumables[id] ?? 0) + used
    }
    a.consumablePrev = { ...now }

    // 생활 사건 반복(17 §5.2 관찰 지표, 9절 G3): 생활 사건만 센다
    for (const [id, n] of Object.entries(ch.event_counts)) {
      if (n <= a.eventRepeatMax) continue
      if (!this.world.content.has('event', id) || this.world.content.get('event', id).category !== 'life') continue
      a.eventRepeatMax = n
    }

    const p = st.pending_choice
    if (p) {
      const key = `${p.event_id}@${p.presented_eff_min}`
      if (key !== a.seenChoice) {
        a.seenChoice = key
        a.choiceWaits += 1
        if (p.kind === 'fate') {
          a.fateOffers += 1
          a.fateByEvent[p.event_id] = (a.fateByEvent[p.event_id] ?? 0) + 1
        }
      }
    }

    // 출정 길이: 출정 시작 ~ 마을 도착(arriveTown이 town_idle로 옮긴다). 출정 객체는 마을 정비까지 남는다
    const ca = st.current_activity
    const s = ca.sortie
    if (s && ca.state === 'town_idle' && !a.seenSorties.has(s.id)) {
      a.seenSorties.add(s.id)
      const min = ch.eff_min - s.started_eff_min
      a.sortieMin.push(min)
      a.actMin[s.activity] = (a.actMin[s.activity] ?? 0) + min
      if (a.firstReturnMin === null) a.firstReturnMin = ch.eff_min
    }

    // 첫 판정 기록(01 §17 첫 10분). 뒤에서부터 새 기록만 본다
    if (a.firstCheckMin === null && ch.eff_min <= 10) {
      for (let i = st.journal.length - 1; i >= 0; i--) {
        const e = st.journal[i]!
        if (e.id <= a.lastJournalId) break
        if (e.char_uid === ch.uid && e.check) a.firstCheckMin = e.eff_min
      }
      a.lastJournalId = Math.max(a.lastJournalId, st.journal.at(-1)?.id ?? a.lastJournalId)
    }
  }

  // rec이 없으면 시간 상한에서 끊긴 생애다
  private finish(a: Acc, rec: LifeRecord | null): LifeRow {
    const time = this.world.content.balance.time
    const totalAct = Object.values(a.actMin).reduce((x, y) => x + y, 0)
    const share = (kind: string): number | null => (totalAct > 0 ? (100 * (a.actMin[kind] ?? 0)) / totalAct : null)
    const firstGen = a.gen === 1
    const within = (min: number | null, limit: number): number | null =>
      firstGen ? (min !== null && min <= limit ? 1 : 0) : null
    const endKind = rec?.end_kind ?? 'running'
    const deep = this.deepest()
    return {
      attitude: this.opts.attitude,
      seed: this.opts.seed,
      gen: a.gen,
      end_kind: endKind,
      end_age: rec?.end_age ?? ageAt(a.lastEffMin, time),
      // 생애가 끝나면 인물이 사라져 마지막 관측이 한 행동만큼 뒤진다. 연대기의 태도별 시간 합이 정확한 끝 시각이다
      minutes: round(rec ? Object.values(rec.attitudes_used).reduce((x, y) => x + y, 0) : a.lastEffMin, 2),
      peak_level: rec?.peak_level ?? a.lastLevel,
      combat_rounds: roundOpt(median(a.rounds), 3),
      combat_hp_loss: roundOpt(median(a.hpLoss), 3),
      sortie_minutes: roundOpt(median(a.sortieMin), 3),
      level10_age: a.level10,
      level20_age: a.level20,
      retire_level: endKind === 'retired' ? (rec?.peak_level ?? a.lastLevel) : null,
      share_hunt: roundOpt(share('hunt'), 3),
      share_adventure: roundOpt(share('adventure'), 3),
      share_dungeon: roundOpt(share('dungeon'), 3),
      normal_defeats: a.defeats,
      fate_offers: a.fateOffers,
      expense_ratio: a.income > 0 ? round((100 * a.spend) / a.income, 3) : null,
      first5_level2: within(a.level2Min, 5),
      first5_equip: within(a.firstEquipMin, 5),
      first10_check: within(a.firstCheckMin, 10),
      first10_return: within(a.firstReturnMin, 10),
      first10_rest: within(a.firstRestMin, 10),
      income: a.income,
      spend: a.spend,
      coins_end: a.lastCoins,
      death_cause: rec?.cause?.lethal_source ?? null,
      sorties: rec?.summary.sorties ?? a.lastSorties,
      discoveries: rec?.summary.discoveries ?? a.lastDiscoveries,
      event_repeat_max: a.eventRepeatMax,
      bankruptcies: a.bankruptcies,
      choice_waits: a.choiceWaits,
      level30: a.level30 ? 1 : 0,
      guild_rank: rec?.guild_rank ?? a.lastRank,
      deep_dungeon_age: deep.dungeon === null ? null : (a.firstVisitAge[deep.dungeon] ?? null),
      deep_route_age: deep.route === null ? null : (a.firstVisitAge[deep.route] ?? null),
      vampire: a.vampire ? 1 : 0,
      thirst_end: a.lastThirst,
      thirst_max: a.thirstMax,
      thirst_high_ratio: a.lastEffMin > 0 ? round((100 * a.thirstHighMin) / a.lastEffMin, 3) : 0,
      fate_by_event: a.fateByEvent,
      consumables: a.consumables,
    }
  }

  // 가장 깊은 던전 층·가장 먼 모험 경로(17 §8 R9·R11의 D3·A4를 ID 없이 고른다)
  private deepest(): { dungeon: string | null; route: string | null } {
    const pick = (kind: string): string | null => {
      let best: { id: string; level: number } | null = null
      for (const r of this.world.content.list('region')) {
        if (r.kind !== kind) continue
        const level = 'level_mid' in r ? r.level_mid : 0
        if (!best || level > best.level) best = { id: r.id, level }
      }
      return best?.id ?? null
    }
    return { dungeon: pick('dungeon_floor'), route: pick('adventure_route') }
  }
}

function round(v: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(v * f) / f
}

function roundOpt(v: number | null, digits: number): number | null {
  return v === null ? null : round(v, digits)
}

// 한 가문을 lives 생애만큼 돌린다. 생애마다 유효 진행 분 상한(minutes)을 따로 준다
export function runFamily(content: Content, opts: LifeOptions): LifeRow[] {
  const pool = content.list('name_pool')[0]
  const background = content.list('background').find((b) => b.unlock === null)
  if (!background) throw new Error('해금 조건이 없는 출신 배경이 없다')
  const world = createGameWorld(content, {
    familyName: pool?.family_names[0] ?? '가문',
    familySeed: seedHex(opts.seed),
    foundedUtc: FOUNDED_UTC,
    // 출발 계절은 주지 않는다(01 §1.1 무작위)
    character: { name: pool?.given_names[0] ?? '인물', background: background.id, appearance: APPEARANCE },
  })
  world.state.policies.attitude = opts.attitude
  world.state.policies.auto_succession = opts.lives > 1

  const watcher = new Watcher(world, opts)
  // 걸음 상한: 한 걸음에 적어도 1분은 흐르거나 선택 대기가 하나 풀린다
  const maxSteps = opts.lives * (opts.minutes + 200)
  for (let i = 0; i < maxSteps && watcher.rows.length < opts.lives; i++) {
    if (world.state.pending_choice) {
      submitPendingAuto(world)
      watcher.sync()
      continue
    }
    const ch = world.state.character
    if (!ch) break // 계승 대기(자동 계승이 꺼진 마지막 생애)
    if (ch.eff_min >= opts.minutes) break
    if (world.advance(Math.min(STEP_SEC, (opts.minutes - ch.eff_min) * 60)) === 0 && !world.clockRunning) break
  }
  watcher.closeRunning()
  return watcher.rows.slice(0, opts.lives)
}
