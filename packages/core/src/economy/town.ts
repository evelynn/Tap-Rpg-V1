// 마을 정비(08 §8)와 04가 부르는 경제 API(08 §12): townPrep, improvement(items/eval), expectedSpend, isBankrupt(aid).
// 순서: 재고 갱신 → 0 판매 → 1 필수 치료 → 2 필수 소모품 → 3 예산 → 4 교체 루프 → 정비비 → 파산 검사.
// 상태를 바로 바꾼다(마을 행동의 apply에서 부른다). 난수는 재고 갱신·구매 장비 효과에만 쓰며 loot 흐름(I07)이다.
import type { SLOTS } from '../schema/index'
import type { JournalDraft } from '../state/journal'
import { characterOf, type RuleContext } from '../rules/context'
import { collectModSources, modValue } from '../rules/modifiers'
import type { Rng } from '../rules/random'
import { renderTemplate } from '../text/index'
import { ageAt } from '../time/index'
import { equipItem, isProtected, itemName, lockedSlots, movePendingToBag, removeSold, suggest } from '../items/bag'
import { improvement, REASON_LINES, worthSwapping, type EvalItem, type EvalOptions, type Improvement, type Slot } from '../items/eval'
import { materializeItem, onceKey } from '../items/roll'
import { levelTier } from '../items/stats'
import { carryGroupCount } from '../recovery/rest'
import { isBankrupt } from './aid'
import { earnCoins } from './earn'
import { innFee } from '../rules/cost'
import { consumableBuyPrice, itemBuyPrice, maintenanceFee, sellPrice, treatmentCost } from './price'
import { consumablesOnSale, restockIfNeeded, seasonKey, visibleOffers, type ShopState, type VisibleOffer } from './shop'

// 마을 정비 묶음의 펼침 내역(14 §4). 판매 두 줄의 문형은 08 §9.2
const LINE_SOLD = '쓰지 않는 장비 {count}개를 팔았다. 동전 {coins}개.'
const LINE_MATERIALS = '재료 {count}개를 팔았다. 동전 {coins}개.'
const LINE_SERIOUS = '치료비로 동전 {coins}개를 냈다.'
const LINE_LIGHT = '경상 {count}개를 치료했다. 동전 {coins}개.'
const LINE_SUPPLIES = '소모품 {count}개를 샀다. 동전 {coins}개.'
const LINE_GEAR = '장비 {count}개를 샀다. 동전 {coins}개.'
const LINE_MAINTENANCE = '정비비로 동전 {coins}개를 냈다.'
const LINE_NO_MONEY = '{item:을/를} 살 돈이 모자랐다.' // 08 §8.2
const SLOT_ORDER: readonly (typeof SLOTS)[number][] = ['weapon', 'armor', 'accessory', 'relic'] // 동률 순서(08 §8)

export interface TownPrepOptions extends EvalOptions {
  dungeonCandidate?: boolean // 다음 활동 후보에 던전 포함(모험적 경상 치료 기준)
}

export interface SwapRecord {
  slot: Slot
  item_uid: string
  price: number
  improvement: Improvement
}

export interface TownPrepResult {
  materials: { count: number; coins: number }
  sold: { count: number; coins: number }
  serious: 'blood_rest' | 'clinic' | 'free' | null // 중상 처리. 치료 시간 진행은 행동 층 몫
  lightTreated: number
  bought: Record<string, number> // 소모품 id → 개수
  swaps: SwapRecord[]
  suggestions: number
  maintenance: number
  spent: number // 이번 정비에서 쓴 동전(치료·구매·정비비). 마을 정비 묶음 한 줄의 {coins}(14 §4)
  breakdown: string[] // 묶음 펼침 내역(14 §4): 판매·치료·구매·정비비 한 줄씩
  bankrupt: boolean
  journal: JournalDraft[] // 묶음 밖 기록(장비 교체·제안, 14 §4)
}

// 0단계 재료 판매(08 §8 재료_주머니_전부_판매, §9.2 1번, 07 §3.3): 재료 주머니를 전부 팔고 비운다.
// 판매가 0인 재료(함정 부품·채집물·광석)는 07 §3.3의 값을 주운 자리에서 동전으로 이미 받았다.
// 주머니에서는 비우되 판매 개수에 넣지 않는다(동전 0개 판매 기록을 만들지 않는다, IMPL_DECISIONS I64)
export function sellMaterials(ctx: RuleContext): { count: number; coins: number } {
  const loot = ctx.state.current_activity.sortie?.loot
  if (!loot) return { count: 0, coins: 0 }
  let count = 0
  let coins = 0
  for (const id of Object.keys(loot.materials).sort()) { // 키 삽입 순서에 기대지 않는다(ARCHITECTURE §3)
    const n = loot.materials[id] ?? 0
    const price = ctx.content.get('material', id).sell_price
    if (n <= 0 || price <= 0) continue
    count += n
    coins += price * n
  }
  earnCoins(ctx, coins)
  loot.materials = {}
  return { count, coins }
}

