// 08 §4.1·§5.1·§8·§9.2·§11·§12 — 상점 재고, 마을 정비 순서, 예상 지출, 파산과 길드 지원.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Rng } from '../../src/index'
import { considerPickup, improvement, putPending } from '../../src/items/index'
import {
  aidEndCoins, autoSell, consumablesOnSale, emptyShopState, endGuildAidIfDue, expectedSpend, isBankrupt,
  restockIfNeeded, sellMaterials, startGuildAid, townPrep, visibleOffers,
} from '../../src/economy/index'
import { baseWorld, give } from './base-fixture'

// 항상 첫 후보를 고르고 확률은 참인 난수(재고 갱신용)
const firstRng = (): Rng => ({
  nextU32: () => 0,
  chance: () => true,
  pick: <T>(items: readonly T[]) => items[0]!,
  bounded: () => 0,
  int: (min: number) => min,
  d20: () => 10,
  weightedIndex: () => 0,
})

describe('08 §5.1 상점 진열과 재고 갱신', () => {
  it('레벨 기준 단계 이하·길드 등급 조건을 지키고, 좋은 등급은 good_stock개(대장간 2, 잡화점 1)', () => {
    const w = baseWorld()
    const shop = emptyShopState()
    assert.ok(restockIfNeeded(w, firstRng(), shop))
    assert.equal(restockIfNeeded(w, firstRng(), shop), false) // 같은 계절이면 그대로
    assert.equal(shop.offers.filter((o) => o.facility === 'smithy' && o.grade === 'good').length, 2)
    const ids = new Set(visibleOffers(w, shop).map((o) => o.def_id))
    assert.deepEqual([...ids].sort(), ['A02', 'W02', 'W03']) // 레벨 1 = T1, 견습 등급. 잡화점 품목은 모두 T2 이상이라 빠진다
    w.state.character!.level = 12
    const shop2 = emptyShopState()
    restockIfNeeded(w, firstRng(), shop2)
    assert.equal(shop2.offers.filter((o) => o.facility === 'general_store' && o.grade === 'good').length, 1)
  })

  it('길드 특별 상점: 은패면 R01(생애 1개), 금패면 2단계 희귀 1개', () => {
    const w = baseWorld()
    const ch = w.state.character!
    ch.level = 20
    ch.guild_rank = 'gold'
    const shop = emptyShopState()
    restockIfNeeded(w, firstRng(), shop)
    const guild = visibleOffers(w, shop).filter((o) => o.facility === 'guild')
    assert.ok(guild.some((o) => o.def_id === 'R01' && o.grade === 'rare'))
    const t2 = guild.filter((o) => o.def_id === 'W08' || o.def_id === 'A06')
    assert.equal(t2.filter((o) => o.grade === 'rare').length, 1)
    // 생애 1개: 이미 산 뒤에는 진열되지 않는다
    ch.counters['purchased.R01'] = 1
    assert.ok(!visibleOffers(w, shop).some((o) => o.def_id === 'R01'))
  })

  it('지원 기간에는 희귀 이상을 사지 못한다(08 §11)', () => {
    const w = baseWorld()
    const ch = w.state.character!
    ch.level = 20
    ch.guild_rank = 'gold'
    const shop = emptyShopState()
    restockIfNeeded(w, firstRng(), shop)
    ch.guild_aid = { active: true, started_eff_min: 0, recovered: false }
    assert.ok(!visibleOffers(w, shop).some((o) => o.grade === 'rare'))
  })

  it('회복약은 레벨 기준 단계까지만 진열한다', () => {
    const w = baseWorld()
    assert.deepEqual(consumablesOnSale(w).map((c) => c.id), ['CP01', 'CP06', 'CP07'])
    w.state.character!.level = 12
    assert.deepEqual(consumablesOnSale(w).map((c) => c.id), ['CP01', 'CP02', 'CP03', 'CP06', 'CP07'])
  })
})

describe('08 §9.2 귀환 시 자동 판매', () => {
  it('비보호 일반은 전부, 좋은은 슬롯마다 1개만 남긴다. 착용·잠금·고유는 팔지 않는다', () => {
    const w = baseWorld()
    const ch = w.state.character!
    const inv = w.state.inventory
    const bag = [give(w, 'W02', 'common'), give(w, 'W02', 'good'), give(w, 'W04', 'good'), give(w, 'W07', 'rare')]
    inv.bag.push(...bag)
    const locked = give(w, 'A02', 'common')
    w.state.item_instances[locked]!.locked = true
    inv.bag.push(locked)
    ch.coins = 0
    const shop = emptyShopState()
    const r = autoSell(w, shop)
    assert.deepEqual([r.count, r.coins], [2, 30 + 66]) // W02 일반 30 + 좋은 W02 66(개선률이 낮은 쪽), 좋은 W04는 예비로 남는다
    assert.deepEqual(inv.bag.sort(), [bag[2], bag[3], locked].sort())
    assert.deepEqual(shop.sold.map((s) => s.def_id).sort(), ['W02', 'W02'])
  })
})

