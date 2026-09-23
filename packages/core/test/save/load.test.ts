// 로드 검사(16 §7.1): 치명 K1~K7과 보정 B1~B15.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  bodyChecksum, canonicalJson, loadSave, makeSaveRoot, repairSave, SAVE_SCHEMA_VERSION, serializeSave,
  type Content, type SaveBody, type SaveRoot,
} from '../../src/index'
import { baseContent, makeGame } from '../offline/fixture'

const meta = {
  app_version: '0.1.0',
  saved_at_utc: 1_790_000_000_000,
  content_packs: [{ id: 'base', version: '0.1.0' }],
  content_hash: 'abc',
}

// 조금 굴려 둔 정상 저장(장비·일지·확정 결과가 있는 상태)
function goodSave(): { content: Content; root: SaveRoot; text: string } {
  const world = makeGame()
  world.advance(60 * 60)
  const root = makeSaveRoot(world.snapshot(), meta)
  return { content: world.content, root, text: serializeSave(root) }
}

// body를 고친 뒤 체크섬을 다시 맞춘 저장 본문
function resave(root: SaveRoot, edit: (body: SaveBody) => void): string {
  const copy = JSON.parse(canonicalJson(root)) as SaveRoot
  edit(copy.body)
  copy.header.checksum = bodyChecksum(copy.body)
  return canonicalJson(copy)
}

describe('치명 검사 K1~K7(16 §7.1)', () => {
  it('정상 저장은 통과하고 본문이 그대로 돌아온다', () => {
    const { content, root, text } = goodSave()
    const r = loadSave(text, content)
    assert.ok(r.ok)
    assert.equal(r.read_only, false)
    assert.deepEqual(r.migrated, [])
    assert.equal(r.root.body.family.family_id, root.body.family.family_id)
    assert.equal(r.root.header.checksum, root.header.checksum)
  })

  it('K1: JSON 해석 실패와 header·body 누락', () => {
    const { content, text } = goodSave()
    assert.equal(loadSave('{', content).ok, false)
    assert.equal((loadSave('{', content) as { code: string }).code, 'K1')
    assert.equal((loadSave('123', content) as { code: string }).code, 'K1')
    assert.equal((loadSave('{"body":{}}', content) as { code: string }).code, 'K1')
    assert.equal((loadSave('{"header":{}}', content) as { code: string }).code, 'K1')
    assert.ok(loadSave(text, content).ok)
  })

  it('K2: 체크섬 불일치', () => {
    const { content, root } = goodSave()
    const broken = JSON.parse(canonicalJson(root)) as SaveRoot
    broken.body.family.name = '다른이름'
    const r = loadSave(canonicalJson(broken), content)
    assert.equal(r.ok, false)
    assert.equal((r as { code: string }).code, 'K2')
  })

  it('K3: schema_version이 정수가 아니거나 이전 함수가 없다', () => {
    const { content, root } = goodSave()
    const bump = (v: unknown): string => {
      const copy = JSON.parse(canonicalJson(root)) as { header: Record<string, unknown> }
      copy.header.schema_version = v
      return canonicalJson(copy)
    }
    assert.equal((loadSave(bump('1'), content) as { code: string }).code, 'K3')
    assert.equal((loadSave(bump(1.5), content) as { code: string }).code, 'K3')
    assert.equal((loadSave(bump(0), content) as { code: string }).code, 'K3')
  })

  it('앱보다 높은 버전은 읽기 전용으로 연다(13 §8.7)', () => {
    const { content, root } = goodSave()
    const copy = JSON.parse(canonicalJson(root)) as { header: Record<string, unknown> }
    copy.header.schema_version = SAVE_SCHEMA_VERSION + 1
    const r = loadSave(canonicalJson(copy), content)
    assert.ok(r.ok)
    assert.equal(r.read_only, true)
  })

  it('K4: 필수 필드 누락', () => {
    const { content, root } = goodSave()
    const text = resave(root, (b) => {
      delete (b as { policies?: unknown }).policies
    })
    const r = loadSave(text, content)
    assert.equal(r.ok, false)
    assert.equal((r as { code: string }).code, 'K4')
    assert.match((r as { message: string }).message, /policies/)
  })

  it('K5: 정적 데이터에 없는 장소·특성 ID', () => {
    const { content, root } = goodSave()
    const gone = resave(root, (b) => {
      b.character!.location = 'ZZ99'
    })
    const r = loadSave(gone, content)
    assert.equal(r.ok, false)
    assert.equal((r as { code: string }).code, 'K5')
  })

  it('K6: 가방 uid가 item_instances에 없다', () => {
    const { content, root } = goodSave()
    const text = resave(root, (b) => {
      b.inventory.bag.push('it_999999')
    })
    const r = loadSave(text, content)
    assert.equal(r.ok, false)
    assert.equal((r as { code: string }).code, 'K6')
  })

  it('K7: pending_choice가 있는데 상태가 awaiting_choice가 아니다', () => {
    const { content, root } = goodSave()
    const text = resave(root, (b) => {
      b.pending_choice = {
        kind: 'fate',
        event_id: content.list('event')[0]!.id,
        presented_eff_min: 0,
        location: content.list('region')[0]!.id,
        choices_visible: [],
        excluded: [],
        pre_rolled: {},
        pre_chance: {},
        context: {},
        preview_rendered: {},
      }
      b.current_activity.state = 'town_idle'
    })
    const r = loadSave(text, content)
    assert.equal(r.ok, false)
    assert.equal((r as { code: string }).code, 'K7')
  })
})

