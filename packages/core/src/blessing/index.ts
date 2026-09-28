// 가호(01 §19 수치, 04 §10.3 절차, D78): 사용자가 가끔 절대적인 존재로서 인물을 돕는다. 인물은 알아채지 못한다.
// 별빛은 가문에 모이고(상한 3), 걸어 두는 가호는 조건이 오는 순간 발동하며, 바로 쓰는 가호는 즉시 효과가 난다.
import type { Content } from '../content/index'
import { addJournal } from '../journal/index'
import { characterOf, type RuleContext } from '../rules/context'
import { STATS, SKILLS, registerTextSlot } from '../schema/index'
import { BLESSING_ARMED, BLESSING_STARTS } from '../state/character'
import type { JournalDraft } from '../state/journal'
import { Pcg32, sha256, utf8 } from '../rng/index'
import { renderTemplate } from '../text/index'
import { learnTechnique } from '../jobs/index'
import { ageAt } from '../time/index'

export type ArmedKind = (typeof BLESSING_ARMED)[number]
export type StartKind = (typeof BLESSING_STARTS)[number]
type Stat = (typeof STATS)[number]
type Skill = (typeof SKILLS)[number]

export const BLESSING_TEXT = {
  finalSave: 'journal.blessing.final_save', finalSaveDetail: 'journal.blessing.final_save_detail',
  heal: 'journal.blessing.heal', healDetail: 'journal.blessing.heal_detail',
  miracle: 'journal.blessing.miracle', miracleDetail: 'journal.blessing.miracle_detail',
  mitigate: 'journal.blessing.mitigate', mitigateDetail: 'journal.blessing.mitigate_detail',
  mitigateEvent: 'journal.blessing.mitigate_event', mitigateEventDetail: 'journal.blessing.mitigate_event_detail',
  start: 'journal.blessing.start', startDetail: 'journal.blessing.start_detail',
} as const
for (const id of Object.values(BLESSING_TEXT)) registerTextSlot(id, '가호(D78)')

const text = (content: Content, id: string, v: Record<string, string | number> = {}): string =>
  renderTemplate(content.get('text', id).variants[0]!, v)

const cfg = (ctx: RuleContext) => ctx.content.balance.blessing
const mine = (ctx: RuleContext) => characterOf(ctx).blessing

// ── 조회 ──

export const charges = (ctx: RuleContext): number => ctx.state.family.blessing.charges
export const isArmed = (ctx: RuleContext, kind: ArmedKind): boolean => ctx.state.character?.blessing.armed.some((a) => a.kind === kind) ?? false
// 이번 생애에 더 쓸 수 있는 수(쓴 수 + 걸어 둔 수 ≤ 생애 상한, 04 §10.3 4번)
export const usesLeft = (ctx: RuleContext): number => cfg(ctx).life_uses - mine(ctx).uses - mine(ctx).armed.length

export type BlockReason = 'no_charge' | 'life_cap' | 'armed' | 'used' | 'no_target'

const costOf = (ctx: RuleContext, kind: ArmedKind | 'heal' | 'illuminate'): number => cfg(ctx).costs[kind]

function blocked(ctx: RuleContext, kind: ArmedKind | 'heal' | 'illuminate'): BlockReason | null {
  // 생애가 끝나 계승을 기다리는 동안은 쓸 인물이 없다(걸어 둔 별빛은 이미 돌려받았다, 독립 검증 D78-4)
  if (ctx.state.current_activity.state === 'awaiting_succession') return 'no_target'
  if (usesLeft(ctx) <= 0) return 'life_cap'
  if (charges(ctx) < costOf(ctx, kind)) return 'no_charge'
  return null
}

export function armBlock(ctx: RuleContext, kind: ArmedKind): BlockReason | null {
  if (isArmed(ctx, kind)) return 'armed'
  if (kind === 'final_save' && mine(ctx).final_used) return 'used'
  return blocked(ctx, kind)
}

export const healBlock = (ctx: RuleContext): BlockReason | null =>
  characterOf(ctx).injuries.some((i) => i.grade === 'serious') ? blocked(ctx, 'heal') : 'no_target'

export function illuminateBlock(ctx: RuleContext): BlockReason | null {
  const p = ctx.state.pending_choice
  if (!p || p.illuminated || !ctx.content.get('event', p.event_id).choices.some((c) => c.starlight)) return 'no_target'
  return blocked(ctx, 'illuminate')
}

// ── 걸기·풀기(04 §10.3 2번): 걸 때 별빛을 떼고 풀면 돌려준다. 발동할 때 사용 1번으로 센다 ──

