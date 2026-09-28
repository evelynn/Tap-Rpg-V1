// 성장(05 §3~§5, §9): 경험치·레벨업·능력치 배분, 사용 점수, 숙련 횟수, 노화, 회복 계수.
import { SKILLS, STATS } from '../schema/index'
import type { Content } from '../content/index'
import { ageAt } from '../time/index'
import { characterOf, type RuleContext } from './context'
import { maxHp, statCap, type Stat } from './derived'
import { modValue } from './modifiers'
import { weightedPick, type Rng } from './random'

type Skill = (typeof SKILLS)[number]

// ── 경험치 ──

// req(n) = req_round 단위 반올림(목표 분(n) × prod_rate × XP(n)), 최소 req_min(01 §2.4). 최대 레벨이면 null
export function xpToNext(content: Content, level: number): number | null {
  const x = content.balance.xp
  if (level >= x.max_level) return null
  const t = x.target_min
  const target = t.base + t.amp * (1 - Math.exp(-(level - 1) / t.tau)) + t.linear * (level - 1)
  const raw = target * x.prod_rate * (x.encounter_base.flat + x.encounter_base.per_level * level)
  return Math.max(x.req_min, Math.round(raw / x.req_round) * x.req_round)
}

export interface EncounterXpInput {
  // 적 경험치(등급 배수 포함). 레벨 오프셋 0이면 적 정의 xp(등록부 값), 아니면 enemyStats(…).xp.
  // 비전투 장면·방은 enemyStats(그 레벨, normal).xp(05 §3.1, CONTENT_SCHEMA §5.1)
  baseXp: number
  enemyLevel: number // 감쇠 비교용. 밤 +1·던전 방 보정을 반영한 레벨
  activity: 'hunt' | 'adventure' | 'dungeon_room'
  charLevel: number
}

// 적 경험치 × 활동 × 과소 난도 감쇠, 소수 버림(05 §3.1~§3.2)
export function encounterXp(content: Content, i: EncounterXpInput): number {
  const x = content.balance.xp
  const d = x.overlevel_decay
  const gap = i.charLevel - i.enemyLevel
  const decay = gap > d.free_gap ? Math.max(d.floor, 1 - d.per_level * (gap - d.free_gap)) : 1
  return Math.floor(i.baseXp * x.activity_mult[i.activity] * decay + 1e-9)
}

export interface LevelUp {
  level: number
  stat: Stat | null // 배분으로 오른 능력치(배분 레벨이 아니거나 모두 상한이면 null)
}

// 경험치를 더하고 레벨업을 처리한다(05 §3.4): 최대 HP 증가분만큼 현재 HP도, 배분 레벨이면 능력치 배분(life 흐름)
export function addXp(ctx: RuleContext, rng: Rng, amount: number): LevelUp[] {
  const { content } = ctx
  const ch = characterOf(ctx)
  const ups: LevelUp[] = []
  ch.xp += amount
  for (;;) {
    const req = xpToNext(content, ch.level)
    if (req === null) {
      ch.xp = 0
      break
    }
    if (ch.xp < req) break
    const before = maxHp(ctx)
    ch.xp -= req
    ch.level += 1
    const stat = content.balance.stats.growth_levels.includes(ch.level) ? allocateStat(ctx, rng) : null
    ch.hp += Math.max(0, maxHp(ctx) - before)
    ups.push({ level: ch.level, stat })
  }
  return ups
}

// ── 능력치 배분(05 §4) ──

export function addStatUse(ctx: RuleContext, stat: Stat, points: number): void {
  characterOf(ctx).stat_use_points[stat] += points
}

// STATS 순서의 배분 점수. 상한에 닿은 능력치는 0, 나머지는 하한 floor
export function allocationWeights(ctx: RuleContext): number[] {
  const g = ctx.content.balance.growth.alloc
  const ch = characterOf(ctx)
  const u = ch.stat_use_points
  const spec = ch.job2 ? ctx.content.balance.second_jobs[ch.job2] ?? null : ch.specialization === 'none' ? null : ctx.content.balance.specializations[ch.specialization]
  const main = STATS.filter((s) => s !== 'luk')
  const sum = main.reduce((acc, s) => acc + u[s], 0)
  return STATS.map((s) => {
    if (ch.stats[s] >= statCap(ctx, s)) return 0
    let score: number
    if (s === 'luk') {
      score = Math.min(g.luck.cap, g.luck.base + g.luck.per_point * u.luk)
    } else {
      const uRatio = sum > 0 ? u[s] / sum : 1 / main.length
      const sRatio = spec ? (s === spec.growth.primary ? g.primary : s === spec.growth.secondary ? g.secondary : 0) : 0
      score = spec ? g.use_w * uRatio + g.spec_w * sRatio : uRatio
    }
    return Math.max(g.floor, score)
  })
}