// 0단계 자동 판매(08 §9.2): 비보호 일반 전부, 좋은은 슬롯마다 개선률이 가장 높은 1개만 예비, 희귀는 가방이 차면 낮은 단계부터
export function autoSell(ctx: RuleContext, shop: ShopState, opts: EvalOptions = {}): { count: number; coins: number } {
  const { content, state } = ctx
  const ch = characterOf(ctx)
  const bagCfg = content.balance.economy.bag
  const inst = (u: string) => state.item_instances[u]!
  const sellable = state.inventory.bag.filter((u) => !isProtected(ctx, u) && sellPrice(ctx, inst(u)) !== null)
  const toSell = sellable.filter((u) => inst(u).grade === 'common')
  const goods = sellable.filter((u) => inst(u).grade === 'good')
  for (const slot of SLOT_ORDER) {
    const mine = goods.filter((u) => content.get('item', inst(u).def_id).slot === slot)
    if (mine.length < 2) continue
    const keep = mine.reduce((a, u) => (improvement(ctx, inst(u), opts).value > improvement(ctx, inst(a), opts).value ? u : a))
    toSell.push(...mine.filter((u) => u !== keep))
  }
  // 희귀: 가방이 auto_sell_rare_bag_gte칸 이상이면 레벨 기준보다 rare_sell_tier_gap 이상 낮은 단계부터
  const tier = levelTier(content, ch.level)
  const rares = sellable
    .filter((u) => inst(u).grade !== 'common' && inst(u).grade !== 'good' && content.get('item', inst(u).def_id).tier <= tier - bagCfg.rare_sell_tier_gap)
    .sort((a, b) => content.get('item', inst(a).def_id).tier - content.get('item', inst(b).def_id).tier)
  for (const u of rares) {
    if (state.inventory.bag.length - toSell.length < bagCfg.auto_sell_rare_bag_gte) break
    toSell.push(u)
  }
  let coins = 0
  for (const u of toSell) {
    const i = inst(u)
    coins += sellPrice(ctx, i) ?? 0
    shop.sold.push({ def_id: i.def_id, grade: i.grade })
    removeSold(ctx, u)
  }
  earnCoins(ctx, coins)
  return { count: toSell.length, coins }
}

// 2단계 구매 목표(08 §4.1): 태도 buy_targets(carry_group별, carry_limits 이하). 회복약은 살 수 있는 가장 높은 단계부터
function buySupplies(ctx: RuleContext, bought: Record<string, number>): void {
  const { content, state } = ctx
  const ch = characterOf(ctx)
  const att = content.get('attitude', state.policies.attitude)
  const limits = content.balance.economy.carry_limits
  const sources = collectModSources(ctx)
  const onSale = consumablesOnSale(ctx).sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0))
  for (const [group, target] of Object.entries(att.buy_targets)) {
    const goal = Math.min(target, limits[group] ?? target)
    const cands = onSale.filter((c) => c.carry_group === group)
    while (carryGroupCount(ctx, group) < goal) {
      const c = cands.find((x) => consumableBuyPrice(ctx, x, sources) <= ch.coins)
      if (!c) break
      ch.coins -= consumableBuyPrice(ctx, c, sources)
      state.inventory.consumables[c.id] = (state.inventory.consumables[c.id] ?? 0) + 1
      bought[c.id] = (bought[c.id] ?? 0) + 1
    }
  }
}

// 예약 비율: 방침(사용자 지정) 또는 태도값 + reserve_add(TA06)
export function reserveRatio(ctx: RuleContext): number {
  const p = ctx.state.policies
  const base = p.reserve_mode === 'custom' ? p.reserve_custom : ctx.content.get('attitude', p.attitude).reserve_ratio
  return Math.min(1, base + modValue(ctx, 'reserve_add', 0))
}

interface Candidate {
  item: EvalItem
  slot: Slot
  price: number
  offer: VisibleOffer | null
  imp: Improvement
}