export function arm(ctx: RuleContext, kind: ArmedKind): boolean {
  if (armBlock(ctx, kind) !== null) return false
  ctx.state.family.blessing.charges -= costOf(ctx, kind)
  mine(ctx).armed.push({ kind, eff_min: characterOf(ctx).eff_min })
  return true
}

export function unarm(ctx: RuleContext, kind: ArmedKind): boolean {
  const b = mine(ctx)
  if (!b.armed.some((a) => a.kind === kind)) return false
  b.armed = b.armed.filter((a) => a.kind !== kind)
  refund(ctx, costOf(ctx, kind))
  return true
}

function refund(ctx: RuleContext, n: number): void {
  const f = ctx.state.family.blessing
  f.charges = Math.min(cfg(ctx).cap, f.charges + n)
}

// 걸어 둔 가호가 발동했다: 걸린 목록에서 빼고 사용 1번(별빛은 걸 때 이미 뗐다)
export function consumeArmed(ctx: RuleContext, kind: ArmedKind): boolean {
  const b = mine(ctx)
  if (!b.armed.some((a) => a.kind === kind)) return false
  b.armed = b.armed.filter((a) => a.kind !== kind)
  b.uses += 1
  ctx.state.family.blessing.total_used += 1
  if (kind === 'final_save') b.final_used = true
  return true
}

// 행동 시작(resolve)에 이미 고른 가호를 적용 때 센다. 그 사이 풀어 별빛을 돌려받았어도 효과는 이미 났으므로
// 다시 떼고 사용 1번으로 센다(독립 검증 D78-2: 풀기로 효과만 남기고 별빛을 되찾는 반복을 막는다)
export function consumeCommitted(ctx: RuleContext, kind: ArmedKind): void {
  if (consumeArmed(ctx, kind)) return
  const f = ctx.state.family.blessing
  const b = mine(ctx)
  f.charges = Math.max(0, f.charges - costOf(ctx, kind))
  f.total_used += 1
  b.uses += 1
  if (kind === 'final_save') b.final_used = true
}

function spend(ctx: RuleContext, kind: 'heal' | 'illuminate'): void {
  ctx.state.family.blessing.charges -= costOf(ctx, kind)
  ctx.state.family.blessing.total_used += 1
  mine(ctx).uses += 1
}

const draft = (d: Omit<JournalDraft, 'sub'>): JournalDraft => ({ ...d, sub: 'blessing' })

// ── 바로 쓰기(04 §10.3 3번) ──

// 상처를 낫게 한다: 중상 1개를 바로 치유. 중상 누적 수는 그대로 둔다(일어난 일은 지우지 않는다)
export function healNow(ctx: RuleContext): boolean {
  if (healBlock(ctx) !== null) return false
  const ch = characterOf(ctx)
  const i = ch.injuries.findIndex((x) => x.grade === 'serious')
  ch.injuries.splice(i, 1)
  spend(ctx, 'heal')
  addJournal(ctx, draft({ tag: 'injury', line: text(ctx.content, BLESSING_TEXT.heal), detail: text(ctx.content, BLESSING_TEXT.healDetail, { name: ch.name }) }))
  return true
}

// 숨은 길을 비춘다: 선택 대기 중인 사건의 별빛 길 선택지를 드러낸다(10 §8.3)
export function illuminate(ctx: RuleContext): string[] {
  if (illuminateBlock(ctx) !== null) return []
  const p = ctx.state.pending_choice!
  const ev = ctx.content.get('event', p.event_id)
  const ids = ev.choices.filter((c) => c.starlight && !p.excluded.includes(c.id)).map((c) => c.id)
  p.choices_visible = [...p.choices_visible, ...ids.filter((id) => !p.choices_visible.includes(id))]
  p.illuminated = true
  spend(ctx, 'illuminate')
  return ids
}

// ── 발동 기록(04 §10.3 10번) ──

export function finalSaveJournal(ctx: RuleContext, place: string): JournalDraft {
  const name = ctx.content.has('region', place) ? ctx.content.get('region', place).name : place
  return draft({ tag: 'injury', importance: 'major', line: text(ctx.content, BLESSING_TEXT.finalSave), detail: text(ctx.content, BLESSING_TEXT.finalSaveDetail, { place: name, name: characterOf(ctx).name }), refs: { location_id: place } })
}

export function mitigateJournal(ctx: RuleContext, place: string | null): JournalDraft {
  if (place === null) {
    return draft({ tag: 'injury', line: text(ctx.content, BLESSING_TEXT.mitigateEvent), detail: text(ctx.content, BLESSING_TEXT.mitigateEventDetail, { name: characterOf(ctx).name }) })
  }
  const name = ctx.content.has('region', place) ? ctx.content.get('region', place).name : place
  return draft({ tag: 'injury', line: text(ctx.content, BLESSING_TEXT.mitigate), detail: text(ctx.content, BLESSING_TEXT.mitigateDetail, { name: characterOf(ctx).name, place: name }), refs: { location_id: place } })
}

