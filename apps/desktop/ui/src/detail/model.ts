// 상세 창(03 §5) 뷰 모델: 세계에서 탭별로 보일 값을 만든다. DOM이 없어 헤드리스 테스트로 검사한다.
// 첫 조각: 일지·인물·방침·가문 연대기. 서가·책 보기(M3)·가계도·도감·목적지 고르기는 다음 조각이다.
import {
  SKILL_LABELS, SPEC_LABELS, STAT_LABELS, activityOf, ageAt, chronicleMajor, effectiveStat, isInTown, isUnlocked, itemName, lifeStageOf, maxHp,
  placeRiskCap, rankAllowed, regionLevel, renderTemplate, riskDiff, riskGrade, riskRank, skillUseText, statUseText, xpToNext,
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
  // 세부 내역(늘 보임, D77): 상세 문장(줄마다), 자동 선택 이유, 판정 식(01 §3.1 형식)
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
    const detail = e.detail && e.detail !== e.line ? e.detail.split('\n') : []
    const more = [...detail, e.reason ? `이유: ${e.reason}` : undefined, e.check ? checkFormula(e.check) : undefined]
      .filter((s): s is string => !!s && s !== e.line)
    groups.at(-1)!.rows.push({ id: e.id, tag: `[${TAG_LABEL[e.tag] ?? e.tag}]`, line: e.line, bundle: e.bundle_count && e.bundle_count > 1 ? e.bundle_count : null, more })
  }
  return groups
}

// 최근 요약(03 §5.2, 14 §1.1): 최근 3개를 최신부터
export interface SummaryRow { head: string; lines: string[] }

export function recentModel(world: World, n = 3): SummaryRow[] {
  const ch = world.state.character
  if (!ch) return []
  return ch.recent_summaries.slice(-n).reverse().map((r) => ({
    head: `${r.age}세 ${SEASON_LABEL[r.season] ?? r.season} · ${r.kind === 'sortie' ? '출정' : '마을'}`, lines: r.lines,
  }))
}

// 직업 이름(05 §8): `초보` 또는 `수호자` · `수호자 · 파수꾼`
export function jobLabel(world: World, spec: string, job2: string | null | undefined): string {
  if (spec === 'none') return '초보'
  const t1 = SPEC_LABELS[spec as keyof typeof SPEC_LABELS] ?? spec
  const t2 = job2 ? world.content.balance.second_jobs[job2]?.name : undefined
  return t2 ? `${t1} · ${t2}` : t1
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
  desc: string // 장비 설명(16 §2.5 description, 늘 보임 D77)
  lore: string[] // 장비 주석(16 §2.5 lore, D80): 펼치면 보인다
}

// 장비 주석 줄(16 §2.5 lore, D80). 비밀은 가문이 가진 적 있거나(owned) 유품으로 이어진 적 있을 때(inherited)만
export function loreLines(world: World, defId: string): string[] {
  const { state, content } = world
  const lore = content.get('item', defId).lore
  const s = lore.secret
  const open = !!s && (s.reveal === 'owned'
    ? !!state.family.codex.items[defId]
    : Object.values(state.item_instances).some((i) => i.def_id === defId && i.inherited_from_gen !== undefined) ||
      state.family.chronicle.some((r) => r.relics_passed.some((u) => state.item_instances[u]?.def_id === defId)))
  return [lore.tale, ...(lore.owner ? [`주인 · ${lore.owner}`] : []), ...(lore.found ? [`얻는 곳 · ${lore.found}`] : []), ...(open ? [`비밀 · ${s!.text}`] : [])]
}