// 4단계 후보(08 §8): 상점 진열 ∪ 가방 ∪ 수령 대기함 − 저주 − 판매·무시 기록 − 잠긴·바꾼 슬롯 − 예산 초과
function swapCandidates(ctx: RuleContext, shop: ShopState, budget: number, skip: Set<Slot>, opts: EvalOptions): Candidate[] {
  const { content, state } = ctx
  const key = seasonKey(ctx)
  const dismissed = (d: string, g: string) => state.inventory.dismissed_suggestions.some((x) => x.def_id === d && x.grade === g && x.season_key === key)
  const out: Candidate[] = []
  const push = (item: EvalItem, price: number, offer: VisibleOffer | null) => {
    const def = content.get('item', item.def_id)
    if (def.cursed || skip.has(def.slot) || dismissed(item.def_id, item.grade)) return
    const imp = improvement(ctx, item, opts)
    if (worthSwapping(ctx, item, imp)) out.push({ item, slot: def.slot, price, offer, imp })
  }
  for (const o of visibleOffers(ctx, shop)) {
    if (shop.sold.some((x) => x.def_id === o.def_id && x.grade === o.grade)) continue
    const price = itemBuyPrice(ctx, o.def_id, o.grade)
    if (price <= budget) push({ def_id: o.def_id, grade: o.grade, effects: o.effects }, price, o)
  }
  for (const u of [...state.inventory.bag, ...state.inventory.pending_box]) push(state.item_instances[u]!, 0, null)
  return out
}

function best(cands: Candidate[]): Candidate | null {
  return cands.reduce<Candidate | null>((a, c) => {
    if (!a) return c
    if (c.imp.value !== a.imp.value) return c.imp.value > a.imp.value ? c : a
    if (c.price !== a.price) return c.price < a.price ? c : a
    return SLOT_ORDER.indexOf(c.slot) < SLOT_ORDER.indexOf(a.slot) ? c : a
  }, null)
}

// 상점 품목 구입: 동전 차감, 인스턴스 생성, 무작위 재고에서 뺌, 생애 1개 고유 장비 기록
function buyOffer(ctx: RuleContext, shop: ShopState, o: VisibleOffer, price: number): string {
  const { content } = ctx
  const ch = characterOf(ctx)
  ch.coins -= price
  const inst = materializeItem(ctx, { def_id: o.def_id, grade: o.grade, effects: o.effects }, {
    gen: ch.generation, char_uid: ch.uid, age: ageAt(ch.eff_min, content.balance.time), location: ch.location, source: 'shop',
  })
  if (o.stock_index !== null) shop.offers.splice(o.stock_index, 1)
  if (content.get('item', o.def_id).unique) ch.counters[onceKey('purchased', o.def_id)] = (ch.counters[onceKey('purchased', o.def_id)] ?? 0) + 1
  return inst.uid
}

// 마을 정비 본체(08 §8)
export function townPrep(ctx: RuleContext, rng: Rng, shop: ShopState, opts: TownPrepOptions = {}): TownPrepResult {
  const { content, state } = ctx
  const ch = characterOf(ctx)
  const journal: JournalDraft[] = []
  const breakdown: string[] = []
  restockIfNeeded(ctx, rng, shop)

  // 0. 판매(재료 주머니 먼저, 그다음 가방 정리)
  const materials = sellMaterials(ctx)
  if (materials.count) breakdown.push(renderTemplate(LINE_MATERIALS, materials))
  const sold = autoSell(ctx, shop, opts)
  movePendingToBag(ctx)
  if (sold.count) breakdown.push(renderTemplate(LINE_SOLD, sold))

  // 1. 필수 치료(예약금과 무관). 흡혈귀는 피의 휴식, 약초사 치료 없음(09 §7.4)
  let serious: TownPrepResult['serious'] = null
  let seriousCoins = 0
  if (ch.injuries.some((i) => i.grade === 'serious')) {
    if (ch.mutation) serious = 'blood_rest'
    else if (ch.coins >= treatmentCost(ctx, 'serious')) {
      seriousCoins = treatmentCost(ctx, 'serious')
      ch.coins -= seriousCoins
      serious = 'clinic'
      breakdown.push(renderTemplate(LINE_SERIOUS, { coins: seriousCoins }))
    } else serious = 'free'
  }
  let lightTreated = 0
  let lightCoins = 0
  const lt = content.get('attitude', state.policies.attitude).light_treat
  const lights = ch.injuries.filter((i) => i.grade === 'light')
  if (!ch.mutation && (lights.length >= lt.min_injuries || (lt.if_dungeon_candidate && opts.dungeonCandidate && lights.length))) {
    for (const inj of lights) {
      const cost = treatmentCost(ctx, 'light')
      if (ch.coins < cost) break
      ch.coins -= cost
      ch.injuries = ch.injuries.filter((i) => i !== inj)
      lightTreated++
      lightCoins += cost
    }
  }
  if (lightTreated) breakdown.push(renderTemplate(LINE_LIGHT, { count: lightTreated, coins: lightCoins }))

  // 2. 필수 소모품
  const bought: Record<string, number> = {}
  const beforeSupplies = ch.coins
  buySupplies(ctx, bought)
  const suppliesCoins = beforeSupplies - ch.coins
  const boughtCount = Object.values(bought).reduce((a, n) => a + n, 0)
  if (boughtCount) breakdown.push(renderTemplate(LINE_SUPPLIES, { count: boughtCount, coins: suppliesCoins }))

  // 출정 중 수락한 상점 제안부터 산다(08 §8.2). 예산을 다시 확인하고, 모자라면 제안을 지우고 기록한다
  const accepted = state.inventory.equip_suggestions.filter((x) => x.accepted && !('uid' in x.source)).map((x) => x.slot)
  for (const slot of accepted) journal.push(...acceptShopSuggestion(ctx, shop, slot).journal)

  // 3. 장비 예산
  let budget = ch.coins * (1 - reserveRatio(ctx))

  // 4. 교체 루프: 최대 max_swaps회, 슬롯당 1회
  const swaps: SwapRecord[] = []
  const changed = new Set<Slot>([...lockedSlots(ctx), ...accepted])
  let suggestions = 0
  for (let i = 0; i < content.balance.equip_eval.max_swaps; i++) {
    const c = best(swapCandidates(ctx, shop, budget, changed, opts))
    if (!c) break
    changed.add(c.slot)
    const name = itemName(ctx, c.item)
    if (!state.policies.auto_equip) {
      const source = c.offer ? { shop_def_id: c.item.def_id, grade: c.item.grade, price: c.price } : { uid: c.item.uid! }
      const d = suggest(ctx, { slot: c.slot, source, improvement: c.imp.value, reason: c.imp.reason, created_eff_min: ch.eff_min }, name)
      if (d) journal.push(d)
      suggestions++
      continue
    }
    const uid = c.offer ? buyOffer(ctx, shop, c.offer, c.price) : c.item.uid!
    budget -= c.price
    equipItem(ctx, uid)
    swaps.push({ slot: c.slot, item_uid: uid, price: c.price, improvement: c.imp })
    journal.push({ tag: 'gear', line: renderTemplate(REASON_LINES[c.imp.reason].short, { item: name }), refs: { item_uid: uid } })
  }

  const gear = swaps.filter((w) => w.price > 0)
  const gearCoins = gear.reduce((a, w) => a + w.price, 0)
  if (gear.length) breakdown.push(renderTemplate(LINE_GEAR, { count: gear.length, coins: gearCoins }))

  // 정비비(08 §2, 04 §8 7단계)
  const maintenance = Math.min(ch.coins, maintenanceFee(ctx))
  ch.coins -= maintenance
  if (maintenance) breakdown.push(renderTemplate(LINE_MAINTENANCE, { coins: maintenance }))

  const spent = seriousCoins + lightCoins + suppliesCoins + gearCoins + maintenance
  return { materials, sold, serious, lightTreated, bought, swaps, suggestions, maintenance, spent, breakdown, bankrupt: isBankrupt(ctx), journal }
}

