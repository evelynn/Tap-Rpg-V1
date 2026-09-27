// 상세 창(03 §5) 뷰 모델: 세계에서 탭별로 보일 값을 만든다. DOM이 없어 헤드리스 테스트로 검사한다.
// 첫 조각: 일지·인물·방침·가문 연대기. 서가·책 보기(M3)·가계도·도감·목적지 고르기는 다음 조각이다.
import {
  SKILL_LABELS, SPEC_LABELS, STAT_LABELS, activityOf, ageAt, effectiveStat, isUnlocked, itemName, lifeStageOf, maxHp,
  placeRiskCap, rankAllowed, renderTemplate, riskDiff, riskGrade, riskRank, xpToNext,
  type JournalEntry, type World,
} from '@tap/core'

export const TAG_LABEL: Record<string, string> = {
  hunt: '사냥', adventure: '모험', dungeon: '던전', travel: '이동', rest: '휴식', town: '마을', gear: '장비',
  check: '판정', trait: '특성', growth: '성장', discovery: '발견', bond: '인연', injury: '부상',
  important: '중요', family: '가족', retire: '은퇴', death: '사망', succession: '계승', house: '가문',
}
export const SEASON_LABEL: Record<string, string> = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' }
// 09 §1 생애 단계 이름
export const STAGE_LABEL: Record<string, string> = { novice: '새내기', prime: '전성기', veteran: '숙련기', elder: '노년기' }
const END_LABEL: Record<string, string> = { died: '사망', retired: '은퇴', long_sleep: '긴 잠' }
// 03 §5.3 등급 글자와 색(색만으로 구분하지 않는다, 03 §14)
export const GRADE: Record<string, { label: string; color: string }> = {
  common: { label: '일반', color: '#8A8A8A' }, good: { label: '좋은', color: '#4E9A5B' },
  rare: { label: '희귀', color: '#3D7CC9' }, legendary: { label: '전설', color: '#C99A2E' },
}
const SLOT_LABEL: Record<string, string> = { weapon: '무기', armor: '방어구', accessory: '장신구', relic: '유물' }
const SLOT_ORDER = ['weapon', 'armor', 'accessory', 'relic'] as const

// ── 일지 탭(03 §5.2) ──

export const FILTERS = ['전체', '중요', '전투', '탐험', '생활', '성장', '가족'] as const
export type Filter = (typeof FILTERS)[number]

// 전투 판정(05 §7): 명중·사건 명중·매복 대응·도주·부상·최후 판정. 그 밖의 판정은 탐색 판정으로 본다
export const COMBAT_CHECKS = new Set(['attack', 'attack_event', 'ambush', 'flee', 'injury', 'final'])
// 판정 종류가 없는 옛 기록은 최후 판정(sub)만 전투로 본다
const combatCheck = (e: JournalEntry): boolean => (e.check?.kind ? COMBAT_CHECKS.has(e.check.kind) : e.sub === 'final_check')

// 필터 칩 → 태그(03 §5.2 표). [판정]은 전투 판정과 탐색 판정으로 가른다
export function inFilter(e: JournalEntry, f: Filter): boolean {
  switch (f) {
    case '전체': return true
    case '중요': return ['important', 'death', 'retire', 'succession', 'discovery'].includes(e.tag)
    case '전투': return ['hunt', 'dungeon', 'injury'].includes(e.tag) || (e.tag === 'check' && combatCheck(e))
    case '탐험': return ['adventure', 'travel', 'discovery'].includes(e.tag) || (e.tag === 'check' && !combatCheck(e))
    case '생활': return ['rest', 'town', 'gear', 'bond'].includes(e.tag)
    case '성장': return ['growth', 'trait'].includes(e.tag)
    case '가족': return ['family', 'house', 'succession', 'retire'].includes(e.tag)
  }
}

export interface EntryRow {
  id: number
  tag: string // 표시 글자 [사냥]
  line: string
  bundle: number | null // (묶음 ×N)
  // 펼침(▸): 상세 문장, 자동 선택 이유, 판정 식(01 §3.1 형식)
  more: string[]
}
export interface JournalGroup { head: string; rows: EntryRow[] }

