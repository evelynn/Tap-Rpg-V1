// 선천 특성 유전(12 §3.2·§3.3). 신규 추첨은 rules/birth의 drawNewInnateTraits가 단일 출처이고,
// 여기서는 출처별 유전 굴림과, 개수를 지정해 뽑는 추첨(동반자·형제자매)만 더한다.
import type { Content } from '../content/index'
import { drawNewInnateTraits } from '../rules/birth'
import { weightedPick, type Rng } from '../rules/random'
import type { Character } from '../state/character'

export type TraitSource = 'parent' | 'other_parent' | 'new'

// 부정 유전 특성(12 §3.2 "부정 18%"): inherit_class가 단일 출처이고, 없으면 subkind로 본다
export function isNegativeTrait(content: Content, id: string): boolean {
  const t = content.get('trait', id)
  return (t.inherit_class ?? (t.subkind === 'negative' ? 'negative' : 'positive')) === 'negative'
}

// 출생 기록의 선천 특성(12 §3.2: 활성 목록에서 빠진 것도 대상). 후천·변이는 대상이 아니다
export function innateOfRecord(content: Content, ch: Pick<Character, 'traits'>): string[] {
  return ch.traits.filter((t) => content.get('trait', t.id).kind === 'innate').map((t) => t.id)
}

// 개수를 정해 선천 특성을 뽑는다(06 §6.3 가중치, 금지 조합 검사). 동반자·형제자매 배우자가 쓴다
export function drawInnateTraits(content: Content, rng: Rng, owned: readonly string[], count: number, allowNegative: boolean): string[] {
  const max = content.balance.inheritance.innate_reroll_max
  const all = [...owned]
  const drawn: string[] = []
  for (let i = 0; i < count; i++) {
    const pool = content
      .list('trait')
      .filter((t) => t.kind === 'innate' && (t.birth_weight ?? 0) > 0 && !all.includes(t.id))
      .filter((t) => allowNegative || !isNegativeTrait(content, t.id))
    let got: string | null = null
    for (let k = 0; k < max && pool.length; k++) {
      const t = pool[weightedPick(rng, pool.map((p) => p.birth_weight ?? 0))]!
      const ex = content.get('trait', t.id).exclusive_with ?? []
      const clash = all.some((o) => ex.includes(o) || (content.get('trait', o).exclusive_with ?? []).includes(t.id))
      if (!clash) {
        got = t.id
        break
      }
    }
    if (got) {
      all.push(got)
      drawn.push(got)
    }
  }
  return drawn
}

export interface InheritInput {
  parent: readonly string[] // 이전 인물의 출생 기록 선천 특성
  otherParent: readonly string[] // 동반자(방계면 형제자매의 배우자)
}

export interface InheritedTrait {
  id: string
  from: TraitSource
}

// 12 §3.2: 출처마다 특성별로 굴려 성공한 것 중 하나를 채택(출처당 최대 1개), 중복은 합친다.
// 확률은 balance.inheritance.trait_inherit, 상한은 max(전체) / from_parent_max(출처당)
export function inheritTraits(content: Content, rng: Rng, input: InheritInput): InheritedTrait[] {
  const ti = content.balance.inheritance.trait_inherit
  const out: InheritedTrait[] = []
  const sources: [TraitSource, readonly string[]][] = [['parent', input.parent], ['other_parent', input.otherParent]]
  for (const [from, list] of sources) {
    const hit: string[] = []
    for (const id of list) {
      const p = isNegativeTrait(content, id) ? ti.chance_negative : ti.chance_positive
      if (rng.chance(p)) hit.push(id)
    }
    if (!hit.length) continue
    const taken = hit.length === 1 ? hit[0]! : hit[rng.bounded(hit.length)]!
    // 채택 상한은 출처당 1개다(12 §3.2). 같은 특성이면 하나로 합친다
    if (!out.some((t) => t.id === taken)) out.push({ id: taken, from })
  }
  return out.slice(0, ti.max)
}

// 유전분 + 신규 추첨(06 §6.2·§6.3·§6.4). 신규는 출처 new다
export function fullTraitSet(content: Content, rng: Rng, inherited: readonly InheritedTrait[]): InheritedTrait[] {
  const owned = inherited.map((t) => t.id)
  const fresh = drawNewInnateTraits(content, rng, owned)
  return [...inherited, ...fresh.map((id) => ({ id, from: 'new' as const }))]
}