// 1점 배분 후 모든 사용 점수 × decay. 모든 능력치가 상한이면 null
export function allocateStat(ctx: RuleContext, rng: Rng): Stat | null {
  const ch = characterOf(ctx)
  const w = allocationWeights(ctx)
  if (w.every((x) => x === 0)) return null
  const stat = STATS[weightedPick(rng, w)]!
  ch.stats[stat] += 1
  ch.stat_growth.push({ level: ch.level, stat })
  for (const s of STATS) ch.stat_use_points[s] *= ctx.content.balance.growth.decay
  return stat
}

// ── 숙련(05 §5) ──

export interface RankUp {
  skill: Skill
  from: number
  to: number
}

export function skillRank(content: Content, uses: number): number {
  const s = content.balance.skills
  return Math.min(s.max_rank, s.rank_thresholds.filter((t) => uses >= t).length)
}

// 전문화 배수를 곱해 누적(소수 유지, 05 §5.2). 단계가 오르면 돌려준다
export function addSkillUses(ctx: RuleContext, skill: Skill, count: number): RankUp | null {
  const ch = characterOf(ctx)
  const spec = ch.specialization === 'none' ? null : ctx.content.balance.specializations[ch.specialization]
  const entry = ch.skills[skill]
  entry.uses += count * (spec?.skill_use_mult[skill] ?? 1)
  const from = entry.rank
  entry.rank = Math.max(from, skillRank(ctx.content, entry.uses))
  return entry.rank > from ? { skill, from, to: entry.rank } : null
}

// ── 노화(05 §9, balance.aging) ──

export interface AgingChange {
  age: number
  stat: Stat
  delta: number // 실제로 바뀐 값(상한·하한 반영, 0이면 넣지 않음)
}

// fromAge < 나이 ≤ toAge에 든 이정표를 나이 순서로 적용한다. 올리는 보정은 상한이면 적용하지 않고,
// 내리는 보정은 floor(없으면 능력치 최저 = stats.birth_base, 05 §1 범위 1~8) 아래로 가지 않으며
// 변이 no_aging_loss면 적용하지 않는다. 최대 HP가 줄면 현재 HP를 그만큼 자른다
export function applyAging(ctx: RuleContext, fromAge: number, toAge: number): AgingChange[] {
  const ch = characterOf(ctx)
  const minStat = ctx.content.balance.stats.birth_base
  const noLoss = ch.mutation ? ctx.content.get('trait', ch.mutation.trait_id).mutation?.no_aging_loss === true : false
  const hits: { age: number; m: (typeof ctx.content.balance.aging.milestones)[number] }[] = []
  for (const m of ctx.content.balance.aging.milestones) {
    for (let a = m.age; a <= toAge; a += m.every_years ?? Infinity) {
      if (a > fromAge) hits.push({ age: a, m })
      if (!m.every_years) break
    }
  }
  hits.sort((x, y) => x.age - y.age)
  const out: AgingChange[] = []
  for (const { age, m } of hits) {
    for (const stat of STATS) {
      const add = m.stat_add[stat]
      if (!add) continue
      const cur = ch.stats[stat]
      let next = cur
      if (add > 0) next = cur >= statCap(ctx, stat) ? cur : Math.min(statCap(ctx, stat), cur + add)
      else if (!noLoss) next = Math.max(m.floor ?? minStat, cur + add)
      if (next !== cur) {
        ch.stats[stat] = next
        out.push({ age, stat, delta: next - cur })
      }
    }
  }
  if (out.length) ch.hp = Math.min(ch.hp, maxHp(ctx))
  return out
}

// 회복 계수: 나이 구간 값(balance.aging.recovery_coef), recovery_coef 수정자(set)가 있으면 그것
export function recoveryCoef(ctx: RuleContext): number {
  const ch = characterOf(ctx)
  const age = ageAt(ch.eff_min, ctx.content.balance.time)
  const table = [...ctx.content.balance.aging.recovery_coef].sort((a, b) => a.from_age - b.from_age)
  const base = table.filter((r) => r.from_age <= age).pop()?.value ?? table[0]!.value
  return modValue(ctx, 'recovery_coef', base)
}