// 상점 제안 수락(마을, 08 §8.2): 예산을 다시 확인해 사고 장착·잠금. 모자라면 제안을 지우고 기록
export function acceptShopSuggestion(ctx: RuleContext, shop: ShopState, slot: Slot): { bought: string | null; journal: JournalDraft[] } {
  const inv = ctx.state.inventory
  const sg = inv.equip_suggestions.find((x) => x.slot === slot)
  if (!sg || 'uid' in sg.source) return { bought: null, journal: [] }
  const src = sg.source
  inv.equip_suggestions = inv.equip_suggestions.filter((x) => x !== sg)
  const offer = visibleOffers(ctx, shop).find((o) => o.def_id === src.shop_def_id && o.grade === src.grade)
  const price = offer ? itemBuyPrice(ctx, offer.def_id, offer.grade) : Infinity
  if (!offer || price > characterOf(ctx).coins * (1 - reserveRatio(ctx))) {
    const line = renderTemplate(LINE_NO_MONEY, { item: ctx.content.get('item', src.shop_def_id).name })
    return { bought: null, journal: [{ tag: 'gear', line }] }
  }
  const uid = buyOffer(ctx, shop, offer, price)
  equipItem(ctx, uid)
  const inst = ctx.state.item_instances[uid]!
  inst.locked = true
  inst.lock_source = 'manual_equip'
  return { bought: uid, journal: [] }
}

// 예상 지출(08 §12): 다음 출정 준비(구매 목표를 채우는 비용) + 여관 1회. 04의 적자 활동 판단용
export function expectedSpend(ctx: RuleContext): number {
  const { content, state } = ctx
  const att = content.get('attitude', state.policies.attitude)
  const limits = content.balance.economy.carry_limits
  const sources = collectModSources(ctx)
  const onSale = consumablesOnSale(ctx).sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0))
  let sum = innFee(ctx)
  for (const [group, target] of Object.entries(att.buy_targets)) {
    const c = onSale.find((x) => x.carry_group === group)
    if (!c) continue
    sum += Math.max(0, Math.min(target, limits[group] ?? target) - carryGroupCount(ctx, group)) * consumableBuyPrice(ctx, c, sources)
  }
  return sum
}