export function miracleJournal(ctx: RuleContext, first: number, second: number): JournalDraft {
  return draft({ tag: 'check', line: text(ctx.content, BLESSING_TEXT.miracle), detail: text(ctx.content, BLESSING_TEXT.miracleDetail, { n: first, m: second }) })
}

// 사건이 입히는 부상(04 §10.3 7번): 첫걸음의 보호(중상만) → 누그러뜨림 순서. 바뀐 등급(null = 없음)과 기록을 돌려준다
export function softenEventInjury(ctx: RuleContext, grade: 'light' | 'serious'): { grade: 'light' | 'serious' | null; journal: JournalDraft | null } {
  const b = mine(ctx)
  if (grade === 'serious' && noviceGuardActive(ctx)) {
    b.novice_guard = false
    return { grade: 'light', journal: mitigateJournal(ctx, null) }
  }
  if (consumeArmed(ctx, 'mitigate')) return { grade: grade === 'serious' ? 'light' : null, journal: mitigateJournal(ctx, null) }
  return { grade, journal: null }
}

export const noviceGuardActive = (ctx: RuleContext): boolean => {
  const ch = characterOf(ctx)
  return ch.blessing.novice_guard && ageAt(ch.eff_min, ctx.content.balance.time) < cfg(ctx).novice_until_age
}

// ── 차오름(01 §19) ──

// 극복 순간: 한 생애 crisis_per_life번까지 별빛 +1(상한 3)
export function crisisMoment(ctx: RuleContext): void {
  const b = mine(ctx)
  if (b.crisis_gains >= cfg(ctx).crisis_per_life) return
  b.crisis_gains += 1
  refund(ctx, cfg(ctx).crisis_gain)
}

// 판단 지점마다: 중상이 있었다가 모두 나으면 다음 무사 귀환이 극복 순간이 된다(01 §19 1번)
export function trackSerious(ctx: RuleContext): void {
  const ch = ctx.state.character
  if (!ch) return
  const now = ch.injuries.some((i) => i.grade === 'serious')
  if (ch.blessing.had_serious && !now) ch.blessing.serious_recovered = true
  ch.blessing.had_serious = now
}

// 무사 귀환 때(activity/sortie arriveTown)
export function safeReturn(ctx: RuleContext): void {
  const b = mine(ctx)
  if (!b.serious_recovered) return
  b.serious_recovered = false
  crisisMoment(ctx)
  learnTechnique(ctx, ctx.content.balance.job_rules.crisis_technique, 'event') // 극복 기술(05 §10.1, D79)
}

export const isCrisisTrait = (ctx: RuleContext, traitId: string): boolean => cfg(ctx).crisis_traits.includes(traitId)

// 생애가 끝날 때: 발동하지 않은 걸어 둔 가호의 별빛을 가문에 돌려준다(04 §10.3 2번)
export function refundArmedAtLifeEnd(ctx: RuleContext): void {
  const b = mine(ctx)
  for (const a of b.armed) refund(ctx, costOf(ctx, a.kind))
  b.armed = []
}

// 계승 5단계 출발(12 §1.1): 별빛 +1
export function successionGain(ctx: RuleContext): void {
  refund(ctx, cfg(ctx).succession_gain)
}

// ── 시작 축복(01 §19, 12 §1.1 5단계) ──

export interface StartChoice {
  kind: StartKind
  trait?: string // talent: talentOffers 가운데 하나
  from?: Stat // tilt
  to?: Stat
  skill?: Skill // seed
}

// 축복을 받을 대상. 계승 5단계에서는 후계자가 아직 없으므로 후보 카드 값으로 미리 본다(03 §8)
export interface BlessingSubject {
  generation: number
  traits: readonly string[] // 가진 특성 id
  birthStats: Record<Stat, number>
  background: string
  ranks: Record<Skill, number>
}

export function subjectOf(ctx: RuleContext): BlessingSubject {
  const ch = characterOf(ctx)
  return {
    generation: ch.generation, traits: ch.traits.map((t) => t.id), birthStats: { ...ch.birth_stats }, background: ch.background,
    ranks: Object.fromEntries(SKILLS.map((k) => [k, ch.skills[k].rank])) as Record<Skill, number>,
  }
}