const RESULT_LABEL: Record<string, string> = {
  crit_success: '대성공', success: '성공', partial: '부분 성공', failure: '실패', crit_failure: '대실패',
}

export function checkFormula(c: NonNullable<JournalEntry['check']>): string {
  const parts = c.parts.map((p) => `${p.value < 0 ? '−' : '+'} ${p.label} ${Math.abs(p.value)}`).join(' ')
  return `주사위 ${c.dice}${parts ? ` ${parts}` : ''} = ${c.total} / 난이도 ${c.dc} · ${RESULT_LABEL[c.result] ?? c.result}`
}

// 최신이 위, `{나이}세 {계절}` 머리줄로 묶는다(D05: 절대 연도 없음). 현재 인물의 기록만 보인다
export function journalModel(world: World, filter: Filter): JournalGroup[] {
  const ch = world.state.character
  const entries = world.state.journal.filter((e) => (!ch || e.char_uid === ch.uid) && inFilter(e, filter)).sort((a, b) => b.id - a.id)
  const groups: JournalGroup[] = []
  for (const e of entries) {
    const head = `${e.age}세 ${SEASON_LABEL[e.season] ?? e.season}`
    if (groups.at(-1)?.head !== head) groups.push({ head, rows: [] })
    const more = [e.detail, e.reason ? `이유: ${e.reason}` : undefined, e.check ? checkFormula(e.check) : undefined]
      .filter((s): s is string => !!s && s !== e.line)
    groups.at(-1)!.rows.push({ id: e.id, tag: `[${TAG_LABEL[e.tag] ?? e.tag}]`, line: e.line, bundle: e.bundle_count && e.bundle_count > 1 ? e.bundle_count : null, more })
  }
  return groups
}

// ── 인물 탭(03 §5.3) ──

export interface ItemRow {
  uid: string
  slot: string
  name: string
  grade: { label: string; color: string }
  cursed: boolean
  locked: boolean
  relic: 1 | 2 | null // ★ 순위
  equipped: boolean
  order: 'equip' | 'unequip' | null // 출정 중 예약(03 §5.3.1)
}

export interface CharacterModel {
  title: string // 리아 · 31세 · 전성기
  level: { lv: number; xp: number; next: number | null }
  line2: string // 길잡이 · 은패 · 도전적
  line3: string // 체력 78/100 · 피로 34 · 동전 1,248
  stats: { label: string; value: number; base: number }[]
  skills: { label: string; rank: number; max: number; uses: number; next: number | null }[]
  traits: { name: string; badge: string; negative: boolean }[]
  injuries: string[]
  equipment: (ItemRow | { slot: string; empty: true })[]
  bag: { used: number; max: number; items: ItemRow[]; consumables: string }
  inTown: boolean // 장착·해제는 마을이면 즉시, 출정 중이면 예약(03 §5.3.1). 유품 변경은 마을에서만(12 §5.1)
}

const num = (n: number): string => n.toLocaleString('ko-KR')

function itemRow(world: World, uid: string, equipped: boolean): ItemRow {
  const inst = world.state.item_instances[uid]!
  const def = world.content.get('item', inst.def_id)
  const relic = world.state.inventory.relic_designations.find((r) => r.uid === uid)?.priority ?? null
  return {
    uid, slot: SLOT_LABEL[def.slot] ?? def.slot, name: itemName(world, inst), grade: GRADE[inst.grade] ?? GRADE.common!,
    cursed: def.cursed, locked: inst.locked, relic: relic as 1 | 2 | null, equipped,
    order: world.state.inventory.equip_orders?.find((o) => o.uid === uid)?.op ?? null,
  }
}