describe('08 §8 마을 정비', () => {
  const setup = (coins: number) => {
    const w = baseWorld()
    const ch = w.state.character!
    ch.coins = coins
    return w
  }

  it('순서: 판매 → 치료 → 소모품 → 예산 → 교체. 시작 장비는 기준 없이 교체한다', () => {
    const w = setup(600)
    const shop = emptyShopState()
    const r = townPrep(w, firstRng(), shop)
    // 필수 소모품: 회복약 3(모험적) − 시작 2 = 1개, 붕대 1개
    assert.deepEqual(r.bought, { CP01: 1, CP07: 1 })
    // 교체: W01·A01은 시작 지급 장비라 기준 없이 바뀐다
    assert.deepEqual(r.swaps.map((s) => s.slot).sort(), ['armor', 'weapon'])
    const eq = w.state.inventory.equipped
    assert.notEqual(w.state.item_instances[eq.weapon!]!.def_id, 'W01')
    assert.notEqual(w.state.item_instances[eq.armor!]!.def_id, 'A01')
    assert.ok(r.journal.some((j) => j.tag === 'gear'))
    // 예약금 30%(모험적)를 넘겨 쓰지 않는다
    assert.ok(w.state.character!.coins >= 0)
    assert.equal(r.bankrupt, false)
  })

  it('묶음 한 줄의 쓴 동전은 치료·소모품·장비 구매·정비비의 합이다(14 §4)', () => {
    const w = setup(600)
    const before = w.state.character!.coins
    const r = townPrep(w, firstRng(), emptyShopState())
    const income = r.materials.coins + r.sold.coins
    assert.equal(r.spent, before + income - w.state.character!.coins)
    assert.ok(r.spent > r.maintenance, `정비비(${r.maintenance})만 적었다: ${r.spent}`)
    // 펼침 내역: 소모품·장비 구매·정비비가 한 줄씩. 판매·교체 기록은 따로 남지 않는다(교체는 [장비])
    assert.ok(r.breakdown.some((l) => l.startsWith('소모품 2개를 샀다')))
    assert.ok(r.breakdown.some((l) => l.startsWith('장비 2개를 샀다')))
    assert.ok(r.breakdown.some((l) => l.startsWith('정비비로')))
    assert.ok(!r.journal.some((j) => j.tag === 'town'))
  })

  it('돈이 없으면 아무것도 못 사고, 회복약이 0이면 파산 판정이 선다', () => {
    const w = setup(3) // 가장 싼 소모품(야영 식량 5)도 못 산다
    w.state.inventory.consumables = {}
    const r = townPrep(w, firstRng(), emptyShopState())
    assert.deepEqual(r.bought, {})
    assert.deepEqual(r.swaps, [])
    assert.equal(r.bankrupt, true)
  })

  it('자동 교체를 끄면 사지 않고 제안만 남긴다(슬롯당 1건)', () => {
    const w = setup(600)
    w.state.policies.auto_equip = false
    const before = w.state.character!.coins
    const r = townPrep(w, firstRng(), emptyShopState())
    assert.deepEqual(r.swaps, [])
    assert.ok(r.suggestions >= 1)
    assert.equal(w.state.inventory.equip_suggestions.length, r.suggestions)
    assert.ok(w.state.character!.coins > before - 100) // 소모품 값만 썼다
  })

  it('중상은 소지금이 있으면 치료소, 없으면 무료 치료. 경상 치료 기준은 태도를 따른다', () => {
    const w = setup(1000)
    const ch = w.state.character!
    ch.level = 5
    ch.injuries = [
      { grade: 'serious', stat: 'str', remaining_min: 0, source: 'test' },
      { grade: 'light', stat: 'dex', remaining_min: 0, source: 'test' },
    ]
    const r = townPrep(w, firstRng(), emptyShopState())
    assert.equal(r.serious, 'clinic')
    assert.equal(r.lightTreated, 0) // 모험적: 경상 2개 또는 던전 예정일 때만
    const w2 = setup(10)
    w2.state.character!.injuries = [{ grade: 'serious', stat: 'str', remaining_min: 0, source: 'test' }]
    assert.equal(townPrep(w2, firstRng(), emptyShopState()).serious, 'free')
  })

  it('경상은 던전이 다음 후보면 치료한다(모험적)', () => {
    const w = setup(1000)
    w.state.character!.injuries = [{ grade: 'light', stat: 'dex', remaining_min: 0, source: 'test' }]
    const r = townPrep(w, firstRng(), emptyShopState(), { dungeonCandidate: true })
    assert.equal(r.lightTreated, 1)
    assert.equal(w.state.character!.injuries.length, 0)
  })

  it('같은 계절에 판 장비는 다시 사지 않는다', () => {
    const w = setup(600)
    const shop = emptyShopState()
    restockIfNeeded(w, firstRng(), shop)
    shop.sold.push({ def_id: 'W02', grade: 'common' }, { def_id: 'W03', grade: 'common' }, { def_id: 'A02', grade: 'common' })
    const r = townPrep(w, firstRng(), shop)
    for (const sw of r.swaps) {
      const it = w.state.item_instances[sw.item_uid]!
      assert.ok(!shop.sold.some((x) => x.def_id === it.def_id && x.grade === it.grade), `${it.def_id} ${it.grade}`)
    }
  })
})

