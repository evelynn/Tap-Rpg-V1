// 판정(05 §6): 난이도, 보정 합산(기타 −5~+5, 특성 하나 ±2), 결과 단계, 선택형, 판정 기록.
import type { Modifier, SKILLS } from '../schema/index'
import type { CheckRecord, CheckResult } from '../state/journal'
import { characterOf, type RuleContext } from './context'
import { effectiveStat, injuryPenalty, weaponProfile, type Stat } from './derived'
import { addSkillUses, addStatUse, type RankUp } from './growth'
import { SKILL_LABELS, SOURCE_LABELS, STAT_LABELS } from './labels'
import { activeMods, aggregate, collectModSources, type ModSource } from './modifiers'
import type { Rng } from './random'

type Skill = (typeof SKILLS)[number]

export function checkKind(ctx: Pick<RuleContext, 'content'>, id: string) {
  const k = ctx.content.balance.check_kinds[id]
  if (!k) throw new Error(`판정 종류 '${id}'가 balance.check_kinds에 없다`)
  return k
}

// 전투 명중에 쓰는 판정 종류: dc.kind가 enemy_ac인 것(ID를 코드에 두지 않는다)
export function attackKindId(ctx: Pick<RuleContext, 'content'>): string {
  const hit = Object.entries(ctx.content.balance.check_kinds).find(([, k]) => k.dc.kind === 'enemy_ac')
  if (!hit) throw new Error('dc.kind enemy_ac인 판정 종류가 없다')
  return hit[0]
}

// 지역 기준 DC = 11 + ⌊지역 레벨 / 2.5⌋(01 §3.2). 마을 사건은 인물 레벨을 넣는다
export function regionDc(ctx: Pick<RuleContext, 'content'>, regionLevel: number): number {
  const c = ctx.content.balance.check
  return c.region_dc_base + Math.floor(regionLevel / c.region_dc_div)
}

export interface DcInput {
  regionLevel?: number
  dc?: number // 사건 고정값(덮어씀)
  dcOffset?: number
  gate?: boolean // 관문(gate_add)
  maxEnemyLevel?: number
  enemyAc?: number
}

function need(v: number | undefined, what: string): number {
  if (v === undefined) throw new Error(`판정 난이도에 ${what}가 필요하다`)
  return v
}

// 종류의 dc.kind에 따라(CONTENT_SCHEMA §5.10 표)
export function checkDc(ctx: Pick<RuleContext, 'content'>, kindId: string, input: DcInput): number {
  const k = checkKind(ctx, kindId)
  const dc = k.dc
  let v: number
  switch (dc.kind) {
    case 'region':
      v = input.dc ?? regionDc(ctx, need(input.regionLevel, 'regionLevel')) + (dc.offset ?? 0) + (input.dcOffset ?? 0)
      break
    case 'fixed':
      v = input.dc ?? dc.value
      break
    case 'event':
      v = input.dc ?? regionDc(ctx, need(input.regionLevel, 'regionLevel')) + need(input.dcOffset, 'dc 또는 dcOffset')
      break
    case 'level_formula': {
      const src = dc.source === 'max_enemy_level' ? input.maxEnemyLevel : input.regionLevel
      v = dc.base + Math.floor(need(src, dc.source) / dc.div)
      break
    }
    case 'enemy_ac':
      v = need(input.enemyAc, 'enemyAc')
      break
  }
  return v + (input.gate ? (k.gate_add ?? 0) : 0)
}

export interface CheckPart {
  label: string
  value: number
}

export interface CheckBonus {
  kind: string
  stat: Stat
  statValue: number // 부상 감소 뒤, 최저 0
  skill: Skill | null
  skillValue: number
  others: number // 기타 보정(상한 적용 뒤)
  capped: boolean
  extra: number // 최후 판정 ⌊행운/luck_div⌋(기타 상한과 별도)
  bonus: number // 능력치 + 숙련 + 기타 + 추가
  parts: CheckPart[] // 판정 기록 항(0은 뺌)
}

export interface CheckBonusOptions {
  situational?: readonly Modifier[] // 사건 check.situational
  extraTargets?: readonly string[] // 전투 명중의 hit·hit_vs.{계열}, 최후 판정 final_check_add 등
}

const MAX_NAMED_PARTS = 3