export function characterModel(world: World): CharacterModel | null {
  const ch = world.state.character
  if (!ch) return null
  const { content } = world
  const b = content.balance
  const age = ageAt(ch.eff_min, b.time)
  const spec = ch.specialization === 'none' ? '초보' : SPEC_LABELS[ch.specialization]
  const thresholds = b.skills.rank_thresholds
  const traitBadge = (id: string, source: string): { badge: string; negative: boolean } => {
    const t = content.get('trait', id)
    const badge = t.kind === 'mutation' ? '변이' : source === 'acquired' || t.kind === 'acquired' ? '후천' : t.inheritable ? '선천·유전' : '선천'
    return { badge, negative: 'inherit_class' in t && t.inherit_class === 'negative' }
  }
  const inv = world.state.inventory
  const equipment = SLOT_ORDER.map((slot) => {
    const uid = inv.equipped[slot]
    return uid ? itemRow(world, uid, true) : { slot: SLOT_LABEL[slot]!, empty: true as const }
  })
  const consumables = Object.entries(inv.consumables).filter(([, n]) => n > 0)
    .map(([id, n]) => `${content.has('consumable', id) ? content.get('consumable', id).name : id} ×${n}`).join(' · ')
  return {
    title: `${ch.name} · ${age}세 · ${STAGE_LABEL[lifeStageOf(world)] ?? lifeStageOf(world)}`,
    level: { lv: ch.level, xp: ch.xp, next: xpToNext(content, ch.level) },
    line2: `${spec} · ${content.get('guild_rank', ch.guild_rank).name} · ${content.get('attitude', world.state.policies.attitude).name}`,
    line3: `체력 ${Math.max(0, ch.hp)}/${maxHp(world)} · 피로 ${Math.round(ch.fatigue)} · 동전 ${num(ch.coins)}`,
    stats: (Object.keys(STAT_LABELS) as (keyof typeof STAT_LABELS)[]).map((s) => ({ label: STAT_LABELS[s], value: effectiveStat(world, s), base: ch.stats[s] })),
    skills: (Object.keys(SKILL_LABELS) as (keyof typeof SKILL_LABELS)[]).map((s) => ({
      label: SKILL_LABELS[s], rank: ch.skills[s].rank, max: b.skills.max_rank, uses: ch.skills[s].uses, next: thresholds[ch.skills[s].rank] ?? null,
    })),
    traits: ch.traits.map((t) => ({ name: content.get('trait', t.id).name, ...traitBadge(t.id, t.source) })),
    injuries: ch.injuries.map((i) => `${i.grade === 'serious' ? '중상' : '경상'} (${STAT_LABELS[i.stat]} −1) · ${Math.ceil(i.remaining_min)}분 뒤 회복`),
    equipment,
    bag: { used: inv.bag.length, max: b.stats.bag_slots, items: inv.bag.map((u) => itemRow(world, u, false)), consumables },
    inTown: ['town_idle', 'town_prep'].includes(world.state.current_activity.state),
  }
}

// 교체 제안(03 §5.3.1, 08 §8.2): 자동 교체가 꺼져 있을 때만 보인다. 이유는 08 §7.5 '가장 큰 요인'
const REASON_LABEL: Record<string, string> = {
  weapon_damage: '무기 피해', weapon_hit: '무기 명중', family: '계열 대상', armor_ac: '방어', armor_hp: '체력',
  search: '탐색 효과', travel: '이동 효과', fear: '공포 효과', start: '시작 장비 교체', escape: '탈출 효과',
}

export interface SuggestionRow { slot: string; slotId: string; line: string; pending: string | null }

export function suggestionsModel(world: World): SuggestionRow[] | null {
  const inv = world.state.inventory
  if (world.state.policies.auto_equip || !inv.equip_suggestions.length) return null
  return SLOT_ORDER.flatMap((slot) => {
    const sg = inv.equip_suggestions.find((x) => x.slot === slot)
    if (!sg) return []
    const src = sg.source
    const [name, where] = 'uid' in src
      ? [itemName(world, world.state.item_instances[src.uid]!), '가방']
      : [world.content.get('item', src.shop_def_id).name, `상점 ${num(src.price)}`]
    const ordered = 'uid' in src && inv.equip_orders?.some((o) => o.uid === src.uid && o.op === 'equip')
    return [{
      slot: SLOT_LABEL[slot]!, slotId: slot,
      line: `${SLOT_LABEL[slot]} · ${name}(${where}) · +${(sg.improvement * 100).toFixed(1)}% · ${REASON_LABEL[sg.reason] ?? sg.reason}`,
      pending: ordered ? '다음 마을 도착 때 장착' : sg.accepted ? '다음 정비 때 삽니다' : null,
    }]
  })
}

