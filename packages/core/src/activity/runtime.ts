// 세계마다 저장에 자리가 없는 활동 상태(상점 재고)와 생애 종료 통보를 든다(I44).
import { emptyShopState, type ShopState } from '../economy/index'
import type { END_KINDS } from '../schema/index'
import type { World } from '../sim/world'

export type EndKind = (typeof END_KINDS)[number]

export interface ActivityRuntime {
  shop: ShopState
  // 생애 종료(은퇴·사망·긴 잠)는 생애·계승(T10)이 가져간다. 없으면 마을 대기로 남는다
  onLifeEnd: ((world: World, kind: EndKind) => void) | null
  // 시스템 사건 발화(10 §3.3 단계). 변형 선택지를 고르는 규칙이 T10에 있어 여기서는 부르기만 한다
  onSystemPhase: ((world: World, phase: string) => void) | null
  lifeEnded: boolean
}

const RUNTIMES = new WeakMap<World, ActivityRuntime>()

export function runtimeOf(world: World): ActivityRuntime {
  let rt = RUNTIMES.get(world)
  if (!rt) {
    rt = { shop: emptyShopState(), onLifeEnd: null, onSystemPhase: null, lifeEnded: false }
    RUNTIMES.set(world, rt)
  }
  return rt
}

export function configureActivity(world: World, over: Partial<ActivityRuntime>): ActivityRuntime {
  return Object.assign(runtimeOf(world), over)
}
