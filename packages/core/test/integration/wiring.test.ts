// 규칙이 생산 경로에 붙어 있는지 보는 통합 테스트(단위 합격 ≠ 실행됨).
// 17 §4 검증에서 드러난 세 구멍을 고정한다: S06 발화, 흡혈귀 생애 종료 나이, 갈증 진행.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TOWN_STEPS } from '../../src/activity/index'
import { lifeEndDue } from '../../src/life/index'
import type { World } from '../../src/index'
import { makeGame, run } from './life-fixture'

// 01 §9.6 파산 조건을 만든다: 소지금 0, 회복약 0, 무기 없음
function makeBankrupt(world: World): void {
  const ch = world.state.character!
  ch.coins = 0
  world.state.inventory.consumables = {}
  world.state.inventory.equipped.weapon = null
  ch.counters.town_step = TOWN_STEPS.prep
  world.state.current_activity.state = 'town_idle'
}

describe('길드 지원 S06(01 §9.6, 08 §11)', () => {
  it('파산한 채 마을 정비를 끝내면 S06이 1회 발화하고 가문 플래그가 선다', () => {
    const world = makeGame({ seed: '0000000000006001', autoSuccession: false })
    const ch = world.state.character!
    makeBankrupt(world)
    // 마을 정비 행동 하나를 넘긴다
    for (let i = 0; i < 10 && ch.counters.town_step === TOWN_STEPS.prep; i++) world.advance(60)
    assert.equal(ch.event_counts.S06 ?? 0, 1, 'S06이 발화하지 않았다')
    assert.equal(ch.guild_aid.active, true)
    assert.equal(world.state.family.flags['fam.guild_aid'], true)
    assert.ok(world.state.journal.some((e) => e.line.includes('하델')), '지원 사건 문장이 없다')
  })
})

describe('흡혈귀 생애 종료(09 §7.6)', () => {
  it('은퇴 예정 나이를 넘겨도 끝나지 않고 긴 잠 나이에 끝난다', () => {
    const world = makeGame({ seed: '0000000000006002', autoSuccession: false })
    const ch = world.state.character!
    const time = world.content.balance.time
    ch.mutation = { trait_id: 'TM01', since_age: 60, long_sleep_age: 98, thirst: 0 }
    ch.eff_min = (69 - time.start_age) * time.min_per_year
    assert.equal(lifeEndDue(world), null)
    run(world, { steps: 30 })
    assert.equal(world.state.family.chronicle.length, 0, '68세 은퇴로 끝났다')
    assert.notEqual(world.state.current_activity.state, 'awaiting_succession')

    ch.mutation.thirst = 0
    ch.eff_min = (98 - time.start_age) * time.min_per_year
    run(world, { steps: 200, until: (w) => w.state.current_activity.state === 'awaiting_succession' })
    assert.equal(world.state.family.chronicle.at(-1)?.end_kind, 'long_sleep')
  })
})

describe('갈증(09 §7.5)', () => {
  it('출정을 돌면 갈증이 오른다', () => {
    const world = makeGame({ seed: '0000000000006003', autoSuccession: false })
    const ch = world.state.character!
    ch.mutation = { trait_id: 'TM01', since_age: 18, long_sleep_age: 98, thirst: 0 }
    run(world, { steps: 20 })
    assert.ok(ch.mutation.thirst > 0, `갈증이 0이다(${ch.mutation.thirst})`)
  })
})