// ── 방침 탭(03 §5.4) ──

// 태도를 바꾸면 한 줄 기록 자리에 4초 보이는 안내(03 §2.6)
export const attitudeNote = (name: string): string => renderTemplate('ⓘ 다음 행동부터 {a:으로/로} 움직입니다', { a: name })

export interface PolicyModel {
  attitudes: { id: string; name: string; on: boolean }[]
  attitudeLine: string // 사냥 30 · 모험 45 · 던전 25 / 체력 40%에 퇴각
}

export function policyModel(world: World): PolicyModel {
  const cur = world.state.policies.attitude
  const list = [...world.content.list('attitude')].sort((a, b) => a.order - b.order)
  const a = world.content.get('attitude', cur)
  const w = a.activity_weights
  return {
    attitudes: list.map((x) => ({ id: x.id, name: x.name, on: x.id === cur })),
    attitudeLine: `사냥 ${w.hunt} · 모험 ${w.adventure} · 던전 ${w.dungeon} / 체력 ${Math.round(a.retreat_hp * 100)}%에 퇴각`,
  }
}

// 목적지 드롭다운(03 §5.4): 자동 + 해금 장소, 장소마다 지금 위험 등급(낮 기준, 01 §7.2).
// 상한을 넘거나 무모한 곳은 고를 때 한 번 확인한다
export const RISK_LABEL: Record<string, string> = { very_low: '매우 낮음', low: '낮음', normal: '보통', high: '높음', reckless: '무모' }

export interface PlaceOption { id: string; name: string; grade: string; cap: string; ask: boolean; reckless: boolean }

export function destinationModel(world: World): { current: string; places: PlaceOption[] } {
  const places: PlaceOption[] = []
  for (const r of world.content.list('region')) {
    if (r.kind === 'town' || !isUnlocked(world, r) || !rankAllowed(world, r)) continue
    const grade = riskGrade(world.content, riskDiff(world, r.id, false))
    const reckless = grade === 'reckless'
    const cap = placeRiskCap(world, activityOf(r.kind)) // 모험적의 모험 예외를 반영한 상한(04 §10.1)
    places.push({ id: r.id, name: r.name, grade: RISK_LABEL[grade] ?? grade, cap: RISK_LABEL[cap] ?? cap, reckless, ask: reckless || riskRank(grade) > riskRank(cap) })
  }
  return { current: world.state.policies.destination, places }
}

// ── 가문 탭 연대기(03 §5.5) ──

export interface ChronicleRow {
  head: string // 1대 모라  18~68세 · 은퇴 · 수호자 Lv26
  lines: string[] // 펼침: 주요 기록(나이순), 남긴 유품
}

// ── 가문 탭 가계도(03 §5.5): 플레이 인물을 대수 순으로. 뽑히지 않은 후계 후보는 저장되지 않아 아직 그리지 않는다 ──

const ROLE_LABEL: Record<string, string> = { founder: '가문을 세움', direct: '직계', collateral: '방계', adopted: '입양' }

export interface TreeNode { gen: number; name: string; role: string; dashed: boolean; current: boolean; row: number }

// row: 연대기 목록에서 이 인물 줄의 순번(누르면 그 줄로 간다)
export function treeModel(world: World): TreeNode[] {
  const { family: fam, character: ch } = world.state
  const past = [...fam.chronicle].sort((a, b) => a.gen - b.gen)
  const nodes: TreeNode[] = past.map((r) => ({
    gen: r.gen, name: r.name, role: ROLE_LABEL[r.family_role] ?? r.family_role,
    dashed: r.family_role === 'collateral' || r.family_role === 'adopted', current: false, row: (ch ? 1 : 0) + (past.length - 1 - past.indexOf(r)),
  }))
  if (ch) {
    const role = ch.family_role
    nodes.push({ gen: ch.generation, name: ch.name, role: ROLE_LABEL[role] ?? role, dashed: role === 'collateral' || role === 'adopted', current: true, row: 0 })
  }
  return nodes
}

