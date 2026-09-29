// 계승 5단계(12 §1.1). 1~2단계는 endLife가, 3~5단계는 startHeir가 맡는다.
// 사이에 인물 상태는 `계승 대기`이고 유효 진행과 나이가 멈춘다.
import { closeLifeChains } from '../events/chains'
import type { EventPorts } from '../events/ports'
import { emptyScope, type EventWorld } from '../events/scope'
import { addJournal, purgeDaily } from '../journal/index'
import { equipItem, itemName } from '../items/bag'
import { characterOf, type RuleContext } from '../rules/context'
import { maxHp } from '../rules/derived'
import { skillRank } from '../rules/growth'
import { SEASONS, SKILLS, SLOTS, STATS, registerTextSlot, type END_KINDS } from '../schema/index'
import { emptyBlessing, type Appearance, type Character } from '../state/character'
import type { Candidate, LifeRecord } from '../state/family'
import type { JournalDraft } from '../state/journal'
import { issueUid } from '../state/uid'
import { ageAt, seasonAt } from '../time/index'
import { createItemInstance } from '../sim/create'
import { fireSuccession } from '../life/events'
import { DEPART_DETAIL, DEPART_LINE, NEW_NAME_DETAIL, textLine } from '../life/text'
import { writeNote } from '../jobs/index'
import { isUnlocked, rankAllowed } from '../ai/candidates'
import { applyStartBlessing, refundArmedAtLifeEnd, repeatStartChoice, startBlock, successionGain, type BlessingSubject, type StartChoice } from '../blessing/index'
import {
  candidateStats, createFallbackCandidates, defaultBackground, defaultHeir, heirCandidates, parentBestStats, parentCall,
} from './candidates'
import { bindBook, bookJournal, bookOf, setBookReceivedBy } from '../book/index'
import { buildLifeRecord, checkAchievements, closeJournal, pickEpithet } from './record'
import { ownedItems, relicsToPass, transferRelics } from './relics'
import { settle, storeKeepsakes, type Settlement } from './settlement'

type EndKind = (typeof END_KINDS)[number]
export type LifeWorld = EventWorld & RuleContext

export interface LifeEndInput {
  kind: EndKind
  place: string
  cause?: LifeRecord['cause'] // 사망 원인 기록(09 §5.4)
  roleId?: string | null // 은퇴 역할(09 §4.1)
  longSleep?: LifeRecord['long_sleep']
}

export interface SuccessionPlan {
  record: LifeRecord
  candidates: Candidate[]
  defaultHeirUid: string | null
  relicUids: string[]
  settlement: Settlement
  journal: JournalDraft[]
  timeJump: boolean
  firstPage: string
}

// 12 §1.3 상세 기록 {first_page}: 이전 인물 연대기에서 가장 먼저 기록된 발견·유품·인연의 이름(명사).
// 기록 문장이 아니라 기록이 가리키는 것(장비·NPC·발견 지점)의 이름을 쓴다. 하나도 없으면 대체 문형(인물 이름)
const FIRST_PAGE_TAGS: readonly string[] = ['discovery', 'gear', 'bond']
export const FIRST_PAGE_FALLBACK = 'journal.succession.first_page_fallback'
registerTextSlot(FIRST_PAGE_FALLBACK, '생애·계승(T10)')

function firstPageOf(ctx: RuleContext, charUid: string): string {
  const { content, state } = ctx
  const ch = characterOf(ctx)
  const discoveryName = (route: string | undefined): string | null => {
    const r = route && content.has('region', route) ? content.get('region', route) : null
    if (!r || r.kind !== 'adventure_route') return null
    return r.discoveries.find((d) => ch.discoveries.includes(d.id))?.name ?? null
  }
  for (const e of state.journal) {
    if (e.char_uid !== charUid || !FIRST_PAGE_TAGS.includes(e.tag)) continue
    const inst = e.refs?.item_uid ? state.item_instances[e.refs.item_uid] : undefined
    const name = inst ? itemName(ctx, inst)
      : e.refs?.npc_id && content.has('npc', e.refs.npc_id) ? content.get('npc', e.refs.npc_id).name
      : e.tag === 'discovery' ? discoveryName(e.refs?.location_id)
      : null
    if (name) return name
  }
  return textLine(content, FIRST_PAGE_FALLBACK, { name: ch.name }, '{name}의 이름')
}