export function checkBonus(
  ctx: RuleContext,
  kindId: string,
  opts: CheckBonusOptions = {},
  sources: readonly ModSource[] = collectModSources(ctx),
): CheckBonus {
  const b = ctx.content.balance
  const k = checkKind(ctx, kindId)
  const ch = characterOf(ctx)
  // 무기 능력치 판정(명중·명중(사건))은 무기 명중 보정(등급 + base.hit)을 기타에 넣는다(05 §6.1, §7.1)
  const named: CheckPart[] = []
  let stat: Stat
  if (k.stat === 'weapon') {
    const w = weaponProfile(ctx, sources)
    stat = w.stat
    if (w.item && w.hit) named.push({ label: ctx.content.get('item', w.item).name, value: w.hit })
  } else stat = k.stat
  const statValue = Math.max(0, effectiveStat(ctx, stat, sources) + injuryPenalty(ctx, stat))
  const skill = k.skill
  const skillValue = skill ? ch.skills[skill].rank : 0

  const all: ModSource[] = [...sources]
  if (opts.situational?.length) {
    all.push({ kind: 'situational', key: 'situational', label: SOURCE_LABELS.situational, modifiers: opts.situational })
  }
  const targets = ['check.all', `check.${kindId}`, `check.stat.${stat}`, ...(skill ? [`check.skill.${skill}`] : []), ...(opts.extraTargets ?? [])]
  const applied = activeMods(ctx, all, targets)

  // 출처별 값. 특성 하나의 판정 보정은 ±trait_mod_cap(06 §1)
  for (const src of all) {
    const mine = applied.filter((a) => a.source === src)
    if (!mine.length) continue
    let v = aggregate(mine, 0)
    if (src.kind === 'trait' || src.kind === 'mutation') v = Math.max(-b.check.trait_mod_cap, Math.min(b.check.trait_mod_cap, v))
    named.push({ label: src.label, value: v })
  }
  const raw = named.reduce((s, p) => s + p.value, 0)
  const [lo, hi] = b.check.mod_cap
  const others = Math.max(lo, Math.min(hi, raw))
  const capped = others !== raw

  const extra = k.luck_div ? Math.floor(effectiveStat(ctx, 'luk', sources) / k.luck_div) : 0

  const parts: CheckPart[] = []
  if (statValue) parts.push({ label: STAT_LABELS[stat], value: statValue })
  if (skill && skillValue) parts.push({ label: SKILL_LABELS[skill], value: skillValue })
  parts.push(...otherParts(named, others, capped))
  if (extra) parts.push({ label: STAT_LABELS.luk, value: extra })

  return { kind: kindId, stat, statValue, skill, skillValue, others, capped, extra, bonus: statValue + skillValue + others + extra, parts }
}

// 명중 = 무기 능력치 + 근접 + 기타(무기 명중 보정, hit·hit_vs 포함, ±5)(05 §7.1)
export function hitBonus(ctx: RuleContext, enemyFamily?: string, sources: readonly ModSource[] = collectModSources(ctx)): CheckBonus {
  const extraTargets = ['hit', ...(enemyFamily ? [`hit_vs.${enemyFamily}`] : [])]
  return checkBonus(ctx, attackKindId(ctx), { extraTargets }, sources)
}

// 판정 주사위 면수. balance에 칸이 생기기 전까지 코어 한 곳에 모아 둔다(05 §6.2)
const DIE = 20

// 성공 확률 P = (21 − 필요치) / 20, balance.check.success_p_clamp로 자른다(10 §5.3, 08 §7.2).
// 필요치 = DC − 보정 합
export function successChance(ctx: Pick<RuleContext, 'content'>, need: number): number {
  const [lo, hi] = ctx.content.balance.check.success_p_clamp
  return Math.max(lo, Math.min(hi, (DIE + 1 - need) / DIE))
}

// 05 §6.6: 이름별로 합쳐 최대 3개, 나머지는 기타. 상한에 걸리면 합친 값 하나에 (상한)
function otherParts(named: readonly CheckPart[], others: number, capped: boolean): CheckPart[] {
  if (capped) return [{ label: SOURCE_LABELS.capped, value: others }]
  const byLabel = new Map<string, number>()
  for (const p of named) byLabel.set(p.label, (byLabel.get(p.label) ?? 0) + p.value)
  const list = [...byLabel].filter(([, v]) => v !== 0).map(([label, value]) => ({ label, value }))
  if (list.length <= MAX_NAMED_PARTS) return list
  const rest = list.slice(MAX_NAMED_PARTS).reduce((s, p) => s + p.value, 0)
  return [...list.slice(0, MAX_NAMED_PARTS), ...(rest ? [{ label: SOURCE_LABELS.other, value: rest }] : [])]
}