// ── 가문 탭 유품(03 §5.5): 지금 등록한 유품 2칸 + 대를 건너온 유품과 사연 ──

const HOW: Record<string, string> = { shop: '샀다', aid: '받았다', start: '받았다' }

export interface RelicModel { slots: (string | null)[]; past: { name: string; grade: { label: string; color: string }; lines: string[] }[] }

export function relicsModel(world: World): RelicModel {
  const { state, content } = world
  const nameOf = (charUid: string): string =>
    state.family.chronicle.find((r) => r.char_uid === charUid)?.name ?? (state.character?.uid === charUid ? state.character.name : '누군가')
  const slots = ([1, 2] as const).map((p) => {
    const d = state.inventory.relic_designations.find((r) => r.priority === p)
    const inst = d && state.item_instances[d.uid]
    return inst ? itemName(world, inst) : null
  })
  const passed = new Set(state.family.chronicle.flatMap((r) => r.relics_passed))
  for (const [uid, inst] of Object.entries(state.item_instances)) if (inst.inherited_from_gen !== undefined) passed.add(uid)
  const past = [...passed].map((u) => state.item_instances[u]).filter((i) => i !== undefined).sort((a, b) => a.acquired.gen - b.acquired.gen || a.uid.localeCompare(b.uid)).map((inst) => {
    const a = inst.acquired
    const def = content.get('item', inst.def_id)
    const place = content.has('region', a.location) ? content.get('region', a.location).name : a.location
    const who = { generation: a.gen, name: nameOf(a.char_uid) }
    // 사연은 장비의 story_template(16 §2.5). {npc}처럼 채울 값이 없는 틀이면 획득 기록으로 대신한다
    let story: string
    try {
      story = renderTemplate(def.story_template, who)
    } catch {
      story = renderTemplate(`{gen}대 {name:이/가} {age}세에 {place}에서 ${HOW[a.source] ?? '발견했다'}`, { gen: a.gen, name: who.name, age: a.age, place })
    }
    return {
      name: itemName(world, inst), grade: GRADE[inst.grade] ?? GRADE.common!,
      lines: [story, ...inst.history.map((h) => `${h.gen}대 ${h.age}세 · ${h.text}`)],
    }
  })
  return { slots, past }
}

export function familyModel(world: World): { title: string; rows: ChronicleRow[] } {
  const { state, content } = world
  const fam = state.family
  const ch = state.character
  const byId = new Map(state.journal.map((e) => [e.id, e]))
  const rows: ChronicleRow[] = []
  if (ch) {
    const age = ageAt(ch.eff_min, content.balance.time)
    rows.push({ head: `${ch.generation}대 ${ch.name}  ${content.balance.time.start_age}세~ · 현재 · ${ch.specialization === 'none' ? '초보' : SPEC_LABELS[ch.specialization]} Lv${ch.level} (${age}세)`, lines: [] })
  }
  for (const r of [...fam.chronicle].sort((a, b) => b.gen - a.gen)) {
    const spec = r.specialization === 'none' ? '초보' : SPEC_LABELS[r.specialization]
    const majors = r.major_entry_ids.map((id) => byId.get(id)).filter((e): e is JournalEntry => !!e).sort((a, b) => a.id - b.id)
    const relics = r.relics_passed.map((u) => state.item_instances[u]).filter((i) => i !== undefined).map((i) => itemName(world, i))
    rows.push({
      head: `${r.gen}대 ${r.name}  ${content.balance.time.start_age}~${r.end_age}세 · ${END_LABEL[r.end_kind] ?? r.end_kind} · ${spec} Lv${r.peak_level}`,
      lines: [...majors.map((e) => `${e.age}세 ${e.line}`), ...(relics.length ? [`유품: ${relics.join(', ')}`] : [])],
    })
  }
  return { title: `${fam.name} 가문 · ${fam.generation}대째`, rows }
}
