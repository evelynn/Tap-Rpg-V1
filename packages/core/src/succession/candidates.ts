// 후계 후보 생성(12 §2.2·§3). 직계 자녀는 S02마다, 방계·입양은 생애 종료 1단계에 만든다.
// 후보는 만들 때 값을 모두 확정해 저장한다(12 §10 악용 방지: 계승 화면을 다시 열어도 바뀌지 않는다).
import type { Content } from '../content/index'
import { Pcg32, sha256, utf8 } from '../rng/index'
import { rollBirthStats } from '../rules/birth'
import { characterOf, type RuleContext } from '../rules/context'
import { STAT_LABELS } from '../rules/labels'
import type { Stat } from '../rules/derived'
import type { Rng } from '../rules/random'
import { STATS } from '../schema/index'
import type { Appearance, Character } from '../state/character'
import type { Candidate, Family } from '../state/family'
import type { SaveBody } from '../state/save'
import { issueUid } from '../state/uid'
import { createPartner, pickName, readPartner, usedNames, writePartner, type Partner } from './partner'
import { drawInnateTraits, fullTraitSet, inheritTraits, innateOfRecord, type InheritedTrait } from './traits'

// 후보의 능력치 분배 난수(12 §2.2 "능력치 분배 난수가 정해진다").
// 저장에 후보별 시드 칸이 없어 가문 시드와 후보 uid로 유도한다. 같은 배경을 고르면 늘 같은 값이 나온다(I07 확장)
export function candidateRng(familySeed: string, uid: string): Pcg32 {
  const h = sha256(utf8(`${familySeed}:life:${uid}`))
  const u64 = (o: number) => {
    let v = 0n
    for (let i = o; i < o + 8; i++) v = (v << 8n) | BigInt(h[i]!)
    return v
  }
  return Pcg32.seed(u64(0), u64(8))
}

// 이전 인물의 최고 능력치(동률이면 모두). 직계 자녀의 부모 닮음 가중(05 §2.2)
export function parentBestStats(ch: Pick<Character, 'stats'>): Stat[] {
  const max = Math.max(...STATS.map((s) => ch.stats[s]))
  return STATS.filter((s) => ch.stats[s] === max)
}

// 후보의 출생 능력치. 배경을 바꾸면 그 배경 기준으로 다시 계산한다(12 §3.4)
export function candidateStats(
  content: Content,
  familySeed: string,
  cand: Pick<Candidate, 'uid' | 'traits' | 'relation'>,
  background: string,
  parentBest: readonly Stat[],
): Record<Stat, number> {
  return rollBirthStats(content, candidateRng(familySeed, cand.uid), {
    traits: cand.traits.map((t) => t.id),
    background,
    // 부모 닮음 가중은 직계만(12 §3.4)
    ...(cand.relation === 'direct' ? { parentBest } : {}),
  })
}

// ── 외형(12 §3.5) ──

export interface AppearancePools {
  body: string[]
  hair: string[]
  hair_color: string[]
  skin_tone: string[]
}

// 무작위 후보: 가문 인물이 쓴 값과 해금 외형(12 §8.2 "이전 인물들의 머리 모양·머리색은 자동 해금").
// 15 문서의 머리 모양 6종·팔레트가 콘텐츠 종류로 없어 가문이 가진 값에서 고른다
export function appearancePools(state: SaveBody): AppearancePools {
  const seen: AppearancePools = { body: [], hair: [], hair_color: [], skin_tone: [] }
  const add = (a: Appearance) => {
    for (const k of ['body', 'hair', 'hair_color', 'skin_tone'] as const) if (a[k] && !seen[k].includes(a[k])) seen[k].push(a[k])
  }
  if (state.character) add(state.character.appearance)
  for (const c of Object.values(state.family.candidates)) add(c.appearance)
  for (const id of state.family.unlocks.appearances) if (!seen.hair.includes(id)) seen.hair.push(id)
  return seen
}

type AppearanceOrigin = 'parent' | 'partner' | 'random'

function pickOrigin(rng: Rng, table: Partial<Record<AppearanceOrigin, number>>): AppearanceOrigin {
  const keys: AppearanceOrigin[] = ['parent', 'partner', 'random']
  return keys[rng.weightedIndex(keys.map((k) => table[k] ?? 0))]!
}

