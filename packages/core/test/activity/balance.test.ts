// 태도별 행동 차이와 출정 길이(17 §4 단계 2·3), 파산 시나리오(01 §9.6).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { submitPendingAuto } from '../../src/activity/index'
import { aidEndCoins } from '../../src/economy/index'
import { maxHp } from '../../src/rules/index'
import { baseContent, makeSim, runMinutes } from './fixture'

const ACTIVITIES = ['hunt', 'adventure', 'dungeon'] as const
const ATTITUDES = ['stable', 'adventurous', 'challenging']
const LIVES = 12
const share = (v: Record<string, number>): number[] => {
  const total = ACTIVITIES.reduce((s, a) => s + (v[a] ?? 0), 0)
  return ACTIVITIES.map((a) => (100 * (v[a] ?? 0)) / Math.max(1, total))
}

describe('태도별 행동 차이(17 §4 단계 3)', () => {
  for (const attitude of ATTITUDES) {
    it(`${attitude}의 활동 비중이 01 §7.1 가중치 언저리다`, () => {
      const time: Record<string, number> = {}
      const count: Record<string, number> = {}
      for (let i = 0; i < LIVES; i++) {
        const r = runMinutes(makeSim({ attitude, seed: (0x7000 + i).toString(16).padStart(16, '0') }), 600)
        for (const [k, v] of Object.entries(r.byActivity)) time[k] = (time[k] ?? 0) + v
        for (const [k, v] of Object.entries(r.sorties)) count[k] = (count[k] ?? 0) + v
      }
      const att = baseContent().get('attitude', attitude)
      const w = ACTIVITIES.map((a) => att.activity_weights[a])
      const sum = w.reduce((a, b) => a + b, 0)
      const want = w.map((x) => (100 * x) / sum)
      const got = share(count)
      console.log(`${attitude} 횟수 ${got.map((x) => x.toFixed(1)).join('/')} 시간 ${share(time).map((x) => x.toFixed(1)).join('/')} 목표 ${want.join('/')}`)
      ACTIVITIES.forEach((a, i) => {
        assert.ok(Math.abs(got[i]! - want[i]!) <= 15, `${attitude} ${a} ${got[i]!.toFixed(1)}% (목표 ${want[i]}%)`)
      })
    })
  }

  it('출정 길이 중앙값이 5~15분이다(04 §1)', () => {
    for (const attitude of ATTITUDES) {
      const lens: number[] = []
      for (let i = 0; i < LIVES; i++) lens.push(...runMinutes(makeSim({ attitude, seed: (0x7100 + i).toString(16).padStart(16, '0') }), 600).lengths)
      lens.sort((a, b) => a - b)
      const median = lens[Math.floor(lens.length / 2)]!
      assert.ok(median >= 5 && median <= 15, `${attitude} 중앙값 ${median.toFixed(1)}분`)
    }
  })
})

describe('파산과 길드 지원(01 §9.6, 04 §4.2 F3)', () => {
  it('파산 시드 5개에서 지원이 시작·종료되고 지원 중 활동이 제한된다', () => {
    for (const level of [3, 8, 14, 20, 26]) {
      const world = makeSim({ seed: (0x8000 + level).toString(16).padStart(16, '0') })
      const ch = world.state.character!
      ch.level = level
      ch.coins = 0
      world.state.inventory.consumables = {}
      // 무기를 잃고 빈털터리가 된 상태(01 §9.6 파산 조건: 소지금 20 미만 + 회복약 0 또는 무기 단계 부족)
      world.state.inventory.equipped.weapon = null
      ch.hp = maxHp(world)
      let started = false
      let ended = false
      let offLimits = 0
      let lastSortie: string | null = null
      for (let i = 0; i < 600; i++) {
        world.advance(60)
        if (world.state.pending_choice) submitPendingAuto(world)
        if (ch.guild_aid.active) started = true
        if (started && !ch.guild_aid.active && ch.guild_aid.recovered) ended = true
        const s = world.state.current_activity.sortie
        if (s && s.id !== lastSortie) {
          lastSortie = s.id
          if (ch.guild_aid.active && !world.content.get('region', s.location_id).aid_allowed) offLimits++
        }
        if (ended) break
      }
      assert.ok(started, `레벨 ${level} 지원 시작 안 됨`)
      assert.equal(offLimits, 0, `레벨 ${level} 지원 중 허용되지 않은 장소 ${offLimits}회`)
      console.log(`레벨 ${level} 지원 종료 ${ended} 소지금 ${ch.coins} 종료선 ${aidEndCoins(world).toFixed(0)}`)
      // 높은 레벨은 지원 중 갈 수 있는 곳(H1·H2·A1)의 수입이 종료선에 못 미쳐 600분 안에 끝나지 않는다(보고 대상)
      if (level <= 20) assert.ok(ended, `레벨 ${level} 지원 종료 안 됨`)
    }
  })
})