export interface CharacterModel {
  title: string // 리아 · 31세 · 전성기
  level: { lv: number; xp: number; next: number | null }
  line2: string // 길잡이 · 은패 · 도전적
  line3: string // 체력 78/100 · 피로 34 · 동전 1,248
  stats: { label: string; value: number; base: number; use: string }[] // use: 쓰임(01 §2.1, D77)
  skills: { label: string; rank: number; max: number; uses: number; next: number | null; effect: string | null }[] // effect: 더하는 판정
  job: { name: string; lines: string[] } // 직업 이름과 효과 글(05 §8.2·§8.6, D79)
  techniques: { name: string; source: string; effect: string }[] // 익힌 기술(05 §10)
  traits: { name: string; badge: string; negative: boolean; since: number; effect: string; inactive: string | null }[] // 얻은 나이, 효과 글(16 §2.7), 흐린 표시 사유(06 §8.1)
  injuries: string[]
  equipment: (ItemRow | { slot: string; empty: true })[]
  bag: { used: number; max: number; items: ItemRow[]; consumables: string }
  inTown: boolean // 장착·해제는 마을이면 즉시, 출정 중이면 예약(03 §5.3.1). 유품 변경은 마을에서만(12 §5.1)
}

const num = (n: number): string => n.toLocaleString('ko-KR')
const TECH_SOURCE: Record<string, string> = { job: '전직', event: '사건', note: '가문 수첩' }

function itemRow(world: World, uid: string, equipped: boolean): ItemRow {
  const inst = world.state.item_instances[uid]!
  const def = world.content.get('item', inst.def_id)
  const relic = world.state.inventory.relic_designations.find((r) => r.uid === uid)?.priority ?? null
  return {
    uid, slot: SLOT_LABEL[def.slot] ?? def.slot, name: itemName(world, inst), grade: GRADE[inst.grade] ?? GRADE.common!,
    cursed: def.cursed, locked: inst.locked, relic: relic as 1 | 2 | null, equipped,
    order: world.state.inventory.equip_orders?.find((o) => o.uid === uid)?.op ?? null,
    desc: def.description,
    lore: loreLines(world, def.id),
  }
}

// {use} 명사구(14 §5.1). 문형이 없으면 빈 글
const useText = (world: World, id: string): string => (world.content.has('text', id) ? world.content.get('text', id).variants[0]! : '')

