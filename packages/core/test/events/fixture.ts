// 사건 엔진 테스트용: 기반 팩(content/base) 번들과 가짜 포트.
import { fileURLToPath } from 'node:url'
import { validateContent } from '../../../content-kit/src/index'
import { Content, World, type ConditionTest, type SaveBody, type WorldOptions } from '../../src/index'
import { makeConditionTest, type CombatResult, type EventPorts, type EventScope, type EventWorld } from '../../src/events/index'

const baseDir = fileURLToPath(new URL('../../../../content/base', import.meta.url))
const result = validateContent([baseDir])
if (!result.bundle) throw new Error(`기반 팩 검증 실패: ${result.issues.map((i) => i.message).join('\n')}`)

export const baseContent = Content.fromBundle(result.bundle)

export const APPEARANCE = {
  body: 'body_base', hair: 'hair_short', hair_color: 'hair_chestnut', skin_tone: 'skin_02', decor: [], age_stage_override: null,
}

export const SEED = '9e3779b97f4a7c15'

export interface TestWorld {
  w: World
  scope: EventScope & { place: string | null; vars: Record<string, string> } // 바꿔 쓰는 평가 문맥
}

// World.test가 이 scope를 그대로 보므로, 테스트는 scope.place를 바꿔 장소를 옮긴다
export function makeWorld(seed = SEED, opts: WorldOptions = {}): TestWorld {
  const scope = { place: 'T00', vars: {} as Record<string, string> }
  let world: World | undefined
  const test: ConditionTest = (cond) => makeConditionTest(world!, scope)(cond)
  world = World.create(baseContent, {
    familyName: '조약돌', familySeed: seed, foundedUtc: 1789500000000,
    character: { name: '모라', background: 'bg_river', birthSeason: 'spring', appearance: APPEARANCE },
  }, { test, ...opts })
  return { w: world, scope }
}

export interface PortLog {
  calls: { port: string; args: unknown }[]
  combat: CombatResult
}

export type FakePorts = EventPorts & { log: PortLog }

// 모든 포트 호출을 기록만 한다(전투 결과는 log.combat으로 바꾼다)
export function fakePorts(log: PortLog = { calls: [], combat: 'win' }): FakePorts {
  const rec = (port: string) => (_w: EventWorld, args: unknown, _s?: EventScope) => void log.calls.push({ port, args })
  // 장비를 주는 포트는 uid를 돌려준다(register_relic this_item). 가짜 포트는 지급하지 않으므로 null
  const recItem = (port: string) => (_w: EventWorld, args: unknown, _s?: EventScope): string | null => {
    log.calls.push({ port, args })
    return null
  }
  return {
    log,
    combat: {
      fight: (_w, spec) => {
        log.calls.push({ port: 'combat.fight', args: spec })
        return log.combat
      },
    },
    item: {
      addItem: recItem('item.addItem'),
      addRandomItem: recItem('item.addRandomItem'),
      removeItem: rec('item.removeItem'),
      addConsumable: rec('item.addConsumable'),
      removeConsumable: rec('item.removeConsumable'),
      addMaterial: rec('item.addMaterial'),
      openChest: (_w, _s) => {
        log.calls.push({ port: 'item.openChest', args: null })
        return null
      },
      registerRelic: rec('item.registerRelic'),
      offeredRelic: () => ({ uid: 'it_000001', name: '달빛 목걸이', note: '' }),
    },
    economy: { offerPurchase: recItem('economy.offerPurchase') },
    injury: { injure: rec('injury.injure'), cure: rec('injury.cure') },
    life: {
      mutate: rec('life.mutate'),
      createPartner: (_w, _s) => void log.calls.push({ port: 'life.createPartner', args: null }),
      createChildCandidate: (_w, _s) => void log.calls.push({ port: 'life.createChildCandidate', args: null }),
    },
    sortie: { sortieMod: rec('sortie.sortieMod') },
    discovery: { reveal: (_w, id) => void log.calls.push({ port: 'discovery.reveal', args: id }) },
  }
}

type Sortie = NonNullable<SaveBody['current_activity']['sortie']>

// 출정 하나를 만든다(기본 사냥). scope.place도 함께 옮긴다
export function startSortie(tw: TestWorld, over: Partial<Sortie> = {}): Sortie {
  const sortie: Sortie = {
    id: 'so_00001', activity: 'hunt', location_id: 'H1', time_of_day: 'day', weather: 'clear', started_eff_min: 0,
    plan: { target_encounters: 8, safety_cap: 8 }, progress: 0, trip_flags: {}, temp_mods: [], dungeon_mods: [],
    quest_wins: null, loot: { coins: 0, item_uids: [], materials: {} }, potions_used: 0, events_this_sortie: 0,
    camps: 0, discovery_attempts: [], exclusive_used: [], fate_offered: false,
    ...over,
  }
  tw.w.state.current_activity.sortie = sortie
  tw.w.state.current_activity.state = 'hunt'
  tw.scope.place = sortie.location_id
  tw.w.state.character!.location = sortie.location_id
  return sortie
}