// 12 §4.3 시간 도약: 직계 후계자가 생긴 뒤 time_jump_min이 지나기 전에 생애가 끝난 경우
function timeJumpNeeded(ctx: RuleContext, heir: Candidate | null): boolean {
  if (!heir || heir.relation !== 'direct') return false
  const time = ctx.content.balance.time
  const bornMin = (heir.created_at_parent_age - time.start_age) * time.min_per_year
  return characterOf(ctx).eff_min - bornMin < ctx.content.balance.inheritance.time_jump_min
}

// ── 1~2단계 ──

// 생애 종료와 기록 정리. 사건(S03·S04·S08)은 부르는 쪽이 먼저 발화한다(기록이 그 인물에 붙어야 한다)
export function endLife(w: LifeWorld, input: LifeEndInput): SuccessionPlan {
  const ctx: RuleContext = w
  const ch = characterOf(ctx)
  const journal: JournalDraft[] = []

  // 1단계: 미완 연속 사건 → 후보층 → 넘길 유품 → 정산. 걸어 둔 가호의 별빛은 가문에 돌려준다(04 §10.3 2번)
  refundArmedAtLifeEnd(ctx)
  writeNote(ctx) // 가문 수첩 요령(12 §7.7)
  const unfinished = closeLifeChains(w)
  if (!heirCandidates(w.state.family, ch).length) createFallbackCandidates(ctx, w.rng.life)
  const relics = relicsToPass(ctx, input.kind)
  const relicUids = relics.map((i) => i.uid)
  const settlement = settle(ctx, input.kind, relicUids)

  // 2단계(12 §1.1, 18 §2.1): 별칭·업적 → 마지막 장 지정 → 책 → 책 기록 → 일상 기록 정리.
  // 업적·미완 기록을 먼저 남겨야 마지막 장과 연대기 주요 기록에 들어간다
  const scope = { ...emptyScope(input.place), lifeEnd: { kind: input.kind, place: input.place } }
  const epithet = pickEpithet(w, scope)
  for (const g of checkAchievements(w, scope)) journal.push(g.journal)
  for (const line of unfinished) journal.push({ tag: 'house', importance: 'family', line: '끝나지 않은 이야기', detail: line })
  for (const d of journal) addJournal(w, d)
  closeJournal(ctx)
  const received = ownedItems(ctx).filter((i) => i.inherited_from_gen !== undefined).map((i) => i.uid)
  const record = buildLifeRecord(ctx, {
    endKind: input.kind,
    epithet,
    retireRole: input.roleId ?? null,
    cause: input.cause ?? null,
    unfinished,
    relicsPassed: relicUids,
    longSleep: input.longSleep ?? null,
    receivedRelicUids: received,
  })
  // 18 §2.1 3~4번: 책을 엮어 봉인하고(예외면 최소 책, 계승은 멈추지 않는다) 책 기록 BK33·BK34를 쓴다
  record.book = bindBook(ctx, record, settlement.keepsakes)
  const sealed = bookOf(record)
  const bookNote = sealed ? bookJournal(ctx, sealed) : null
  if (bookNote) addJournal(w, bookNote)
  w.state.family.chronicle.push(record)

  const candidates = heirCandidates(w.state.family, ch)
  const heir = defaultHeir(w.state.family, ch)
  const plan: SuccessionPlan = {
    record,
    candidates,
    defaultHeirUid: heir?.uid ?? null,
    relicUids,
    settlement,
    journal,
    timeJump: timeJumpNeeded(ctx, heir),
    firstPage: firstPageOf(ctx, ch.uid),
  }
  purgeDaily(w.state, ch.uid)
  w.state.current_activity.state = 'awaiting_succession'
  w.state.current_activity.resolved_action = null
  w.state.current_activity.sortie = null
  return plan
}