// 타고난 재능 후보: 가지지 않은 긍정 선천 특성을 06 §6.3 가중으로 뽑는다. 가문 시드 + 대수로 정해져 다시 열어도 같다(12 §10)
export function talentOffers(ctx: RuleContext, subj: BlessingSubject = subjectOf(ctx)): string[] {
  const innate = subj.traits.filter((id) => ctx.content.get('trait', id).kind === 'innate')
  if (innate.length >= ctx.content.balance.stats.trait_caps.innate) return []
  const pool = ctx.content.list('trait').filter((t) => t.kind === 'innate' && (t.birth_weight ?? 0) > 0
    && !('inherit_class' in t && t.inherit_class === 'negative') && !subj.traits.includes(t.id))
  const h = sha256(utf8(`${ctx.state.family.family_seed}:blessing:${subj.generation}`))
  const rd = (o: number) => [...h.slice(o, o + 8)].reduce((a, v) => (a << 8n) | BigInt(v), 0n)
  const rng = Pcg32.seed(rd(0), rd(8))
  const out: string[] = []
  const rest = [...pool]
  while (out.length < cfg(ctx).talent_offers && rest.length) {
    const i = rng.weightedIndex(rest.map((t) => t.birth_weight ?? 0))
    out.push(rest[i]!.id)
    rest.splice(i, 1)
  }
  return out
}

// 기울어진 재능이 옮길 수 있는 쌍: 합 11, 한 능력치 1~4(01 §2.1)
export function canTilt(ctx: RuleContext, from: Stat, to: Stat, subj: BlessingSubject = subjectOf(ctx)): boolean {
  const st = ctx.content.balance.stats
  return from !== to && subj.birthStats[from] > Math.max(1, st.birth_base) && subj.birthStats[to] < st.birth_cap
}

export const seedSkills = (ctx: RuleContext, subj: BlessingSubject = subjectOf(ctx)): Skill[] => {
  const bgSkill = ctx.content.get('background', subj.background).start_skill
  return SKILLS.filter((s) => s !== bgSkill && subj.ranks[s] === 0)
}

export function startBlock(ctx: RuleContext, c: StartChoice, subj: BlessingSubject = subjectOf(ctx), taken: StartKind | null = mine(ctx).start): string | null {
  if (taken !== null) return '이미 시작 축복을 받았다'
  switch (c.kind) {
    case 'talent': return c.trait && talentOffers(ctx, subj).includes(c.trait) ? null : '고를 수 있는 특성이 아니다'
    case 'tilt': return c.from && c.to && canTilt(ctx, c.from, c.to, subj) ? null : '옮길 수 없는 능력치다'
    case 'seed': return c.skill && seedSkills(ctx, subj).includes(c.skill) ? null : '고를 수 없는 숙련이다'
    default: return null
  }
}

// 시작 축복을 적용하고 출발 기록을 남긴다. 고른 값이 규칙에 맞지 않으면 예외
export function applyStartBlessing(ctx: RuleContext, c: StartChoice): void {
  const why = startBlock(ctx, c)
  if (why) throw new Error(`시작 축복을 줄 수 없다: ${why}`)
  const ch = characterOf(ctx)
  const b = mine(ctx)
  switch (c.kind) {
    case 'talent':
      ch.traits.push({ id: c.trait!, since_age: ageAt(ch.eff_min, ctx.content.balance.time), source: 'blessing' })
      break
    case 'tilt':
      for (const o of [ch.birth_stats, ch.stats]) {
        o[c.from!] -= 1
        o[c.to!] += 1
      }
      break
    case 'first_step':
      b.novice_guard = true
      break
    case 'seed':
      ch.skills[c.skill!].uses = Math.max(ch.skills[c.skill!].uses, cfg(ctx).seed_uses)
      ch.skills[c.skill!].rank = Math.max(ch.skills[c.skill!].rank, 1)
      break
    case 'handful':
      refund(ctx, 1)
      break
  }
  b.start = c.kind
  addJournal(ctx, draft({ tag: 'succession', importance: 'family', line: text(ctx.content, BLESSING_TEXT.start), detail: text(ctx.content, BLESSING_TEXT.startDetail) }))
}

// 자동 계승의 `지난번과 같게`(01 §18.2): 앞 세대가 받은 축복 종류를 첫 유효 선택으로 채운다. 줄 수 없으면 null
export function repeatStartChoice(ctx: RuleContext, kind: StartKind): StartChoice | null {
  const c: StartChoice = { kind }
  if (kind === 'talent') c.trait = talentOffers(ctx)[0]
  if (kind === 'seed') c.skill = seedSkills(ctx)[0]
  if (kind === 'tilt') return null // 어느 능력치를 옮길지는 사람이 고른다
  return startBlock(ctx, c) === null ? c : null
}
