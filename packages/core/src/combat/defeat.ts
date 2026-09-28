// 패배와 사망(07 §8, 01 §6.3, 08 R01·R03, 09 §5). resolveDefeat가 난수를 굴려 확정하고 applyDefeat가 상태를 바꾼다.
// 흐름: 구조자·부상 판정·최후 판정 = combat, 부상 능력치 = life, 손실할 재료·장비 선택 = loot(I07).
import type { Rng } from '../rules/random'
import { characterOf, type RuleContext } from '../rules/context'
import { checkDc, miracleReroll, recordCheckUse, rollCheck, type CheckRoll } from '../rules/check'
import { addJournal } from '../journal/index'
import { consumeArmed, finalSaveJournal, isArmed, miracleJournal, mitigateJournal, noviceGuardActive } from '../blessing/index'
import { maxHp, type Stat } from '../rules/derived'
import type { RankUp } from '../rules/growth'
import { collectModSources, modValue } from '../rules/modifiers'
import type { CheckRecord } from '../state/journal'
import { renderTemplate } from '../text/index'
import { ageAt } from '../time/index'
import { addInjury, injuryGradeOf, injuryStat, rollInjuryCheck, type InjuryAdded, type InjuryCause, type InjuryGrade } from '../recovery/injury'
import { chargesLeft, useCharge } from '../recovery/rest'
import { retreatHpRatio } from './combat'
import { COMBAT_CHECKS, type RoundRecord } from './types'
import { SLOTS } from '../schema/index'
import { dropItemRefs } from '../items/bag'

// 치명 활동의 사망 기록 문맥(07 §8.3). 출정·위험 계산은 활동 쪽이 넘긴다
export interface LethalContext {
  source: string // 치명 표식을 붙인 대상(관문 적 id 등)
  activity: string // 사냥 / 던전 / 모험 / 사건
  step: string | null // 방·장면 순번 또는 관문
  risk_diff: number
  risk_grade: string
  gate_level: number // 제안 규칙 effective_level_below_gate
  effective_level: number // 01 §7.2
  potions_at_start: number
  hp_start_ratio: number
  injuries_at_start: { grade: InjuryGrade; stat: Stat }[]
  decisive: RoundRecord[] // decisiveRounds(전투.rounds)
}

export interface DefeatSpec {
  regionId: string // 구조자 표·부상 DC(level_mid)·사망 장소
  regionLevel?: number // 부상 DC 지역 레벨(없으면 장소 level_mid)
  cause?: InjuryCause // 부상 능력치(기본 combat)
  lethal?: LethalContext | null // 치명 활동이면 최후 판정
}

export interface DeathRecord {
  name: string
  generation: number
  age: number
  level: number
  location: string
  step: string | null
  activity: string
  lethal_source: string
  risk: { diff: number; grade: string }
  policy: { attitude: string; lethal_allowed: boolean; retreat_hp: number }
  start: { hp_ratio: number; potions: number; injuries: { grade: InjuryGrade; stat: Stat }[] }
  serious_total: number
  injuries: { grade: InjuryGrade; stat: Stat }[]
  decisive: RoundRecord[]
  final_check: CheckRecord
  suggestions: string[]
}

export interface DefeatResult {
  outcome: 'rescued' | 'escaped' | 'died' // 일반 구조 / 치명 탈출(방울·최후 판정 성공) / 사망
  charm_uid: string | null // 탈출 충전(R01 escape_on_defeat)을 쓴 장비
  rescuer: { id: string; line: string } | null
  check: CheckRoll | null // 부상 판정 또는 최후 판정
  injury: { grade: InjuryGrade; stat: Stat } | null
  losses: { coins: number; materials: Record<string, number>; items: string[] }
  used_items: string[] // 최후 판정 가산(final_check_add)을 준 1회용 장비(R03)
  arrive_hp: number
  return_travel_mult: number
  death: DeathRecord | null
  place: string
  blessing: 'final_save' | 'first_step' | 'mitigate' | null // 발동한 가호(04 §10.3). 소비는 applyDefeat
}

