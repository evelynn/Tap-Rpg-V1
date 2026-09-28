// 회복(01 §1.2·§6.1, 04 §7.6·§7.7·§8, 07 §5.3 휴식 지점, 08 §4). 난수를 쓰지 않으므로 바로 상태를 바꾼다.
// 체력 회복량 = 최대 HP × 비율 × 회복 계수 × 배수, 반올림(04 §12.1: 73 × 4% = 2.9 → 3). 회복약에는 회복 계수를 곱하지 않는다.
import { characterOf, type RuleContext } from '../rules/context'
import { innFee } from '../rules/cost'
import { maxHp, roundHalfUp } from '../rules/derived'
import { addFatigue } from '../rules/fatigue'
import { addSkillUses, recoveryCoef, type RankUp } from '../rules/growth'
import { collectModSources, modValue } from '../rules/modifiers'
import { SLOTS } from '../schema/index'

function heal(ctx: RuleContext, ratio: number, mult: number): number {
  const ch = characterOf(ctx)
  const max = maxHp(ctx)
  const gain = Math.max(0, Math.min(max - ch.hp, roundHalfUp(max * ratio * recoveryCoef(ctx) * mult)))
  ch.hp += gain
  return gain
}

// 숨 고르기: 조우·방 뒤 최대 HP 4% × 회복 계수 × breather_mult. 회복량을 돌려준다
export function breathe(ctx: RuleContext): number {
  return heal(ctx, ctx.content.balance.recovery.breather_hp_ratio, modValue(ctx, 'breather_mult', 1))
}

export interface RestResult {
  hp: number // 회복한 체력
  fatigue: number // 피로 변화
}

// 야영: 최대 HP 30% × 회복 계수 × 휴식 배수 × 야영 배수, 피로 −40 + camp_fatigue_add. 식량이 없으면 둘 다 절반.
// 식량(carry_group의 camp_ration 효과 소모품) 1개를 쓰고 생존 숙련 +2(05 §5.1)
export function camp(ctx: RuleContext): RestResult & { ration: string | null; rankUp: RankUp | null } {
  const b = ctx.content.balance
  const c = b.recovery.camp
  const sources = collectModSources(ctx)
  const ration = ownedConsumables(ctx, 'camp_ration')[0]?.id ?? null
  if (ration) ctx.state.inventory.consumables[ration]! -= 1
  const half = ration ? 1 : c.no_ration_mult
  const mult = modValue(ctx, 'rest_recovery_mult', 1, sources) * modValue(ctx, 'camp_hp_mult', 1, sources) * half
  const hp = heal(ctx, c.hp_ratio, mult)
  const fatigue = Math.trunc((c.fatigue + modValue(ctx, 'camp_fatigue_add', 0, sources)) * half)
  addFatigue(ctx, fatigue)
  return { hp, fatigue, ration, rankUp: addSkillUses(ctx, 'survival', b.skills.use_counts.camp) }
}

// 던전 휴식 지점: HP +15% × 회복 계수 × 휴식 배수, 피로 −15(07 §5.3)
export function restPoint(ctx: RuleContext): RestResult {
  const r = ctx.content.balance.recovery.rest_point
  const hp = heal(ctx, r.hp_ratio, modValue(ctx, 'rest_recovery_mult', 1))
  addFatigue(ctx, r.fatigue)
  return { hp, fatigue: r.fatigue }
}

// 마을 휴식(여관·길드 숙소): 1회 = 최대 HP × 회복 계수 × 휴식 배수, 피로 0. 한 번 쉰 뒤에도 HP < 90%면 한 번 더(최대 2회, 04 §8).
// 여관은 회당 비용을 내고, 낼 돈이 없으면 쉬지 않는다. 여관 휴식 카운터(TA04)를 올린다. 쉰 횟수와 걸린 초를 돌려준다.
// maxTimes를 주면 그만큼만 쉰다(행동 길이를 먼저 확정하는 마을 루틴이 1회씩 부른다, 13 §8.2)
export function townRest(ctx: RuleContext, kind: 'inn' | 'lodging', maxTimes?: number): { times: number; hp: number; coins: number; sec: number } {
  const b = ctx.content.balance
  const spec = kind === 'inn' ? b.recovery.inn : b.recovery.lodging
  const sec = (kind === 'inn' ? b.actions.inn.sec : b.actions.guild_lodging.sec)[0]
  const limit = Math.min(maxTimes ?? spec.max_times, spec.max_times)
  const ch = characterOf(ctx)
  const out = { times: 0, hp: 0, coins: 0, sec: 0 }
  while (out.times < limit && (out.times === 0 || ch.hp < maxHp(ctx) * b.recovery.town_rest_when.hp_ratio_lt)) {
    if (kind === 'inn') {
      const cost = innFee(ctx)
      if (ch.coins < cost) break
      ch.coins -= cost
      out.coins += cost
      ch.counters.inn_rests = (ch.counters.inn_rests ?? 0) + 1
    }
    out.hp += heal(ctx, spec.hp_ratio, modValue(ctx, 'rest_recovery_mult', 1))
    ch.fatigue = 0
    out.times++
    out.sec += sec
  }
  return out
}