// 05 §6.2 결과 단계. 자연 20·1이 합계보다 먼저다
export function evaluateCheck(
  ctx: Pick<RuleContext, 'content'>,
  dice: number,
  total: number,
  dc: number,
  partialAllowed: boolean,
): CheckResult {
  const c = ctx.content.balance.check
  if (dice === c.crit) return 'crit_success'
  if (dice === c.fumble) return 'crit_failure'
  if (total >= dc) return 'success'
  if (partialAllowed && total >= dc - c.partial_margin) return 'partial'
  return 'failure'
}

// 부분 성공: 종류가 허용하거나, partial_event_defined 종류를 사건이 partial_allowed로 켰을 때
export function partialAllowed(ctx: Pick<RuleContext, 'content'>, kindId: string, eventAllows?: boolean): boolean {
  const k = checkKind(ctx, kindId)
  return k.partial || (k.partial_event_defined === true && eventAllows === true)
}

// TA08 의지 +1의 상한 무시(06 §1)는 아직 받지 않는다. 최후 판정 작업(T5)에서 다룬다(I30)
export interface CheckSpec {
  kinds: readonly [string] | readonly [string, string] // 둘이면 선택형(any_of)
  dc: number | ((kind: string) => number)
  partialAllowed?: boolean // 사건 check.partial_allowed
  situational?: readonly Modifier[]
  extraTargets?: readonly string[] // CheckBonusOptions.extraTargets
  dice?: number // 미리 굴린 주사위(13 §8.3 pending_choice.pre_rolled). 주면 난수를 쓰지 않는다
}

export interface CheckRoll {
  kind: string
  dice: number
  result: CheckResult
  bonus: CheckBonus
  record: CheckRecord
}

// 판정 1회. 선택형은 보정 합이 높은 쪽으로 한 번만 굴린다(같으면 앞쪽, 05 §6.1). 상태는 바꾸지 않는다
export function rollCheck(ctx: RuleContext, rng: Rng, spec: CheckSpec): CheckRoll {
  const sources = collectModSources(ctx)
  let best: CheckBonus | undefined
  for (const kind of spec.kinds) {
    const cb = checkBonus(ctx, kind, { situational: spec.situational ?? [], extraTargets: spec.extraTargets ?? [] }, sources)
    if (!best || cb.bonus > best.bonus) best = cb
  }
  const bonus = best!
  const dc = typeof spec.dc === 'number' ? spec.dc : spec.dc(bonus.kind)
  const dice = spec.dice ?? rng.d20()
  const total = dice + bonus.bonus
  const result = evaluateCheck(ctx, dice, total, dc, partialAllowed(ctx, bonus.kind, spec.partialAllowed))
  return { kind: bonus.kind, dice, result, bonus, record: { dice, parts: bonus.parts, total, dc, result, kind: bonus.kind } }
}

// 판정 1회의 성장 누적(05 §4.1 사용 점수, §5.1 숙련 횟수). 사건 선택지 판정은 event.
// 부상·최후 판정은 statPoints로 use_points.injury_or_final을 넘긴다. 전투 명중 굴림마다 부르지 않는다(전투는 1회 단위로 센다)
export function recordCheckUse(
  ctx: RuleContext,
  roll: Pick<CheckRoll, 'kind' | 'dice' | 'bonus'>,
  opts: { event?: boolean; statPoints?: number } = {},
): RankUp[] {
  const b = ctx.content.balance
  const up = b.growth.use_points
  addStatUse(ctx, roll.bonus.stat, opts.statPoints ?? (opts.event ? up.event_check : up.check))
  if (roll.dice === b.check.crit) addStatUse(ctx, 'luk', up.natural_20_luck)
  const skill = roll.bonus.skill
  if (!skill) return []
  const r = addSkillUses(ctx, skill, b.skills.use_counts[SKILL_CHECK_USE[skill]])
  return r ? [r] : []
}

// 숙련별 "판정 1회" 사용 횟수 키(05 §5.1)
const SKILL_CHECK_USE = {
  melee: 'attack_event_check',
  mobility: 'mobility_check',
  search: 'search_check',
  survival: 'survival_check',
  negotiation: 'negotiation_check',
} as const