export function characterModel(world: World): CharacterModel | null {
  const ch = world.state.character
  if (!ch) return null
  const { content } = world
  const b = content.balance
  const age = ageAt(ch.eff_min, b.time)
  const spec = jobLabel(world, ch.specialization, ch.job2)
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
    stats: (Object.keys(STAT_LABELS) as (keyof typeof STAT_LABELS)[]).map((s) => ({
      label: STAT_LABELS[s], value: effectiveStat(world, s), base: ch.stats[s], use: useText(world, statUseText(s)),
    })),
    skills: (Object.keys(SKILL_LABELS) as (keyof typeof SKILL_LABELS)[]).map((s) => {
      const rank = ch.skills[s].rank
      return {
        label: SKILL_LABELS[s], rank, max: b.skills.max_rank, uses: ch.skills[s].uses, next: thresholds[rank] ?? null,
        effect: rank > 0 ? `${useText(world, skillUseText(s))} 판정 +${rank}` : null,
      }
    }),
    job: {
      name: ch.specialization === 'none' ? '초보 모험가' : jobLabel(world, ch.specialization, ch.job2),
      lines: [
        ...(ch.specialization === 'none' ? [] : [b.job_rules.spec_effect_text[ch.specialization] ?? '']),
        ...(ch.job2 && b.second_jobs[ch.job2] ? [b.second_jobs[ch.job2]!.effect_text] : []),
      ].filter(Boolean),
    },
    techniques: ch.techniques.map((t) => ({
      name: b.techniques[t.id]?.name ?? t.id, source: TECH_SOURCE[t.source] ?? t.source, effect: b.techniques[t.id]?.effect_text ?? '',
    })),
    traits: ch.traits.map((t) => {
      const by = t.inactive === 'replaced' ? content.list('trait').find((x) => x.replaces === t.id && ch.traits.some((y) => y.id === x.id)) : undefined
      return {
        name: content.get('trait', t.id).name, ...traitBadge(t.id, t.source), since: t.since_age, effect: content.get('trait', t.id).effect_text,
        inactive: !t.inactive ? null : by ? renderTemplate('{t:으로/로} 바뀜', { t: by.name }) : t.inactive === 'replaced' ? '바뀜' : '기록으로 옮겨짐',
      }
    }),
    injuries: ch.injuries.map((i) => `${i.grade === 'serious' ? '중상' : '경상'} (${STAT_LABELS[i.stat]} −1) · ${Math.ceil(i.remaining_min)}분 뒤 회복`),
    equipment,
    bag: { used: inv.bag.length, max: b.stats.bag_slots, items: inv.bag.map((u) => itemRow(world, u, false)), consumables },
    inTown: isInTown(world),
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

const ACTIVITY_LABEL: Record<string, string> = { hunt: '사냥', dungeon: '던전', adventure: '모험' }

// 아직 갈 수 없는 곳과 그 까닭(해금 조건·길드 등급, 03 §5.4, D87)
export function lockedPlaces(world: World): { name: string; why: string }[] {
  const out: { name: string; why: string }[] = []
  for (const r of world.content.list('region')) {
    if (r.kind === 'town' || (isUnlocked(world, r) && rankAllowed(world, r))) continue
    const why = !rankAllowed(world, r) && r.guild_rank_req
      ? `${world.content.get('guild_rank', r.guild_rank_req).name} 필요`
      : '아직 길을 모릅니다(발견·관문을 넘으면 열립니다)'
    out.push({ name: r.name, why })
  }
  return out
}

export function destinationModel(world: World): { current: string; places: PlaceOption[] } {
  const places: PlaceOption[] = []
  for (const r of world.content.list('region')) {
    if (r.kind === 'town' || !isUnlocked(world, r) || !rankAllowed(world, r)) continue
    const grade = riskGrade(world.content, riskDiff(world, r.id, false))
    const reckless = grade === 'reckless'
    const cap = placeRiskCap(world, activityOf(r.kind)) // 모험적의 모험 예외를 반영한 상한(04 §10.1)
    places.push({ id: r.id, name: `${r.name} · ${ACTIVITY_LABEL[activityOf(r.kind)] ?? ''} · 권장 Lv${regionLevel(world, r.id)}`, grade: RISK_LABEL[grade] ?? grade, cap: RISK_LABEL[cap] ?? cap, reckless, ask: reckless || riskRank(grade) > riskRank(cap) })
  }
  const cur = world.state.policies.destination
  if (cur !== 'auto' && !places.some((p) => p.id === cur) && world.content.has('region', cur)) {
    places.push({ id: cur, name: `${world.content.get('region', cur).name} (지금 갈 수 없음)`, grade: '', cap: '', ask: false, reckless: false })
  }
  return { current: cur, places }
}

// ── 가문 탭 연대기(03 §5.5) ──

export interface ChronicleRow {
  gen: number
  head: string // 1대 모라  18~68세 · 은퇴 · 수호자 Lv26
  lines: string[] // 펼침: 주요 기록(나이순), 남긴 유품
}

// ── 가문 탭 가계도(03 §5.5, D87): 플레이 인물을 대수 순으로, 곁에 뽑히지 않은 후보(가는 테두리)와 동반자 ──

const ROLE_LABEL: Record<string, string> = { founder: '가문을 세움', direct: '직계', collateral: '방계', adopted: '입양' }

export interface TreeNode { gen: number; name: string; role: string; dashed: boolean; current: boolean; row: number; partner: string | null; passed: { name: string; role: string }[] }

// row: 연대기 목록에서 이 인물 줄의 순번(누르면 그 줄로 간다)
export function treeModel(world: World): TreeNode[] {
  const { family: fam, character: ch } = world.state
  const past = [...fam.chronicle].sort((a, b) => a.gen - b.gen)
  // 계승 대기 중이면 끝난 인물은 이미 연대기에 있다(현재 인물 줄을 두 번 그리지 않는다)
  const living = !!ch && !fam.chronicle.some((r) => r.char_uid === ch.uid)
  // 동반자: 가문 인연 기록(npc_id partner, 12 §7.3)의 그 대 첫 이름
  const partnerOf = (gen: number): string | null => {
    const b = fam.bonds.find((x) => x.npc_id === 'partner' && x.gen === gen)
    return b ? b.key : null
  }
  const nodes: TreeNode[] = past.map((r) => ({
    gen: r.gen, name: r.name, role: ROLE_LABEL[r.family_role] ?? r.family_role,
    dashed: r.family_role === 'collateral' || r.family_role === 'adopted', current: false, row: (living ? 1 : 0) + (past.length - 1 - past.indexOf(r)),
    partner: partnerOf(r.gen), passed: r.candidates_passed.map((c) => ({ name: c.name, role: ROLE_LABEL[c.relation] ?? c.relation })),
  }))
  if (ch && !fam.chronicle.some((r) => r.char_uid === ch.uid)) {
    const role = ch.family_role
    nodes.push({ gen: ch.generation, name: ch.name, role: ROLE_LABEL[role] ?? role, dashed: role === 'collateral' || role === 'adopted', current: true, row: 0, partner: partnerOf(ch.generation), passed: [] })
  }
  return nodes
}

// ── 가문 탭 도감(03 §5.5, 12 §7.2, D87): 장비는 본 적 없음 ??? / 본 적 있음(회색) / 가진 적 있음, 적·장소는 겪은 것만,
// 사건은 겪은 사건 이름과 고른 선택지. 장비 격자 그림은 그림이 오면 ──

export type CodexState = 'none' | 'seen' | 'owned'
export interface CodexSection { title: string; found: number; total: number; rows: string[]; notes?: string[][]; states?: CodexState[] } // notes: 줄마다 펼침 글(장비 주석, D80)

export function codexModel(world: World): { sections: CodexSection[]; unlocks: string[] } {
  const { content, state } = world
  const cx = state.family.codex
  const grades = (gs: string[]): string => gs.map((g) => GRADE[g]?.label ?? g).join('·')
  const items = [...content.list('item')]
  const enemies = [...content.list('enemy')]
  const places = [...content.list('region')]
  const events = content.list('event').filter((e) => e.category !== 'system')
  const section = <T extends { id: string; name: string }>(title: string, list: T[], got: Record<string, unknown>, detail: (d: T) => string): CodexSection => ({
    title, found: list.filter((d) => got[d.id]).length, total: list.length,
    rows: list.map((d) => (got[d.id] ? `${d.name}${detail(d)}` : '???')),
  })
  const u = state.family.unlocks
  const placeName = (id: string | undefined): string => (id && content.has('region', id) ? content.get('region', id).name : '')
  const itemSec = section('장비', items, cx.items, (d) => {
    const it = cx.items[d.id]!
    return ` · ${grades(it.grades_seen)} · ${it.first_gen}대${it.first_place ? ` · ${placeName(it.first_place)}` : ''}`
  })
  itemSec.states = items.map((d) => (cx.items[d.id] ? 'owned' : cx.seen[d.id] ? 'seen' : 'none'))
  itemSec.rows = items.map((d, i) => (itemSec.states![i] === 'seen' ? `${d.name} · 본 적 있음` : itemSec.rows[i]!))
  itemSec.notes = items.map((d) => (cx.items[d.id] ? loreLines(world, d.id) : []))
  const enemySec = section('적', enemies, cx.enemies, (d) => {
    const e = cx.enemies[d.id]!
    return ` · 처치 ${num(e.defeats)}${e.first_name ? ` · 처음 만난 인물 ${e.first_name}` : ''}`
  })
  enemySec.notes = enemies.map((d) => {
    const f = cx.enemies[d.id] && content.has('enemy_family', d.family) ? content.get('enemy_family', d.family).ecology : undefined
    return f ? [f] : []
  })
  const placeSec = section('장소', places, cx.locations, (d) => {
    const l = cx.locations[d.id]!
    return ` · ${l.first_gen}대${l.first_name ? ` · ${l.first_name}${l.first_age !== undefined ? ` ${l.first_age}세` : ''} 발견` : ''}`
  })
  // 사건: 겪은 것만 이름과 고른 선택지(03 §5.5)
  const seenEvents = events.filter((e) => cx.events[e.id])
  const eventSec: CodexSection = {
    title: '사건', found: seenEvents.length, total: events.length,
    rows: seenEvents.map((e) => {
      const picked = (cx.events[e.id]!.choices ?? []).map((id) => e.choices.find((c) => c.id === id)?.label ?? id)
      return `${e.name}${picked.length ? ` · ${picked.join(', ')}` : ''}`
    }),
  }
  return {
    sections: [itemSec, enemySec, placeSec, eventSec],
    unlocks: [
      ...u.backgrounds.map((id) => (content.has('background', id) ? content.get('background', id).name : id)),
      ...u.titles, ...u.appearances,
    ],
  }
}

// ── 가문 탭 유품(03 §5.5): 지금 등록한 유품 2칸 + 대를 건너온 유품과 사연 ──

const HOW: Record<string, string> = { shop: '샀다', aid: '받았다', start: '받았다' }

export interface RelicModel { slots: (string | null)[]; past: { name: string; grade: { label: string; color: string }; lines: string[]; lore: string[] }[] }

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
    const who = { generation: a.gen, name: nameOf(a.char_uid), ...(def.lore.npc ? { npc: def.lore.npc } : {}) }
    // 사연은 장비의 story_template(16 §2.5), {npc}는 lore.npc(D80). 채울 값이 없는 틀이면 획득 기록으로 대신한다
    let story: string
    try {
      story = renderTemplate(def.story_template, who)
    } catch {
      story = renderTemplate(`{gen}대 {name:이/가} {age}세에 {place}에서 ${HOW[a.source] ?? '발견했다'}`, { gen: a.gen, name: who.name, age: a.age, place })
    }
    return {
      name: itemName(world, inst), grade: GRADE[inst.grade] ?? GRADE.common!,
      lines: [story, ...inst.history.map((h) => `${h.gen}대 ${h.age}세 · ${h.text}`)],
      lore: loreLines(world, def.id).filter((l) => !l.startsWith('얻는 곳 · ')), // 사연·주인·공개된 비밀(03 §5.5, D80)
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
  if (ch && !fam.chronicle.some((r) => r.char_uid === ch.uid)) {
    const age = ageAt(ch.eff_min, content.balance.time)
    // 살아 있는 인물도 지금까지의 주요 기록을 같은 선별(12 §7.1, 18 §4.1)로 보인다(D77)
    const cm = content.balance.inheritance.chronicle_major
    const relicUids = [...state.inventory.relic_designations.map((r) => r.uid),
      ...Object.values(state.item_instances).filter((i) => i.inherited_from_gen !== undefined).map((i) => i.uid)]
    const majors = chronicleMajor(state.journal, ch.uid, {
      relicUids, clamp: cm.clamp, scoreGte: cm.score_gte,
      eventCategory: (id) => (content.has('event', id) ? content.get('event', id).category : undefined),
    })
    rows.push({
      gen: ch.generation,
      head: `${ch.generation}대 ${ch.name}  ${content.balance.time.start_age}세~ · 현재 · ${jobLabel(world, ch.specialization, ch.job2)} Lv${ch.level} (${age}세)`,
      lines: majors.map((e) => `${e.age}세 ${e.line}`),
    })
  }
  for (const r of [...fam.chronicle].sort((a, b) => b.gen - a.gen)) {
    const spec = jobLabel(world, r.specialization, r.job2)
    const majors = r.major_entry_ids.map((id) => byId.get(id)).filter((e): e is JournalEntry => !!e).sort((a, b) => a.id - b.id)
    const relics = r.relics_passed.map((u) => state.item_instances[u]).filter((i) => i !== undefined).map((i) => itemName(world, i))
    rows.push({
      gen: r.gen,
      head: `${r.gen}대 ${r.name}  ${content.balance.time.start_age}~${r.end_age}세 · ${END_LABEL[r.end_kind] ?? r.end_kind} · ${spec} Lv${r.peak_level}`,
      lines: [...majors.map((e) => `${e.age}세 ${e.line}`), ...(relics.length ? [`유품: ${relics.join(', ')}`] : [])],
    })
  }
  return { title: `${fam.name} 가문 · ${fam.generation}대째`, rows }
}