function pickFrom(rng: Rng, pool: readonly string[], fallback: string): string {
  return pool.length ? pool[rng.bounded(pool.length)]! : fallback
}

// 12 §3.5 표: 직계는 머리색 50/35/15, 방계는 25/75, 입양은 무작위. 머리 모양은 무작위다.
// 눈 모양은 저장 스키마(appearance)에 칸이 없어 적용하지 않는다(T11 후보)
export function childAppearance(
  content: Content,
  rng: Rng,
  relation: Candidate['relation'],
  parent: Appearance,
  partner: Partner | null,
  pools: AppearancePools,
): Appearance {
  const app = content.balance.inheritance.appearance
  const table = relation === 'direct' ? app.direct.hair : relation === 'collateral' ? app.collateral.hair : { random: 1 }
  const origin = pickOrigin(rng, table)
  const hair_color =
    origin === 'parent' ? parent.hair_color
    : origin === 'partner' ? (partner?.hair_color || parent.hair_color)
    : pickFrom(rng, pools.hair_color, parent.hair_color)
  return {
    body: parent.body,
    hair: pickFrom(rng, pools.hair, parent.hair),
    hair_color,
    skin_tone: pickFrom(rng, pools.skin_tone, parent.skin_tone),
    decor: [],
    age_stage_override: null,
  }
}

// ── 가족 호칭(12 §3.5) ──

// 후계자가 이전 인물을 부르는 호칭. 직계는 추첨, 방계는 그 호칭의 collateral, 입양은 스승님 또는 같은 호칭
export function parentCall(content: Content, rng: Rng, relation: Candidate['relation']): string {
  const pc = content.balance.inheritance.parent_call
  const opt = pc.options[rng.weightedIndex(pc.options.map((o) => o.weight))]!
  if (relation === 'collateral') return opt.collateral
  if (relation === 'adopted') return rng.chance(pc.adopted.chance) ? pc.adopted.text : opt.text
  return opt.text
}

// ── 후보 만들기 ──

function episodes(content: Content, traits: readonly InheritedTrait[], stats: Record<Stat, number>): string[] {
  const best = parentBestStats({ stats })
  const out = best.map((s) => `${STAT_LABELS[s]}이 눈에 띈다`)
  for (const t of traits) {
    const def = content.get('trait', t.id)
    out.push(def.short_name ?? def.name)
  }
  return out
}

// S02 자녀 후보 1명(12 §2.2·§3.2). 난수 순서: 유전 굴림 → 신규 특성 → 외형
export function createChildCandidate(ctx: RuleContext, rng: Rng): Candidate {
  const { content, state } = ctx
  const ch = characterOf(ctx)
  const partner = readPartner(state.family, ch.generation)
  const inherited = inheritTraits(content, rng, {
    parent: innateOfRecord(content, ch),
    otherParent: partner?.traits ?? [],
  })
  const traits = fullTraitSet(content, rng, inherited)
  const uid = issueUid(state.family, 'ch')
  const appearance = childAppearance(content, rng, 'direct', ch.appearance, partner, appearancePools(state))
  const name = pickName(content, rng, usedNames(state))
  const cand: Candidate = {
    uid,
    name,
    relation: 'direct',
    created_at_parent_age: Math.floor(ch.eff_min / content.balance.time.min_per_year) + content.balance.time.start_age,
    birth_stats: candidateStats(content, state.family.family_seed, { uid, traits, relation: 'direct' }, defaultBackground(content), parentBestStats(ch)),
    traits,
    appearance,
    episodes: [],
    is_default: ch.children.length === 0,
  }
  cand.episodes = episodes(content, traits, cand.birth_stats)
  state.family.candidates[uid] = cand
  ch.children.push(uid)
  return cand
}

// 처음부터 해금된 배경(여울의 아이). 후보 카드의 기준 배경이다(12 §3.7)
export function defaultBackground(content: Content): string {
  const bg = content.list('background').find((b) => b.unlock === null)
  if (!bg) throw new Error('처음부터 해금된 출신 배경이 없다')
  return bg.id
}