export function resolveDefeat(world: RuleContext & { rng: { combat: Rng; life: Rng; loot: Rng } }, spec: DefeatSpec): DefeatResult {
  const { content, state } = world
  const d = content.balance.defeat
  const ch = characterOf(world)
  const sources = collectModSources(world)
  const region = content.get('region', spec.regionId)
  const regionLevel = spec.regionLevel ?? ('level_mid' in region ? region.level_mid : ch.level)
  const charm = chargesLeft(world, 'escape_on_defeat')[0] ?? null
  const out: DefeatResult = {
    outcome: 'rescued', charm_uid: charm?.uid ?? null, rescuer: null, check: null, injury: null,
    losses: { coins: 0, materials: {}, items: [] }, used_items: [],
    arrive_hp: Math.max(1, Math.floor(maxHp(world, sources) * d.arrive_hp_ratio)), return_travel_mult: d.return_travel_mult, death: null,
    place: spec.regionId, blessing: null,
  }
  let lossless = false

  if (spec.lethal) {
    out.outcome = 'escaped'
    if (charm) out.injury = { grade: 'serious', stat: injuryStat(world.rng.life, spec.cause ?? 'combat') }
    else {
      // 최후 판정 d20 + 의지 + ⌊행운/2⌋ + 기타(final_check_add 포함) ≥ 15(05 §6.1)
      out.check = rollFinalCheck(world, world.rng.combat)
      out.used_items = finalCheckItems(world)
      if (out.check.result === 'success' || out.check.result === 'crit_success') {
        out.injury = { grade: 'serious', stat: injuryStat(world.rng.life, spec.cause ?? 'combat') }
      } else if (isArmed(world, 'final_save') && !ch.blessing.final_used) {
        // 걸어 둔 가호 `최후의 순간을 지킨다`: 실패를 성공으로(01 §6.3, 04 §10.3 5번). 방울·판정이 먼저 막으면 여기 오지 않는다
        out.blessing = 'final_save'
        out.injury = { grade: 'serious', stat: injuryStat(world.rng.life, spec.cause ?? 'combat') }
      } else {
        out.outcome = 'died'
        out.death = deathRecord(world, spec.regionId, spec.lethal, out.check.record)
        return out
      }
    }
    lossless = charm !== null // 방울 탈출은 손실 없음(08 R01)
  } else {
    // 일반 패배: 방울이 있으면 손실 없이 탈출하고 부상 판정 +5(08 §3.5 R01). 수치는 balance.defeat.escape_injury_add
    lossless = charm !== null
    const add = charm && d.escape_injury_add !== undefined
      ? [{ target: `check.${COMBAT_CHECKS.injury}`, op: 'add' as const, value: d.escape_injury_add }]
      : []
    out.check = rollInjuryCheck(world, world.rng.combat, regionLevel, add)
    if (content.balance.blessing.miracle_checks.includes(COMBAT_CHECKS.injury)) out.check = miracleReroll(world, world.rng.combat, out.check)
    out.injury = { grade: injuryGradeOf(out.check), stat: injuryStat(world.rng.life, spec.cause ?? 'combat') }
    // 첫걸음의 보호(중상일 때만) → 궂은일을 누그러뜨린다(04 §10.3 7번): 손실 없음 + 중상은 경상
    if (out.injury.grade === 'serious' && noviceGuardActive(world)) out.blessing = 'first_step'
    else if (isArmed(world, 'mitigate')) out.blessing = 'mitigate'
    if (out.blessing) {
      lossless = true
      out.injury = { ...out.injury, grade: 'light' }
    }
  }
  out.rescuer = pickRescuer(world, world.rng.combat, 'rescuers' in region ? region.rescuers : null)
  if (!lossless) out.losses = defeatLosses(world, world.rng.loot)
  return out
}

// 최후 판정(05 §6.1 final): 선택 판정 종류의 luck_div가 ⌊행운/2⌋, final_check_add는 기타 보정
export function rollFinalCheck(ctx: RuleContext, rng: Rng): CheckRoll {
  const dc = checkDc(ctx, COMBAT_CHECKS.final, {})
  return rollCheck(ctx, rng, { kinds: [COMBAT_CHECKS.final], dc, extraTargets: ['final_check_add'] })
}