describe('08 §12 04가 부르는 API', () => {
  it('예상 지출 = 구매 목표를 채우는 비용 + 여관 1회', () => {
    const w = baseWorld()
    // 모험적 레벨 1: 회복약 3개(2개 보유 → 1 × 10), 식량 2개(보유 2), 붕대 1개(15), 여관 7
    assert.equal(expectedSpend(w), 10 + 15 + 7)
  })

  it('개선률과 파산 여부를 04가 그대로 쓴다', () => {
    const w = baseWorld()
    assert.ok(improvement(w, { def_id: 'A02', grade: 'common' }).value > 0)
    assert.equal(isBankrupt(w), false)
  })
})

describe('08 §11 파산과 길드 지원', () => {
  it('파산 조건: 소지금 < 20이고 (무기 단계 차이 ≥ 2 또는 회복약 0)', () => {
    const w = baseWorld()
    const ch = w.state.character!
    ch.coins = 19
    w.state.inventory.consumables = {}
    assert.equal(isBankrupt(w), true) // 회복약 0
    w.state.inventory.consumables = { CP01: 2 }
    assert.equal(isBankrupt(w), false) // 레벨 1 = T1, W01도 T1
    ch.level = 12 // T3인데 무기는 T1
    assert.equal(isBankrupt(w), true)
    ch.coins = 20
    assert.equal(isBankrupt(w), false)
  })

  it('종료선 = max(100, 3 × 여관비 + 2 × 레벨 기준 단계 회복약)', () => {
    const w = baseWorld()
    const rows: [number, number][] = [[5, 100], [10, 135], [15, 265], [20, 535], [25, 1065]]
    for (const [level, end] of rows) {
      w.state.character!.level = level
      assert.equal(aidEndCoins(w), end, `레벨 ${level}`)
    }
  })

  it('지원 시작은 빈 칸에 W01·A01을 주고, 그 장비의 판매가는 0. 종료선을 넘으면 지원이 끝난다', () => {
    const w = baseWorld()
    const ch = w.state.character!
    w.state.inventory.equipped = { weapon: null, armor: null, accessory: null, relic: null }
    const issued = startGuildAid(w)
    assert.equal(issued.length, 2)
    assert.equal(ch.counters.guild_aids, 1)
    assert.deepEqual(issued.map((u) => w.state.item_instances[u]!.acquired.source), ['aid', 'aid'])
    assert.equal(endGuildAidIfDue(w), false)
    ch.coins = 100
    assert.equal(endGuildAidIfDue(w), true)
    assert.equal(ch.guild_aid.active, false)
  })
})

describe('08 §8 출정 중 획득 장비', () => {
  it('개선률이 8% 이상이면 비용 없이 바로 장착하고 기록을 남긴다', () => {
    const w = baseWorld()
    const uid = give(w, 'A02', 'common')
    w.state.inventory.bag.push(uid)
    const r = considerPickup(w, uid)
    assert.equal(r.equipped, true)
    assert.equal(w.state.inventory.equipped.armor, uid)
    assert.equal(r.journal[0]!.line, '주운 여울 가죽조끼를 바로 찼다.')
  })

  it('자동 교체가 꺼져 있으면 제안으로 남는다', () => {
    const w = baseWorld()
    w.state.policies.auto_equip = false
    const uid = give(w, 'A02', 'common')
    w.state.inventory.bag.push(uid)
    const r = considerPickup(w, uid)
    assert.equal(r.equipped, false)
    assert.deepEqual(w.state.inventory.equip_suggestions.map((s) => s.slot), ['armor'])
    assert.equal(r.journal[0]!.line, '여울 가죽조끼가 더 나아 보인다.')
  })

  it('잠긴 슬롯은 건드리지 않는다', () => {
    const w = baseWorld()
    w.state.item_instances[w.state.inventory.equipped.armor!]!.locked = true
    const uid = give(w, 'A02', 'common')
    w.state.inventory.bag.push(uid)
    assert.equal(considerPickup(w, uid).equipped, false)
  })
})

