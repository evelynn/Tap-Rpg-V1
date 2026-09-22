// 기반 팩(content/base) 골든 테스트: 01 등록부·수치표와 데이터가 같은지 본다(CONTENT_SCHEMA DS-26).
// 스키마·참조 검사는 pnpm content:check 몫이고, 여기서는 수치만 대조한다.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { readPackFiles } from '../src/pack/read'

type Def = Record<string, any>
const baseDir = fileURLToPath(new URL('../../../content/base', import.meta.url))
const files = readPackFiles(baseDir, 'base')
const byKind = (kind: string) => new Map(files.defs.filter((d) => d.kind === kind).map((d) => [d.id, d.value as Def]))
const balance = byKind('balance').get('balance')!
const sortedIds = (kind: string) => [...byKind(kind).keys()].sort()

describe('기반 팩 — 01 등록부 개수', () => {
  it('파일을 읽는 데 문제가 없다', () => assert.deepEqual(files.issues, []))

  it('장소 13, 소모품 8, 특성 17, NPC 9 (01 §8.1·§10·§11·§13)', () => {
    assert.deepEqual(sortedIds('region'), ['A1', 'A2', 'A3', 'A4', 'D1', 'D2', 'D3', 'H1', 'H2', 'H3', 'H4', 'H5', 'T00'])
    assert.deepEqual(sortedIds('consumable'), ['CP01', 'CP02', 'CP03', 'CP04', 'CP05', 'CP06', 'CP07', 'CP08'])
    const kinds = [...byKind('trait').values()].map((t) => t.kind)
    assert.deepEqual(
      ['innate', 'acquired', 'mutation'].map((k) => kinds.filter((x) => x === k).length),
      [8, 8, 1],
    )
    assert.deepEqual(sortedIds('npc'), ['N01', 'N02', 'N03', 'N04', 'N05', 'N06', 'N07', 'N08', 'N09'])
  })
})

describe('기반 팩 — 적 13종 = 01 §5.2', () => {
  // id, 이름, 계열, L, 구분, HP, 방어, 명중, 피해, XP, 동전
  const REG: [string, string, string, number, string, number, number, number, [number, number], number, number][] = [
    ['EN01', '여울 들쥐', '들쥐', 1, 'normal', 10, 10, 2, [1, 2], 9, 5],
    ['EN02', '큰 들쥐', '들쥐', 4, 'normal', 17, 11, 3, [1, 3], 18, 12],
    ['EN03', '여울 늑대', '늑대', 8, 'normal', 26, 12, 4, [2, 5], 30, 28],
    ['EN04', '잿빛 늑대', '늑대', 15, 'normal', 42, 15, 7, [3, 8], 51, 81],
    ['EN05', '종굴 박쥐', '박쥐', 7, 'normal', 24, 12, 4, [2, 4], 27, 23],
    ['EN06', '쇳소리 박쥐', '박쥐', 15, 'normal', 42, 15, 7, [3, 8], 51, 81],
    ['EN07', '그림자 박쥐', '박쥐', 23, 'normal', 61, 17, 9, [4, 11], 75, 220],
    ['EN08', '폐광 코볼트', '코볼트', 10, 'normal', 31, 13, 5, [2, 6], 36, 39],
    ['EN09', '코볼트 광부장', '코볼트', 18, 'normal', 49, 16, 8, [4, 9], 60, 120],
    ['EN10', '녹슨 투구 코볼트', '코볼트', 26, 'normal', 68, 18, 10, [5, 12], 84, 311],
    ['EB01', '코볼트 두목', '코볼트', 13, 'elite', 95, 14, 8, [4, 10], 112, 152],
    ['EB02', '늙은 광부장', '코볼트', 21, 'elite', 141, 17, 11, [6, 13], 172, 435],
    ['EB03', '부서진 종의 파수꾼', '고유', 29, 'boss', 373, 21, 14, [8, 20], 930, 4330],
  ]

  it('ID 목록이 같다', () => assert.deepEqual(sortedIds('enemy'), REG.map((r) => r[0]).sort()))

  const enemies = byKind('enemy')
  const families = byKind('enemy_family')
  for (const [id, name, family, level, rank, hp, ac, hit, damage, xp, coins] of REG) {
    it(id, () => {
      const e = enemies.get(id)!
      assert.deepEqual(
        { name: e.name, family: families.get(e.family)?.name, level: e.level, rank: e.rank, hp: e.hp, ac: e.ac, hit: e.hit, damage: e.damage, xp: e.xp, coins: e.coins },
        { name, family, level, rank, hp, ac, hit, damage, xp, coins },
      )
    })
  }

  it('치명 관문 적은 EB03뿐이다', () => {
    assert.deepEqual([...enemies.values()].filter((e) => e.lethal === true).map((e) => e.id), ['EB03'])
  })
})