// ── 3~5단계 ──

export interface HeirChoice {
  uid?: string // 후계자(없으면 기본 후보)
  name?: string
  background?: string
  appearance?: Appearance
  attitude?: string
  blessing?: StartChoice | null // 시작 축복(01 §19). null = 내리지 않는다, 없으면 방침 `시작 축복 자동`
}

// 후계자의 출생 능력치(12 §3.4): 4단계에서 고른 출신 배경과 지금 부모의 최고 능력치로 확정한다.
// startHeir와 계승 화면 미리보기(시작 축복 5단계)가 같은 값을 써야 한다(독립 검증 D78-1)
export function heirStats(w: LifeWorld, cand: Candidate, background: string = defaultBackground(w.content)): Character['birth_stats'] {
  return candidateStats(w.content, w.state.family.family_seed, cand, background, parentBestStats(characterOf(w)))
}

// 시작 축복을 받을 후계자(출발 직후 모습). 출신 배경 숙련은 첫 단계로 시작한다
export function heirSubject(w: LifeWorld, cand: Candidate, background: string = defaultBackground(w.content)): BlessingSubject {
  const bgSkill = w.content.get('background', background).start_skill
  const first = skillRank(w.content, w.content.balance.skills.rank_thresholds[0] ?? 0)
  return {
    generation: w.state.family.generation + 1, traits: cand.traits.map((t) => t.id), birthStats: heirStats(w, cand, background), background,
    ranks: Object.fromEntries(SKILLS.map((k) => [k, k === bgSkill ? first : 0])) as BlessingSubject['ranks'],
  }
}