describe('08 §8·§9.2 재료 주머니 자동 판매', () => {
  const withLoot = (w: ReturnType<typeof baseWorld>, materials: Record<string, number>) => {
    w.state.current_activity.sortie = {
      id: 'so_1', activity: 'hunt', location_id: 'H1', time_of_day: 'day', weather: 'clear', started_eff_min: 0,
      plan: { target_encounters: 3, safety_cap: 6 }, progress: 0, trip_flags: {}, temp_mods: [], dungeon_mods: [],
      quest_wins: null, loot: { coins: 0, item_uids: [], materials },
      potions_used: 0, events_this_sortie: 0, camps: 0, discovery_attempts: [], exclusive_used: [], fate_offered: false,
    }
  }

  it('마을 정비 0단계가 재료를 전부 팔고 주머니를 비운다(07 §3.3 판매가)', () => {
    const w = baseWorld()
    const ch = w.state.character!
    withLoot(w, { mat_EN01: 3, mat_EN02: 2 })
    const price = (id: string) => w.content.get('material', id).sell_price
    const before = ch.coins
    const r = sellMaterials(w)
    assert.equal(r.count, 5)
    assert.equal(r.coins, price('mat_EN01') * 3 + price('mat_EN02') * 2)
    assert.equal(ch.coins - before, r.coins)
    assert.deepEqual(w.state.current_activity.sortie!.loot.materials, {})
  })

  it('townPrep이 장비 판매보다 먼저 재료를 팔고 정비 묶음 펼침에 한 줄을 남긴다(14 §4)', () => {
    const w = baseWorld()
    withLoot(w, { mat_EN01: 2 })
    const r = townPrep(w, firstRng(), emptyShopState())
    assert.equal(r.materials.count, 2)
    assert.ok(r.materials.coins > 0)
    assert.ok(r.breakdown[0]!.startsWith('재료 2개를 팔았다'))
    assert.ok(!r.journal.some((d) => d.line.startsWith('재료')), '판매는 따로 기록하지 않는다')
  })

  it('판매가 0인 재료(값은 주울 때 받았다)는 판매 개수·기록에 넣지 않고 주머니만 비운다', () => {
    const w = baseWorld()
    const zero = w.content.list('material').filter((m) => m.sell_price === 0).map((m) => m.id)
    assert.ok(zero.length > 0)
    withLoot(w, Object.fromEntries(zero.map((id) => [id, 3])))
    const before = w.state.character!.coins
    assert.deepEqual(sellMaterials(w), { count: 0, coins: 0 })
    assert.equal(w.state.character!.coins, before)
    assert.deepEqual(w.state.current_activity.sortie!.loot.materials, {})
    withLoot(w, { [zero[0]!]: 2, mat_EN01: 1 })
    const r = townPrep(w, firstRng(), emptyShopState())
    assert.equal(r.materials.count, 1)
    assert.ok(!r.breakdown.some((l) => l.includes('동전 0개')))
  })

  it('출정 중이 아니면 팔 재료가 없다', () => {
    const w = baseWorld()
    assert.deepEqual(sellMaterials(w), { count: 0, coins: 0 })
  })
})

describe('08 §9.4 수령 대기함 정원', () => {
  it('희귀가 없어도 정원(10)을 넘지 않는다', () => {
    const w = baseWorld()
    const cap = w.content.balance.economy.bag.pending_box_cap
    for (let i = 0; i < cap + 3; i++) putPending(w, give(w, 'A02', 'good'))
    assert.equal(w.state.inventory.pending_box.length, cap)
  })

  it('가장 오래된 희귀를 먼저 환전한다', () => {
    const w = baseWorld()
    const cap = w.content.balance.economy.bag.pending_box_cap
    const rare = give(w, 'A02', 'rare')
    putPending(w, rare)
    for (let i = 0; i < cap - 1; i++) putPending(w, give(w, 'A02', 'good'))
    putPending(w, give(w, 'A02', 'good'))
    assert.equal(w.state.inventory.pending_box.includes(rare), false)
    assert.equal(w.state.inventory.pending_box.length, cap)
  })
})
