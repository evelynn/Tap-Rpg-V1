// 사건 효과 중 전투·장비·부상·경제·생애·출정 구조가 필요한 것은 이 포트로 넘긴다(통합자가 T5·T6·T8·T10 구현을 잇는다).
// 포트는 효과 파라미터를 그대로 받는다(바인딩은 이미 치환됨). 난수는 각 포트 담당 흐름(I07)을 쓴다.
import type { GRADES, SLOTS } from '../schema/index'
import type { EventScope, EventWorld } from './scope'

type Grade = (typeof GRADES)[number]
type Slot = (typeof SLOTS)[number]

export type CombatResult = 'win' | 'defeat' | 'stalemate'

// 선택지 combat과 start_combat 공통 필드(CONTENT_SCHEMA §4.2 combat)
export interface EventCombatSpec {
  enemies: ({ enemy_id: string } | { by_location: Record<string, string> } | { from_region_table: true })[]
  count: number | { when: unknown; count: number }[]
  sequential?: boolean
  first_strike?: 'char' | 'enemy' | 'default'
  ambush?: boolean
  pre_check?: { kind: string; dc_offset: number; on_fail: unknown[] }
  reward_mult?: number
}

export interface CombatPort {
  // 전투 1회를 끝까지 치르고 결과만 돌려준다(보상·패배 처리 포함, combat 흐름)
  fight(w: EventWorld, spec: EventCombatSpec, scope: EventScope): CombatResult
}

export interface ItemPort {
  // 장비를 주는 포트는 만든 인스턴스 uid를 돌려준다. register_relic의 this_item이 그 값을 쓴다(효과 목록 안에서만 유효)
  addItem(w: EventWorld, p: { item_id: string; grade?: Grade; to: 'bag' | 'pending_box' | 'bag_or_pending' }, scope: EventScope): string | null
  addRandomItem(
    w: EventWorld,
    p: { tier: 'location' | 'character' | number; grade_table?: string; grade_weights?: Partial<Record<Grade, number>>; slot?: Slot; exclude_cursed?: boolean },
    scope: EventScope,
  ): string | null
  // selector chosen_relic = scope.vars.relic_uid(offered_relic이 고른 유물)
  removeItem(w: EventWorld, p: { item_id?: string; selector?: 'chosen_relic' | 'highest_rare_relic' }, scope: EventScope): void
  addConsumable(w: EventWorld, p: { consumable_id?: string; tier?: 'current'; count: number }, scope: EventScope): void
  removeConsumable(w: EventWorld, p: { carry_groups: string[]; count: number }, scope: EventScope): void
  addMaterial(w: EventWorld, p: { material_id: string; count: number }, scope: EventScope): void
  openChest(w: EventWorld, scope: EventScope): string | null
  // this_item_uid = 같은 효과 목록에서 바로 앞 지급 효과가 만든 인스턴스(없으면 null)
  registerRelic(w: EventWorld, p: { selector: 'this_item' | 'uid'; priority: 1 | 2; this_item_uid: string | null }, scope: EventScope): void
  // 선택자 offered_relic: 헌납 후보 유물. 없으면 null
  offeredRelic(w: EventWorld): { uid: string; name: string; note: string } | null
}

export interface EconomyPort {
  offerPurchase(w: EventWorld, p: Record<string, unknown>, scope: EventScope): string | null
}

export interface InjuryPort {
  injure(w: EventWorld, p: { grade: 'light' | 'serious'; stat?: string }, scope: EventScope): void
  cure(w: EventWorld, p: { grade: 'light' | 'serious' | 'all' }, scope: EventScope): void
}

export interface LifePort {
  mutate(w: EventWorld, p: { trait_id: string }, scope: EventScope): void
  createPartner(w: EventWorld, scope: EventScope): void
  createChildCandidate(w: EventWorld, scope: EventScope): void
}

export interface SortiePort {
  // remaining_add·return_travel_sec_add·camp(이번 야영)는 출정 진행 구조(T8)가 가진다
  sortieMod(w: EventWorld, p: Record<string, unknown>, scope: EventScope): void
}

export interface DiscoveryPort {
  // 발견 지점 1개를 판정 없이 발견 처리(발견 효과·지도 조각·카운터). 고르는 것은 엔진이 한다
  reveal(w: EventWorld, discoveryId: string, scope: EventScope): void
}

export interface EventPorts {
  combat: CombatPort
  item: ItemPort
  economy: EconomyPort
  injury: InjuryPort
  life: LifePort
  sortie: SortiePort
  discovery: DiscoveryPort
}