// 최후 판정 가산을 주는 장착 1회용 장비(charges_total을 가진 장비). 판정에 쓰면 빈 병이 된다(08 R03)
function finalCheckItems(ctx: RuleContext): string[] {
  const out: string[] = []
  for (const slot of SLOTS) {
    const uid = ctx.state.inventory.equipped[slot]
    const inst = uid ? ctx.state.item_instances[uid] : undefined
    if (!inst || inst.used) continue
    const mods = ctx.content.get('item', inst.def_id).modifiers ?? []
    if (mods.some((m) => m.target === 'final_check_add') && mods.some((m) => m.op === 'charges_total')) out.push(inst.uid)
  }
  return out
}

// 구조자(07 §8.1): rescuer_override 수정자가 있으면 그 문장, 아니면 장소의 구조자 표에서 가중 추첨
export function pickRescuer(ctx: RuleContext, rng: Rng, table: string | null): { id: string; line: string } | null {
  const d = ctx.content.balance.defeat
  const override = collectModSources(ctx).flatMap((s) => s.modifiers).filter((m) => m.target === 'rescuer_override' && m.op === 'set').pop()
  if (override && typeof override.value === 'string') return { id: override.value, line: d.rescuer_lines[override.value] ?? '' }
  const rows = table ? d.rescuers[table] : undefined
  if (!rows) return null
  const r = rows[rng.weightedIndex(rows.map((x) => x.weight))]!
  return { id: r.id, line: r.line }
}

// 손실(07 §8.1): 이번 출정 동전 × 50%(내림, defeat_loss_mult), 재료 절반(올림, 무작위 개수 단위),
// 이번 출정 장비 중 무작위 1개(고유·장착 제외, defeat_item_loss_chance가 있으면 그 확률로만)
export function defeatLosses(ctx: RuleContext, rng: Rng): DefeatResult['losses'] {
  const d = ctx.content.balance.defeat
  const loot = ctx.state.current_activity.sortie?.loot
  const out: DefeatResult['losses'] = { coins: 0, materials: {}, items: [] }
  if (!loot) return out
  const sources = collectModSources(ctx)
  out.coins = Math.floor(loot.coins * d.coin_loss_ratio * modValue(ctx, 'defeat_loss_mult', 1, sources) + 1e-9)
  const units = Object.keys(loot.materials).sort().flatMap((id) => Array<string>(loot.materials[id] ?? 0).fill(id))
  for (let n = Math.ceil(units.length * d.material_loss_ratio - 1e-9); n > 0 && units.length; n--) {
    const id = units.splice(rng.bounded(units.length), 1)[0]!
    out.materials[id] = (out.materials[id] ?? 0) + 1
  }
  const equipped = new Set(Object.values(ctx.state.inventory.equipped))
  const pool = loot.item_uids.filter((uid) => {
    const inst = ctx.state.item_instances[uid]
    return inst && !equipped.has(uid) && !ctx.content.get('item', inst.def_id).unique
  })
  const p = modValue(ctx, 'defeat_item_loss_chance', 1, sources)
  for (let n = d.item_loss_count; n > 0 && pool.length; n--) {
    if (p < 1 && !rng.chance(p)) break
    out.items.push(pool.splice(rng.bounded(pool.length), 1)[0]!)
  }
  return out
}

// 사망 원인 기록(07 §8.3)과 다음 세대 제안(balance.defeat.death_suggestions + 장소 gate.lines)
function deathRecord(ctx: RuleContext, regionId: string, lc: LethalContext, final: CheckRecord): DeathRecord {
  const { content, state } = ctx
  const ch = characterOf(ctx)
  const serious = ch.counters.serious_injuries ?? 0
  return {
    name: ch.name, generation: ch.generation, age: ageAt(ch.eff_min, content.balance.time), level: ch.level,
    location: regionId, step: lc.step, activity: lc.activity, lethal_source: lc.source,
    risk: { diff: lc.risk_diff, grade: lc.risk_grade },
    policy: {
      attitude: state.policies.attitude,
      lethal_allowed: state.policies.lethal_allowed,
      retreat_hp: retreatHpRatio(ctx),
    },
    start: { hp_ratio: lc.hp_start_ratio, potions: lc.potions_at_start, injuries: lc.injuries_at_start },
    serious_total: serious,
    injuries: ch.injuries.map((i) => ({ grade: i.grade, stat: i.stat })),
    decisive: lc.decisive,
    final_check: final,
    suggestions: deathSuggestions(ctx, regionId, lc),
  }
}

