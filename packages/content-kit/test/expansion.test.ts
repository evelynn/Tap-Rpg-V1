// 확장성 증명(T13): 기반 팩 위에 확장 팩(content/examples/mist-forest)만 얹어
// 코어 코드 수정 없이 검증을 통과하고, 실제로 돌아가는 세계에서 새 장소·새 사건이 나오는지 본다.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { Content, createGameWorld, createItemInstance, decideCandidates, maxHp, submitPendingAuto, type World } from '@tap/core'
import { validateContent } from '../src/validate/index'

const packDir = (name: string) => fileURLToPath(new URL(`../../../content/${name}`, import.meta.url))
const BASE = packDir('base')
const MIST = packDir('examples/mist-forest')

const APPEARANCE = { body: 'body_base', hair: 'HR03', hair_color: 'hair_chestnut', skin_tone: 'skin_02', decor: [], age_stage_override: null }

const result = validateContent([BASE, MIST])

// 검증을 통과한 번들로 실제 게임 세계를 만든다(코어는 팩이 아니라 번들만 읽는다)
function mistWorld(seed: string): World {
  const content = Content.fromBundle(result.bundle!)
  const world = createGameWorld(content, {
    familyName: '조약돌',
    familySeed: seed,
    foundedUtc: 1789500000000,
    character: { name: '모라', background: 'bg_river', birthSeason: 'spring', appearance: APPEARANCE },
  })
  const ch = world.state.character!
  // 확장 지역은 권장 레벨 10~18이다. 한 생애를 다 돌리는 대신 레벨만 올려 그 구간에서 시작한다
  ch.level = 14
  ch.stats = { str: 6, dex: 4, kno: 3, wil: 3, soc: 2, luk: 2 }
  // 레벨 기준 단계(3) 장비. 장비 단계가 낮으면 유효 레벨이 내려가 위험 상한(F7)에 걸린다
  for (const id of ['W06', 'A05']) {
    const inst = createItemInstance(content, world.state, id, 'common', { gen: 1, char_uid: ch.uid, age: 18, location: 'T00', source: 'test' })
    world.state.inventory.equipped[content.get('item', id).slot] = inst.uid
  }
  ch.hp = maxHp(world)
  return world
}

// 1분씩 흘린다. 선택 대기는 자동 선택 규칙으로 푼다(integration/life-fixture의 run과 같은 골격)
function run(world: World, steps: number): void {
  for (let i = 0; i < steps; i++) {
    if (world.state.pending_choice) {
      submitPendingAuto(world)
      continue
    }
    if (world.state.current_activity.state === 'awaiting_succession') break
    world.advance(60)
  }
}

// 번들 순서 = 팩 안 파일 경로 사전순(events/chain → events/life)
const MIST_EVENTS = ['MF_C01-1', 'MF_C01-2', 'MF_C01-3', 'MF_L01', 'MF_L02']

describe('확장 팩 — 코어 수정 0으로 검증 통과', () => {
  it('기반 + 확장을 함께 검사하면 오류·경고가 0이고 번들이 나온다', () => {
    assert.deepEqual(result.issues.map((i) => `${i.severity} ${i.code} ${i.pack}/${i.file}#${i.pointer}`), [])
    assert.ok(result.bundle)
    assert.deepEqual(result.bundle.packs.map((p) => p.id), ['base', 'mist_forest'])
  })

  it('새 정의가 기반 정의를 덮어쓰지 않고 더해진다', () => {
    const defs = result.bundle!.defs
    assert.deepEqual(Object.keys(defs.region!).filter((id) => id.startsWith('MF_')), ['MF_A1', 'MF_H1'])
    assert.deepEqual(Object.keys(defs.event!).filter((id) => id.startsWith('MF_')), MIST_EVENTS)
    assert.ok(defs.enemy!.MF_EN01 && defs.chain!.MF_C01 && defs.item!.MF_W01)
    // 기반 팩 정의는 한 줄도 바뀌지 않는다(이 팩은 patches를 쓰지 않는다)
    const base = validateContent([BASE]).bundle!.defs
    for (const [kind, byId] of Object.entries(base)) {
      for (const [id, def] of Object.entries(byId)) {
        assert.deepEqual((defs[kind as keyof typeof defs] as Record<string, unknown>)[id], def, `${kind} ${id}`)
      }
    }
  })

  it('번들을 코어 Content로 읽을 수 있다', () => {
    const content = Content.fromBundle(result.bundle!)
    assert.equal(content.get('region', 'MF_H1').kind, 'hunting_ground')
    assert.equal(content.get('enemy', 'MF_EN01').family, 'bat')
  })
})

describe('확장 팩 — 시뮬레이터에서 새 지역이 후보가 된다', () => {
  it('권장 레벨에 닿으면 MF_H1·MF_A1이 출정 후보에 오른다', () => {
    const world = mistWorld('0000000000004001')
    const ids = decideCandidates(world, false).cands.map((c) => c.id)
    assert.ok(ids.includes('MF_H1'), `후보: ${ids.join(',')}`)
    assert.ok(ids.includes('MF_A1'), `후보: ${ids.join(',')}`)
  })

  it('레벨이 낮으면 후보에 없다(unlock 조건이 걸린다)', () => {
    const world = mistWorld('0000000000004001')
    const ch = world.state.character!
    ch.level = 5
    assert.deepEqual(decideCandidates(world, false).cands.map((c) => c.id).filter((id) => id.startsWith('MF_')), [])
  })
})

describe('확장 팩 — 짧게 돌리면 새 장소를 방문하고 새 사건이 난다', () => {
  it('목적지를 MF_H1로 두고 돌리면 방문 기록과 확장 사건이 남는다', () => {
    const world = mistWorld('0000000000004001')
    world.state.policies.destination = 'MF_H1'
    run(world, 600)
    const ch = world.state.character!
    assert.ok(ch.visited.includes('MF_H1'), `방문: ${ch.visited.join(',')}`)
    const fired = MIST_EVENTS.filter((id) => (ch.event_counts[id] ?? 0) > 0)
    assert.deepEqual(fired, MIST_EVENTS, `난 사건: ${fired.join(',')}`)
    // 3단계 줄기가 끝까지 가고 고유 보상 장비가 실제로 들어온다
    assert.equal(world.state.family.flags['fam.mf_c01_done'], true)
    const defIds = Object.values(world.state.item_instances).map((i) => i.def_id)
    assert.ok(defIds.includes('MF_W01'), `장비: ${[...new Set(defIds)].join(',')}`)
    assert.ok(world.state.journal.some((e) => e.line === '반딧불이 붙은 가지를 받았다'))
  })

  it('MF_A1을 돌면 새 모험 경로의 발견 지점을 찾는다', () => {
    const world = mistWorld('0000000000004002')
    world.state.policies.destination = 'MF_A1'
    run(world, 600)
    const ch = world.state.character!
    assert.ok(ch.visited.includes('MF_A1'), `방문: ${ch.visited.join(',')}`)
    assert.ok(ch.discoveries.some((d) => d.startsWith('MF_A1-')), `발견: ${ch.discoveries.join(',')}`)
  })
})