describe('보정 검사 B1~B15(16 §7.1)', () => {
  const codesOf = (state: SaveBody, content = baseContent()): string[] =>
    repairSave(content, state).map((d) => d.code)

  it('B1·B3·B10: 능력치·피로·체력·소지금을 범위로 자른다', () => {
    const world = makeGame()
    const ch = world.state.character!
    ch.stats.str = 99
    ch.fatigue = 500
    ch.hp = -5
    ch.coins = -100
    const codes = codesOf(world.state, world.content)
    assert.ok(codes.includes('B1') && codes.includes('B3') && codes.includes('B10'))
    assert.equal(ch.stats.str, world.content.balance.stats.natural_cap)
    assert.equal(ch.fatigue, world.content.balance.stats.fatigue.max)
    assert.equal(ch.hp, 0)
    assert.equal(ch.coins, 0)
  })

  it('B2: 레벨 상한과 넘친 경험치', () => {
    const world = makeGame()
    const ch = world.state.character!
    ch.level = 999
    ch.xp = 10_000_000
    const codes = codesOf(world.state, world.content)
    assert.ok(codes.includes('B2'))
    assert.equal(ch.level, world.content.balance.xp.max_level)
  })

  it('B8: 경상 상한을 넘으면 중상 1개로 합친다', () => {
    const world = makeGame()
    const ch = world.state.character!
    const cap = world.content.balance.injury.light_cap
    for (let i = 0; i <= cap; i++) ch.injuries.push({ grade: 'light', stat: 'str', remaining_min: 10, source: 'test' })
    assert.ok(codesOf(world.state, world.content).includes('B8'))
    assert.equal(ch.injuries.filter((i) => i.grade === 'light').length, 0)
    assert.equal(ch.injuries.filter((i) => i.grade === 'serious').length, 1)
  })

  it('B6: 유품 지정 수·중복·priority', () => {
    const world = makeGame()
    const inv = world.state.inventory
    inv.relic_designations = [
      { uid: 'it_1', priority: 1 },
      { uid: 'it_1', priority: 2 },
      { uid: 'it_2', priority: 2 },
      { uid: 'it_3', priority: 1 },
    ]
    assert.ok(codesOf(world.state, world.content).includes('B6'))
    assert.equal(inv.relic_designations.length, world.content.balance.inheritance.relic_designations_max)
    assert.deepEqual(inv.relic_designations.map((d) => d.uid), ['it_1', 'it_2'])
  })

  it('B11: 은퇴 나이 상한', () => {
    const world = makeGame()
    world.state.character!.retire_age = 200
    assert.ok(codesOf(world.state, world.content).includes('B11'))
    assert.equal(world.state.character!.retire_age, world.content.balance.inheritance.lifespan.extend_cap)
  })

  it('B12: 시계 이상 기록은 최근 20개만', () => {
    const world = makeGame()
    for (let i = 0; i < 30; i++) world.state.offline_state.clock_anomalies.push({ kind: 'backward', now: i, hw: i })
    assert.ok(codesOf(world.state, world.content).includes('B12'))
    assert.equal(world.state.offline_state.clock_anomalies.length, 20)
    assert.equal(world.state.offline_state.clock_anomalies[0]!.now, 10, '오래된 것부터 지운다')
  })

  it('B13: 등록표에 없는 플래그 키는 보존하고 경고만 남긴다', () => {
    const world = makeGame()
    world.state.family.flags['fam.not_registered_key'] = true
    assert.ok(codesOf(world.state, world.content).includes('B13'))
    assert.equal(world.state.family.flags['fam.not_registered_key'], true, '보존해야 한다')
  })

  it('B14: 소모품 보유 한도', () => {
    const world = makeGame()
    const c = world.content.list('consumable')[0]!
    const limit = world.content.balance.economy.carry_limits[c.carry_group]!
    world.state.inventory.consumables[c.id] = limit + 10
    assert.ok(codesOf(world.state, world.content).includes('B14'))
    assert.equal(world.state.inventory.consumables[c.id], limit)
  })

  it('정상 저장은 보정이 걸리지 않는다', () => {
    const world = makeGame()
    world.advance(30 * 60)
    for (const d of repairSave(world.content, world.state)) {
      // 알려진 예외: activity/adventure.ts의 trip.forced_next_scene은 16 §5.2 등록표에 없다
      assert.ok(d.code === 'B13' && d.message.includes('forced_next_scene'), `${d.code}: ${d.message}`)
    }
  })
})
