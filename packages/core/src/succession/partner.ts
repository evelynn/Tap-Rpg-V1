// 가정 형성 S01의 동반자(12 §2.1). 동반자는 NPC이고 모험에 나가지 않지만, 자녀 유전의 다른 한 출처다.
//
// 저장 자리: 16 §5.3에 동반자 칸이 없어 family.bonds를 빌린다(12 §7.3 "인연 기록은 NPC와 가문 인물의
// 동반자들을 보여준다"). npc_id는 NPC 정의가 아니라 자리표 'partner'이고, text에 값을 담는다.
// 저장 스키마에 family.partners가 생기면 그쪽으로 옮긴다(I44와 같은 취급).
import type { Content } from '../content/index'
import type { Rng } from '../rules/random'
import type { Family } from '../state/family'
import type { SaveBody } from '../state/save'
import { drawInnateTraits } from './traits'

export const PARTNER_BOND = 'partner'

export interface Partner {
  gen: number
  name: string
  job: string
  traits: string[] // 선천 특성 1~2개
  hair_color: string
}

export function writePartner(family: Family, p: Partner): void {
  family.bonds = family.bonds.filter((b) => !(b.npc_id === PARTNER_BOND && b.gen === p.gen))
  family.bonds.push({ npc_id: PARTNER_BOND, gen: p.gen, key: p.name, text: JSON.stringify(p) })
}

export function readPartner(family: Family, gen: number): Partner | null {
  const row = family.bonds.find((b) => b.npc_id === PARTNER_BOND && b.gen === gen)
  if (!row) return null
  try {
    return JSON.parse(row.text) as Partner
  } catch {
    return null
  }
}

// 가문 안에서 이미 쓴 이름(인물·후보·동반자)
export function usedNames(state: SaveBody): Set<string> {
  const used = new Set<string>()
  if (state.character) used.add(state.character.name)
  for (const r of state.family.chronicle) used.add(r.name)
  for (const c of Object.values(state.family.candidates)) used.add(c.name)
  for (const b of state.family.bonds) if (b.npc_id === PARTNER_BOND) used.add(b.key)
  return used
}

export function pickName(content: Content, rng: Rng, used: ReadonlySet<string>): string {
  const names = content.list('name_pool').flatMap((p) => p.given_names).filter((n) => !used.has(n))
  if (!names.length) throw new Error('쓸 수 있는 이름이 없다(name_pool)')
  return names[rng.bounded(names.length)]!
}

// 12 §2.1 동반자 생성: 이름 → 직업 → 선천 특성(1개 70% / 2개 30%) → 머리색. 난수는 life 흐름(I07)
export function createPartner(content: Content, rng: Rng, state: SaveBody, hairColors: readonly string[]): Partner {
  const inh = content.balance.inheritance
  const gen = state.family.generation
  const name = pickName(content, rng, usedNames(state))
  const jobs = content.list('name_pool').flatMap((p) => p.partner_jobs ?? [])
  const job = jobs.length ? jobs[rng.bounded(jobs.length)]! : ''
  const counts = Object.keys(inh.partner_trait_count).sort((a, b) => Number(a) - Number(b))
  const n = Number(counts[rng.weightedIndex(counts.map((k) => inh.partner_trait_count[k]!))])
  const traits = drawInnateTraits(content, rng, [], n, true)
  const hair_color = hairColors.length ? hairColors[rng.bounded(hairColors.length)]! : ''
  return { gen, name, job, traits, hair_color }
}