// ── 소모품·충전 ──

export interface OwnedConsumable {
  id: string
  amount: number
  count: number
}

// 효과가 effect인 소지 소모품(amount 오름차순, 같으면 id 순)
export function ownedConsumables(ctx: RuleContext, effect: string): OwnedConsumable[] {
  return Object.entries(ctx.state.inventory.consumables)
    .filter(([id, n]) => n > 0 && ctx.content.get('consumable', id).effect === effect)
    .map(([id, count]) => ({ id, amount: ctx.content.get('consumable', id).amount, count }))
    .sort((x, y) => x.amount - y.amount || (x.id < y.id ? -1 : 1))
}

export const potionsOwned = (ctx: RuleContext) => ownedConsumables(ctx, 'heal_hp')

// carry_group 하나의 보유 수(08 §4.1 보유 한도·구매 목표). 소모품 규칙이 단일 출처다
export function carryGroupCount(ctx: RuleContext, group: string): number {
  const inv = ctx.state.inventory.consumables
  return ctx.content.list('consumable').filter((c) => c.carry_group === group).reduce((s, c) => s + (inv[c.id] ?? 0), 0)
}

// 판단 지점의 회복약 자동 사용(04 §7.6, 08 §4): HP ≤ 퇴각 기준 + potion_margin이면 기준선을 넘기는 가장 작은 병,
// 한 병으로 못 넘기면 가장 큰 병을 마신다. 넘거나 떨어질 때까지 반복. 마신 id 목록
export function usePotions(ctx: RuleContext, retreatRatio: number): string[] {
  const ch = characterOf(ctx)
  const max = maxHp(ctx)
  const line = max * (retreatRatio + ctx.content.balance.activity_ai.potion_margin)
  const used: string[] = []
  for (;;) {
    const owned = potionsOwned(ctx)
    if (ch.hp > line || !owned.length) return used
    const p = owned.find((x) => ch.hp + x.amount > line) ?? owned[owned.length - 1]!
    ctx.state.inventory.consumables[p.id]! -= 1
    ch.hp = Math.min(max, ch.hp + p.amount)
    used.push(p.id)
  }
}

// 장착 장비의 남은 충전(charges_* op). 저장값이 없으면 수정자 값이 가득 찬 상태다. 출정·생애 초기화는 활동 쪽
export function chargesLeft(ctx: RuleContext, target: string): { uid: string; left: number }[] {
  const out: { uid: string; left: number }[] = []
  for (const slot of SLOTS) {
    const uid = ctx.state.inventory.equipped[slot]
    const inst = uid ? ctx.state.item_instances[uid] : undefined
    if (!inst || inst.used) continue
    const def = ctx.content.get('item', inst.def_id)
    const mods = [...(def.modifiers ?? []), ...(def.grade_modifiers?.[inst.grade] ?? [])]
    for (const e of inst.effects ?? []) mods.push(...ctx.content.get('item_effect', e).modifiers)
    const m = mods.find((x) => x.target === target && x.op.startsWith('charges_') && typeof x.value === 'number')
    if (!m) continue
    const left = inst.charges?.[target] ?? (m.value as number)
    if (left > 0) out.push({ uid: inst.uid, left })
  }
  // 익힌 기술의 출정 충전(05 §10, 독립 검증 D79-5). uid는 `tech:{기술 id}`
  for (const t of ctx.state.character?.techniques ?? []) {
    const m = ctx.content.balance.techniques[t.id]?.modifiers.find((x) => x.target === target && x.op.startsWith('charges_') && typeof x.value === 'number')
    if (!m) continue
    const left = t.charges?.[target] ?? (m.value as number)
    if (left > 0) out.push({ uid: `${TECH_UID}${t.id}`, left })
  }
  return out
}

export const TECH_UID = 'tech:'

export function useCharge(ctx: RuleContext, uid: string, target: string): void {
  if (uid.startsWith(TECH_UID)) {
    const t = characterOf(ctx).techniques.find((x) => x.id === uid.slice(TECH_UID.length))
    if (!t) throw new Error(`익힌 기술이 없다: ${uid}`)
    const left = chargesLeft(ctx, target).find((c) => c.uid === uid)?.left ?? 0
    t.charges = { ...t.charges, [target]: Math.max(0, left - 1) }
    return
  }
  const inst = ctx.state.item_instances[uid]
  if (!inst) throw new Error(`충전 장비가 없다: ${uid}`)
  const left = chargesLeft(ctx, target).find((c) => c.uid === uid)?.left ?? 0
  inst.charges = { ...inst.charges, [target]: Math.max(0, left - 1) }
}