// 3~5단계: 후계자 확정 → 유전·유품·돈 이전 → 새 인물 출발. 5단계 사건(S05)은 ports를 주면 함께 발화한다
export function startHeir(w: LifeWorld, plan: SuccessionPlan, choice: HeirChoice = {}, ports?: EventPorts): Character {
  const { content } = w
  const state = w.state
  const fam = state.family
  const parent = characterOf(w)
  const cand = plan.candidates.find((c) => c.uid === (choice.uid ?? plan.defaultHeirUid))
  if (!cand) throw new Error('후계자 후보가 없다')

  // 4단계: 출신 배경·이름·외형
  const background = choice.background ?? defaultBackground(content)
  const bg = content.get('background', background)
  if (bg.unlock !== null && !fam.unlocks.backgrounds.includes(bg.id)) throw new Error(`출신 배경 '${bg.id}'이 해금되지 않았다`)
  const stats = heirStats(w, cand, background)
  // 고른 시작 축복은 아무것도 바꾸기 전에 검사한다(중간에 멈춰 반쯤 계승된 저장을 남기지 않는다, 독립 검증 D78-1)
  if (choice.blessing) {
    const why = startBlock(w, choice.blessing, heirSubject(w, cand, background), null)
    if (why) throw new Error(`시작 축복을 줄 수 없다: ${why}`)
  }
  const call = parentCall(content, w.rng.life, cand.relation)

  // 기념품 전환과 남은 장비 정리(12 §6.1). 넘길 유품만 남긴다
  storeKeepsakes(w, plan.settlement.keepsakes)
  const keep = new Set(plan.relicUids)
  for (const inst of ownedItems(w)) if (!keep.has(inst.uid)) delete state.item_instances[inst.uid]
  const relics = plan.relicUids.map((u) => state.item_instances[u]).filter((i) => i !== undefined)

  // 출발 계절 = 부모 생애 종료 계절의 다음 계절(12 §1.1 5단계)
  const time = content.balance.time
  const endSeason = seasonAt(parent.eff_min, parent.birth_season, time)
  const order = time.season_order.length ? time.season_order : [...SEASONS]
  const next = order[(order.indexOf(endSeason) + 1) % order.length]!

  const skills = Object.fromEntries(SKILLS.map((s) => [s, { uses: 0, rank: 0 }])) as Character['skills']
  if (bg.start_skill) {
    const uses = content.balance.skills.rank_thresholds[0] ?? 0
    skills[bg.start_skill] = { uses, rank: skillRank(content, uses) }
  }
  if (choice.attitude) state.policies.attitude = choice.attitude

  fam.generation += 1
  const heir: Character = {
    uid: cand.uid,
    name: choice.name ?? cand.name,
    generation: fam.generation,
    family_role: cand.relation,
    parent_uid: parent.uid,
    parent_call: call,
    background: bg.id,
    appearance: choice.appearance ?? cand.appearance,
    birth_season: next,
    birth_stats: { ...stats },
    stats: { ...stats },
    stat_growth: [],
    life_stat_mods: [],
    stat_use_points: Object.fromEntries(STATS.map((s) => [s, 0])) as Character['stat_use_points'],
    level: 1,
    xp: 0,
    skills,
    traits: cand.traits.map((t) => ({ id: t.id, since_age: time.start_age, source: t.from })),
    injuries: [],
    hp: 0,
    fatigue: 0,
    eff_min: 0,
    retire_age: time.base_retire_age,
    lifespan_extended: false,
    specialization: 'none',
    job2: null,
    techniques: [],
    f01_presentations: 0,
    spec_deferred_until_level: null,
    mutation: null,
    guild_rank: [...content.list('guild_rank')].sort((a, b) => a.order - b.order)[0]!.id,
    coins: content.balance.economy.starting_kit.coins + plan.settlement.transferred,
    location: parent.location,
    counters: {},
    counters_at: {},
    flags: {},
    temp_mods: [],
    quest: null,
    event_counts: {},
    event_last_min: {},
    recent_life_events: [],
    event_pity: {},
    npc_relations: {},
    visited: [],
    defeated: [],
    children: [],
    heir_preferred: null,
    attitude_log: [{ eff_min: 0, attitude: state.policies.attitude }],
    recent_summaries: [],
    blessing: emptyBlessing(),
    last_trip_time: null,
    guild_aid: { active: false, started_eff_min: null, recovered: false },
    scheduled_events: [],
    shop_discounts: [],
    next_visit_mods: {},
    line_variant_last: {},
    discoveries: [],
    map_fragments: [],
    discovery_fail_bonus: {},
    chain_mission: {},
    deficit: {},
    decision_seq: 0,
    miss_streak: 0,
    activity_streak: null,
    low_cap_streak: 0,
  }

  // 뽑히지 않은 후보는 부모의 생애 기록에 남긴다(가계도 가는 테두리, D87)
  const parentRec = fam.chronicle.find((r) => r.char_uid === parent.uid)
  if (parentRec) parentRec.candidates_passed = plan.candidates.filter((c) => c.uid !== cand.uid).map((c) => ({ name: c.name, relation: c.relation, episodes: [...c.episodes] }))
  // 생애의 책 `받은 사람`(18 §7.2): 출발 때 1회. 자녀 후보의 이름이 봉인 때와 다르면 옛 이름을 함께 둔다
  const parentBook = parentRec ? bookOf(parentRec) : null
  if (parentBook) {
    const renamed = heir.name !== cand.name && parentBook.appendix.people.some((p) => p.startsWith(`${cand.name} · `))
    setBookReceivedBy(parentBook, { gen: heir.generation, char_uid: heir.uid, name: heir.name, old_name: renamed ? cand.name : null })
  }
  // 후보 목록을 비운다(12 §10: 계승 화면을 다시 열어도 후보가 다시 뽑히지 않는다)
  fam.candidates = {}
  state.character = heir
  state.inventory = {
    equipped: { weapon: null, armor: null, accessory: null, relic: null },
    bag: [],
    pending_box: [],
    consumables: { ...content.balance.economy.starting_kit.consumables },
    relic_designations: [],
    equip_suggestions: [],
    dismissed_suggestions: [],
  }
  state.pending_choice = null

  // 유품 이전 → 자동 장착 판단(저주 장비는 자동 장착하지 않는다, 12 §5.2)
  const moved = transferRelics(w, relics, parent.generation, parent.name, ageAt(parent.eff_min, time))
  for (const uid of moved.uids) {
    const inst = state.item_instances[uid]!
    const def = content.get('item', inst.def_id)
    if (!def.cursed && state.inventory.equipped[def.slot] === null) equipItem(w, uid)
  }
  // 시작 소지품(01 §9.7): 유품이 채운 슬롯의 장비는 받지 않는다(12 §6.1)
  for (const id of content.balance.economy.starting_kit.items) {
    const slot = content.get('item', id).slot
    if (state.inventory.equipped[slot] !== null) continue
    const inst = createItemInstance(content, state, id, undefined, {
      gen: fam.generation, char_uid: heir.uid, age: time.start_age, location: heir.location, source: 'start',
    })
    state.inventory.equipped[slot] = inst.uid
  }
  heir.hp = maxHp(w)
  state.current_activity.state = 'town_idle'

  // 5단계 출발 기록
  if (plan.timeJump) {
    const guardian = content.get('npc', content.balance.inheritance.fallback_guardian_npc).name
    addJournal(w, { tag: 'succession', importance: 'family', line: '열여덟 해가 지났다', detail: `${guardian}이 ${heir.name}을 길렀다.` })
  }
  for (const d of moved.journal) addJournal(w, d)
  addJournal(w, {
    tag: 'house',
    importance: 'family',
    line: `${fam.generation}대 ${heir.name}`,
    detail: textLine(content, NEW_NAME_DETAIL, { generation: fam.generation, name: heir.name }, '수첩에 새 이름이 적혔다. {generation}대 {name}.'),
  })
  if (ports) {
    fireSuccession(w, heir.location, ports, { heir: heir.name, parent_call: call, first_page: plan.firstPage })
  }
  // 04 X11(D87): 고정 목적지가 새 인물에게 잠겨 있으면 고정을 풀고 한 번 알린다
  const dest = state.policies.destination
  if (content.has('region', dest)) {
    const r = content.get('region', dest)
    if (!isUnlocked(w, r) || !rankAllowed(w, r)) {
      state.policies.destination = 'auto'
      addJournal(w, { tag: 'town', line: content.balance.activity_ai.lines.lost_destination })
    }
  }
  // 5단계: 별빛 +1과 시작 축복(12 §1.1, 01 §19). 고르지 않았으면 방침 `시작 축복 자동`(지난번과 같게면 앞 세대 종류)
  successionGain(w)
  const start = choice.blessing !== undefined ? choice.blessing
    : state.policies.start_blessing_auto === 'repeat' && parent.blessing.start ? repeatStartChoice(w, parent.blessing.start) : null
  if (start) applyStartBlessing(w, start)
  // 출발 풍경 한 줄(12 §1.3, D76). 기본 창은 이 기록이 보이는 동안 계승 출발 장면 ES21을 그린다
  addJournal(w, {
    tag: 'succession', sub: 'depart', importance: 'family', line: textLine(content, DEPART_LINE, { heir: heir.name }, '{heir:은/는} 마을 어귀를 나섰다.'),
    detail: textLine(content, DEPART_DETAIL, { heir: heir.name }, '{heir:은/는} 수첩을 배낭 깊숙이 넣고 첫 출정을 준비했다.'),
  })
  return heir
}
