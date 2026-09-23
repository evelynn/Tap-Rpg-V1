// 오프라인 정산 테스트 도우미: 정산 앞에 세계를 원하는 지점까지 온라인으로 굴려 둔다.
import {
  ageAt, loadGameWorld, makeSaveRoot, serializeSave, stageBoundaries, submitPendingAuto, type SaveBody, type World,
} from '../../src/index'
import { baseContent, makeGame } from '../integration/life-fixture'

export { baseContent, makeGame }

export const seedOf = (n: number): string => (0x5000 + n).toString(16).padStart(16, '0')

export const ageOf = (world: World): number => ageAt(world.state.character!.eff_min, world.content.balance.time)

export const boundariesOf = (world: World): readonly number[] => stageBoundaries(world.content)

// 온라인으로 minutes분 굴린다. 선택 대기는 자동 선택으로 풀어 정산 시작점을 깨끗하게 만든다
export function warm(world: World, minutes: number): void {
  for (let i = 0; i < minutes; i++) {
    if (world.state.pending_choice) submitPendingAuto(world)
    if (!world.clockRunning) return
    world.advance(60)
  }
}

// 저장 → 직렬화 → 로드 → 세계 복원(13 §8.2). 확정 결과가 그대로 살아 있는지 보는 통로다
export function roundTrip(world: World, savedAtUtc = 1790000000000): World {
  const root = makeSaveRoot(world.snapshot(), {
    app_version: '0.1.0',
    saved_at_utc: savedAtUtc,
    content_packs: [{ id: 'base', version: '0.1.0' }],
    content_hash: 'test',
  })
  const text = serializeSave(root)
  const parsed = JSON.parse(text) as { body: SaveBody }
  return loadGameWorld(world.content, parsed.body)
}
