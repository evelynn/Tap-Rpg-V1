// 출생(05 §2, 06 §6): 선천 특성 신규 추첨과 출생 능력치 분배. 난수는 life 흐름을 넘긴다.
import type { Content } from '../content/index'
import { STATS } from '../schema/index'
import type { Stat } from './derived'
import { weightedPick, type Rng } from './random'

// 부정 특성: subkind negative(06 §6.4 금지 조합 판단)
function isNegative(content: Content, id: string): boolean {
  return content.get('trait', id).subkind === 'negative'
}

function conflicts(content: Content, id: string, owned: readonly string[]): boolean {
  const ex = content.get('trait', id).exclusive_with ?? []
  return owned.some((o) => ex.includes(o) || (content.get('trait', o).exclusive_with ?? []).includes(id))
}

function drawOne(content: Content, rng: Rng, owned: readonly string[], allowNegative: boolean): string | null {
  const pool = content
    .list('trait')
    .filter((t) => t.kind === 'innate' && (t.birth_weight ?? 0) > 0 && !owned.includes(t.id))
    .filter((t) => allowNegative || t.subkind !== 'negative')
  const max = content.balance.inheritance.innate_reroll_max
  for (let i = 0; i < max && pool.length; i++) {
    const t = pool[weightedPick(rng, pool.map((p) => p.birth_weight ?? 0))]!
    if (!conflicts(content, t.id, owned)) return t.id
  }
  return null
}

// 06 §6.1 2~4단계: 유전분 개수로 신규 개수를 뽑고(6.2), 가중치로 추첨(6.3), 금지 조합(6.4).
// owned = 이미 정해진 선천 특성(유전분). 새로 뽑은 id만 돌려준다
export function drawNewInnateTraits(content: Content, rng: Rng, owned: readonly string[]): string[] {
  const inh = content.balance.inheritance
  const table = inh.new_innate_count[String(owned.length)]
  if (!table) throw new Error(`inheritance.new_innate_count에 유전분 ${owned.length} 행이 없다`)
  const counts = Object.keys(table).sort((a, b) => Number(a) - Number(b))
  const n = Number(counts[weightedPick(rng, counts.map((k) => table[k]!))])
  const cap = content.balance.stats.trait_caps.innate
  const all = [...owned]
  for (let i = 0; i < n && all.length < cap; i++) {
    // 선천 부정 특성은 2개 이상 가질 수 없다
    const id = drawOne(content, rng, all, !all.some((t) => isNegative(content, t)))
    if (id) all.push(id) // 재추첨 한도를 넘으면 신규 1개 감소
  }
  // 부정 특성 1개뿐이면 부정이 아닌 신규 1개를 더한다
  if (all.length === 1 && isNegative(content, all[0]!) && all.length < cap) {
    const id = drawOne(content, rng, all, false)
    if (id) all.push(id)
  }
  return all.slice(owned.length)
}

export interface BirthStatInput {
  traits: readonly string[] // 선천 특성
  background: string
  parentBest?: readonly Stat[] // 직계 자녀: 이전 인물의 최고 능력치(동률이면 모두)
}

// 05 §2.2 분배 가중치(STATS 순서)
export function birthStatWeights(content: Content, input: BirthStatInput): number[] {
  const g = content.balance.growth
  const w = STATS.map((s) => (s === 'luk' ? g.birth_weights.luk : g.birth_weights.base))
  for (const id of input.traits) {
    for (const s of content.get('trait', id).birth_stat_weights ?? []) w[STATS.indexOf(s)]! += g.trait_birth_add
  }
  for (const s of input.parentBest ?? []) w[STATS.indexOf(s)]! += g.parent_best_add
  return w
}

// 모두 birth_base에서 시작, 배경 능력치 1점 고정(없으면 전부 추첨), 나머지는 값 < birth_cap 후보에서 가중 추첨
export function rollBirthStats(content: Content, rng: Rng, input: BirthStatInput): Record<Stat, number> {
  const st = content.balance.stats
  const values = Object.fromEntries(STATS.map((s) => [s, st.birth_base])) as Record<Stat, number>
  let points = st.birth_points
  const fixed = content.get('background', input.background).fixed_stat
  if (fixed) {
    values[fixed] += 1
    points -= 1
  }
  const weights = birthStatWeights(content, input)
  for (let i = 0; i < points; i++) {
    const w = STATS.map((s, j) => (values[s] < st.birth_cap ? weights[j]! : 0))
    if (w.every((x) => x === 0)) break
    values[STATS[weightedPick(rng, w)]!] += 1
  }
  return values
}