export function deathSuggestions(ctx: RuleContext, regionId: string, lc: Pick<LethalContext, 'gate_level' | 'effective_level' | 'potions_at_start'>): string[] {
  const { content, state } = ctx
  const ch = characterOf(ctx)
  const ds = content.balance.defeat.death_suggestions
  const tierOf = (level: number) => content.balance.economy.tier_levels.findIndex(([lo, hi]) => level >= lo && level <= hi) + 1
  const armorUid = state.inventory.equipped.armor
  const armorTier = armorUid ? content.get('item', state.item_instances[armorUid]!.def_id).tier : 0
  const hit = (r: (typeof ds.rules)[number]): boolean => {
    switch (r.ctx) {
      case 'armor_tier_below_level_tier': return armorTier < tierOf(ch.level)
      case 'effective_level_below_gate': return lc.effective_level < lc.gate_level - r.value
      case 'potions_at_start_lte': return lc.potions_at_start <= r.value
      case 'serious_injuries_gte': return (ch.counters.serious_injuries ?? 0) >= r.value
    }
  }
  const region = content.get('region', regionId)
  const lines = 'gate' in region ? region.gate?.lines : undefined
  const texts = ds.rules.filter(hit).map((r) => r.text)
  if (state.policies.lethal_allowed && lines?.suggest_lethal_off) texts.push(lines.suggest_lethal_off)
  if (!texts.length && lines?.suggest_default) texts.push(lines.suggest_default)
  return texts.slice(0, ds.max).map((t) => renderTemplate(t, { name: ch.name }))
}

// 패배 적용: 부상(합치기·중상 누적), 판정 성장 누적(의지 +1), 손실, 도착 체력, 충전·1회용 장비, 패배 카운터.
// 사망이면 부상·체력을 건드리지 않고 기록만 남긴다(인물 정리는 생애 종료 쪽)
export function applyDefeat(ctx: RuleContext, r: DefeatResult): { injury: InjuryAdded | null; rankUps: RankUp[] } {
  const { content, state } = ctx
  const ch = characterOf(ctx)
  const rankUps = r.check ? recordCheckUse(ctx, r.check, { statPoints: content.balance.growth.use_points.injury_or_final }) : []
  // 가호 발동(04 §10.3): 걸어 둔 가호를 쓰고 인물이 모르는 흔적을 남긴다
  const reroll = r.check?.record.reroll
  if (reroll && consumeArmed(ctx, 'miracle')) addJournal(ctx, miracleJournal(ctx, reroll.first, reroll.second))
  if (r.blessing === 'final_save' && consumeArmed(ctx, 'final_save')) addJournal(ctx, finalSaveJournal(ctx, r.place))
  if (r.blessing === 'mitigate' && consumeArmed(ctx, 'mitigate')) addJournal(ctx, mitigateJournal(ctx, r.place))
  if (r.blessing === 'first_step' && ch.blessing.novice_guard) {
    ch.blessing.novice_guard = false
    addJournal(ctx, mitigateJournal(ctx, r.place))
  }
  if (r.charm_uid) useCharge(ctx, r.charm_uid, 'escape_on_defeat')
  for (const uid of r.used_items) state.item_instances[uid]!.used = true
  ch.counters.defeats = (ch.counters.defeats ?? 0) + 1
  if (r.outcome === 'died') {
    ch.hp = 0
    return { injury: null, rankUps }
  }
  const injury = r.injury ? addInjury(ctx, r.injury.grade, r.injury.stat, 'defeat') : null
  const loot = state.current_activity.sortie?.loot
  ch.coins = Math.max(0, ch.coins - r.losses.coins)
  if (loot) {
    loot.coins = Math.max(0, loot.coins - r.losses.coins)
    for (const [id, n] of Object.entries(r.losses.materials)) loot.materials[id] = Math.max(0, (loot.materials[id] ?? 0) - n)
    loot.item_uids = loot.item_uids.filter((u) => !r.losses.items.includes(u))
  }
  for (const u of r.losses.items) {
    dropItemRefs(state.inventory, u)
    delete state.item_instances[u]
  }
  ch.hp = r.arrive_hp
  return { injury, rankUps }
}