// 12 §3.3 방계: 형제자매 NPC → 그 배우자 → 조카. 형제자매는 이전 인물의 부모 출처 특성을 각 50% 공유 + 신규 1개
function collateralParents(content: Content, rng: Rng, ch: Character): { sibling: string[]; spouse: string[] } {
  const share = content.balance.inheritance.sibling_trait_share
  const fromParents = ch.traits
    .filter((t) => (t.source === 'parent' || t.source === 'other_parent') && content.get('trait', t.id).kind === 'innate')
    .map((t) => t.id)
  const sibling = fromParents.filter(() => rng.chance(share))
  sibling.push(...drawInnateTraits(content, rng, sibling, 1, true))
  const spouse = drawInnateTraits(content, rng, [], 1, true)
  return { sibling, spouse }
}

// 생애 종료 1단계: 직계가 없을 때 방계 → 입양 순서로 후보를 만든다(12 §2.3·§3.1)
export function createFallbackCandidates(ctx: RuleContext, rng: Rng): Candidate[] {
  const { content, state } = ctx
  const ch = characterOf(ctx)
  const inh = content.balance.inheritance
  const countOf = (table: Record<string, number>) => {
    const keys = Object.keys(table).sort((a, b) => Number(a) - Number(b))
    return Number(keys[rng.weightedIndex(keys.map((k) => table[k]!))])
  }
  const noSibling = rng.chance(inh.collateral.no_sibling_chance)
  const relation: Candidate['relation'] = noSibling ? 'adopted' : 'collateral'
  const n = noSibling ? countOf(inh.adoption.count_weights) : countOf(inh.collateral.count_weights)
  const pools = appearancePools(state)
  const out: Candidate[] = []
  for (let i = 0; i < n; i++) {
    const src = relation === 'collateral' ? collateralParents(content, rng, ch) : { sibling: [], spouse: [] }
    const inherited = relation === 'collateral'
      ? inheritTraits(content, rng, { parent: src.sibling, otherParent: src.spouse })
      : []
    const traits = fullTraitSet(content, rng, inherited)
    const uid = issueUid(state.family, 'ch')
    const cand: Candidate = {
      uid,
      name: pickName(content, rng, usedNames(state)),
      relation,
      created_at_parent_age: Math.floor(ch.eff_min / content.balance.time.min_per_year) + content.balance.time.start_age,
      birth_stats: candidateStats(content, state.family.family_seed, { uid, traits, relation }, defaultBackground(content), []),
      traits,
      appearance: childAppearance(content, rng, relation, ch.appearance, null, pools),
      episodes: [],
      is_default: i === 0,
    }
    cand.episodes = episodes(content, traits, cand.birth_stats)
    state.family.candidates[uid] = cand
    out.push(cand)
  }
  return out
}

// 후보층(12 §3.1): 직계가 한 명이라도 있으면 아래 층은 제시하지 않는다
export function heirCandidates(family: Family, ch: Pick<Character, 'children'>): Candidate[] {
  const direct = ch.children.map((u) => family.candidates[u]).filter((c): c is Candidate => c !== undefined)
  if (direct.length) return direct
  return Object.values(family.candidates).filter((c) => c.relation !== 'direct')
}

// 기본 후보(12 §4.2): 생전 지정 → 첫째(또는 후보 목록의 첫 번째). 특성 점수로 고르지 않는다
export function defaultHeir(family: Family, ch: Pick<Character, 'children' | 'heir_preferred'>): Candidate | null {
  const list = heirCandidates(family, ch)
  if (!list.length) return null
  return list.find((c) => c.uid === ch.heir_preferred) ?? list.find((c) => c.is_default) ?? list[0]!
}

// 12 §2.1 S01: 동반자를 만들어 가문에 남긴다
export function makePartner(ctx: RuleContext, rng: Rng): Partner {
  const { content, state } = ctx
  const p = createPartner(content, rng, state, appearancePools(state).hair_color)
  writePartner(state.family, p)
  return p
}

// 12 §3.6 이름 추천 3개(5대 안의 가문 인물 이름과 최근 두 세대 동반자 이름 제외, 02 §9.1)
export function suggestNames(ctx: RuleContext, rng: Rng, count = 3): string[] {
  const used = usedNames(ctx.state)
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const name = pickName(ctx.content, rng, new Set([...used, ...out]))
    out.push(name)
  }
  return out
}