describe('기반 팩 — 장비 기준가 = 01 §9.2', () => {
  const SLOTS = ['weapon', 'armor', 'accessory', 'relic'] as const
  // 단계별 무기 / 방어구 / 장신구 / 유물
  const PRICE = [
    [120, 108, 96, 180],
    [380, 342, 304, 570],
    [1100, 990, 880, 1650],
    [3000, 2700, 2400, 4500],
    [7500, 6750, 6000, 11250],
  ]
  const eco = balance.economy
  const basePrice = (tier: number, slot: string) => Math.round(eco.tier_price[tier - 1] * eco.slot_price_mult[slot])

  it('단계 × 슬롯 표 전체', () => {
    assert.deepEqual(PRICE.map((_, t) => SLOTS.map((s) => basePrice(t + 1, s))), PRICE)
  })

  // 01 §10 장비 등록부 26종의 슬롯·단계
  const REG: [string, (typeof SLOTS)[number], number][] = [
    ['W01', 'weapon', 1], ['W02', 'weapon', 1], ['W03', 'weapon', 1], ['W04', 'weapon', 2], ['W05', 'weapon', 2],
    ['W06', 'weapon', 3], ['W07', 'weapon', 3], ['W08', 'weapon', 4], ['W09', 'weapon', 5], ['W10', 'weapon', 5],
    ['A01', 'armor', 1], ['A02', 'armor', 1], ['A03', 'armor', 2], ['A04', 'armor', 2], ['A05', 'armor', 3],
    ['A06', 'armor', 4], ['A07', 'armor', 5],
    ['J01', 'accessory', 1], ['J02', 'accessory', 1], ['J03', 'accessory', 2], ['J04', 'accessory', 3], ['J05', 'accessory', 4],
    ['R01', 'relic', 2], ['R02', 'relic', 2], ['R03', 'relic', 4], ['R04', 'relic', 4],
  ]
  const items = byKind('item')

  it('26종의 슬롯·단계가 01 §10과 같고 가격 덮어쓰기가 없다', () => {
    assert.deepEqual(sortedIds('item'), REG.map((r) => r[0]).sort())
    for (const [id, slot, tier] of REG) {
      const item = items.get(id)!
      assert.deepEqual([item.slot, item.tier, item.price_override], [slot, tier, undefined], id)
      assert.equal(basePrice(item.tier, item.slot), PRICE[tier - 1]![SLOTS.indexOf(slot)], id)
    }
  })

  it('R01 길드 특별 상점가 2,850 = 기준가 × 희귀 배수, W01·A01 판매가 5 (01 §10)', () => {
    const r01 = items.get('R01')!
    assert.equal(basePrice(r01.tier, r01.slot) * eco.grade_price_mult[r01.fixed_grade], 2850)
    assert.equal(items.get('W01')!.sell_price_override, 5)
    assert.equal(items.get('A01')!.sell_price_override, 5)
  })
})

describe('기반 팩 — 레벨 필요 경험치 = 01 §2.4 표준 진행표', () => {
  // 레벨 1~29의 `다음까지 XP`
  const NEXT = [
    25, 65, 115, 170, 235, 305, 375, 445, 525, 600, 680, 760, 840, 920, 1005,
    1090, 1170, 1255, 1340, 1430, 1515, 1605, 1690, 1780, 1875, 1965, 2060, 2150, 2245,
  ]
  // req(n) = max(req_min, req_round 단위 반올림(목표 분(n) × prod_rate × XP(n)))
  const x = balance.xp
  const req = (n: number) => {
    const t = x.target_min
    const target = t.base + t.amp * (1 - Math.exp(-(n - 1) / t.tau)) + t.linear * (n - 1)
    const raw = target * x.prod_rate * (x.encounter_base.flat + x.encounter_base.per_level * n)
    return Math.max(x.req_min, Math.round(raw / x.req_round) * x.req_round)
  }

  it('레벨 1~29 필요 경험치와 레벨 30 누적 30,235', () => {
    assert.equal(x.max_level, 30)
    const got = NEXT.map((_, i) => req(i + 1))
    assert.deepEqual(got, NEXT)
    assert.equal(got.reduce((a, b) => a + b, 0), 30235)
  })
})
