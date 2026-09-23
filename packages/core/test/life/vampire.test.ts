import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { maxHp, statCap } from '../../src/index'
import {
  addThirst, applyBloodRest, applyMutation, atThirstLimit, autoDrinkDue, drinkThirstConsumable, longSleepAgeFor,
  longSleepDue, mutationSpec, nightRatio, thirst, thirstConsumable, thirstFromProgress, thirstOnSortieStart, thirstOnWin,
  thirstStage,
} from '../../src/life/index'
import { lifeWorld, setAge } from './fixture'

const VAMPIRE = 'TM01' // 기반 팩의 유일한 변이 특성(첫 검증판)

function vampire(seed?: string, age = 58) {
  const w = lifeWorld(seed !== undefined ? { seed } : {})
  const ch = w.state.character!
  ch.stats = { str: 4, dex: 4, kno: 3, wil: 3, soc: 2, luk: 2 }
  setAge(w, age)
  applyMutation(w, VAMPIRE)
  return w
}

describe('흡혈귀 변이 TM01(09 §7)', () => {
  it('변이 즉시 힘·민첩·의지 +1, 사교 −1과 긴 잠 나이를 정한다', () => {
    const w = vampire()
    const ch = w.state.character!
    assert.deepEqual([ch.stats.str, ch.stats.dex, ch.stats.wil, ch.stats.soc], [5, 5, 4, 1])
    assert.equal(ch.mutation!.long_sleep_age, 98) // min(68 + 30, 118)
    assert.equal(ch.mutation!.thirst, 0)
    assert.equal(ch.mutation!.since_age, 58)
  })

  it('힘·민첩 자연 상한이 9로 오르고 사교는 최저 1 아래로 내려가지 않는다', () => {
    const w = lifeWorld()
    const ch = w.state.character!
    ch.stats = { str: 8, dex: 8, kno: 3, wil: 8, soc: 1, luk: 2 }
    applyMutation(w, VAMPIRE)
    assert.equal(statCap(w, 'str'), 9)
    assert.equal(statCap(w, 'kno'), 8)
    assert.deepEqual([ch.stats.str, ch.stats.dex, ch.stats.wil, ch.stats.soc], [9, 9, 8, 1])
  })

  it('한 생애에 두 번 변이하지 않고, 최대 체력이 늘면 현재 체력도 따라 오른다', () => {
    const w = lifeWorld()
    const ch = w.state.character!
    ch.hp = maxHp(w)
    const before = maxHp(w)
    assert.equal(applyMutation(w, VAMPIRE), true)
    assert.equal(applyMutation(w, VAMPIRE), false)
    assert.ok(maxHp(w) > before)
    assert.equal(ch.hp, maxHp(w))
  })

  it('생명 연장(F02) 뒤 변이하면 긴 잠은 108세, 상한은 118세다(09 §7.6)', () => {
    const m = mutationSpec(vampire())!
    assert.equal(longSleepAgeFor(68, m), 98)
    assert.equal(longSleepAgeFor(78, m), 108)
    assert.equal(longSleepAgeFor(98, m), 118)
  })

  it('갈증 단계와 밤 출정 확률(09 §7.3·§7.5)', () => {
    const w = vampire()
    assert.equal(thirstStage(w)!.id, 'calm')
    assert.equal(nightRatio(w), 0.8)
    addThirst(w, 40)
    assert.equal(thirstStage(w)!.id, 'thirsty')
    const starving = addThirst(w, 30)
    assert.equal(thirstStage(w)!.id, 'starving')
    assert.equal(nightRatio(w), 1) // 굶주림부터 밤 100%
    assert.equal(starving.journal.length, 1)
    addThirst(w, 20)
    assert.equal(thirstStage(w)!.id, 'brink')
    addThirst(w, 20)
    assert.equal(thirst(w), 100)
    assert.equal(atThirstLimit(w), true)
    assert.equal(longSleepDue(w), 'thirst')
  })

  it('갈증 증감: 출정 분당 +2, 낮 출정 시작 +5, 밤 승리 −3, 정예·보스 −15', () => {
    const w = vampire()
    thirstFromProgress(w, 10)
    assert.equal(thirst(w), 20)
    thirstOnSortieStart(w, 'day')
    assert.equal(thirst(w), 25)
    thirstOnSortieStart(w, 'night')
    assert.equal(thirst(w), 25)
    thirstOnWin(w, { timeOfDay: 'night', rank: 'normal' })
    assert.equal(thirst(w), 22)
    thirstOnWin(w, { timeOfDay: 'day', rank: 'normal' })
    assert.equal(thirst(w), 22) // 낮 승리는 내리지 않는다
    thirstOnWin(w, { timeOfDay: 'day', rank: 'boss' })
    assert.equal(thirst(w), 7)
    addThirst(w, -100)
    assert.equal(thirst(w), 0) // 0 아래로 내려가지 않는다
  })

  it('피의 휴식은 중상만 치유하고 갈증 +20, 경상은 남는다(09 §7.4)', () => {
    const w = vampire()
    const ch = w.state.character!
    ch.injuries = [
      { grade: 'serious', stat: 'str', remaining_min: 10, source: 'test' },
      { grade: 'light', stat: 'dex', remaining_min: 5, source: 'test' },
    ]
    const r = applyBloodRest(w)
    assert.equal(r.cured, 1)
    assert.deepEqual(ch.injuries.map((i) => i.grade), ['light'])
    assert.equal(thirst(w), 20)
  })

  it('CP08은 갈증을 25 내리고, 자동 사용 기준은 출정 60·마을 40이다', () => {
    const w = vampire()
    const cp = thirstConsumable(w)!
    assert.equal(cp.amount, 25)
    addThirst(w, 45)
    assert.equal(autoDrinkDue(w, 'town'), true)
    assert.equal(autoDrinkDue(w, 'sortie'), false)
    assert.equal(drinkThirstConsumable(w).drank, false) // 소지분이 없다
    w.state.inventory.consumables[cp.id] = 2
    assert.equal(drinkThirstConsumable(w).drank, true)
    assert.equal(thirst(w), 20)
    assert.equal(w.state.inventory.consumables[cp.id], 1)
  })
})

// 09 §7.5 기대 흐름 표를 모형으로 돌려 본다: 출정 종류 비중 30/45/25, 시간대는 nightRatio,
// 마을에 들어올 때 CP08 자동 사용. 실제 출정 진행(T8)이 붙기 전까지의 모형 검증이다
interface SortieModel {
  minutes: number
  wins: number
  eliteBoss: number
}
const SORTIES: [number, SortieModel][] = [
  [30, { minutes: 10, wins: 9.5, eliteBoss: 0 }], // 사냥
  [45, { minutes: 7, wins: 1.5, eliteBoss: 0 }], // 모험
  [25, { minutes: 10, wins: 2.5, eliteBoss: 0.3 }], // 던전(관문 30%)
]

function runVampireLife(seed: string, opts: { moonWine: boolean; bloodRestEvery?: number }): { earlyByThirst: boolean; sleepAge: number } {
  const w = vampire(seed)
  const ch = w.state.character!
  const cp = thirstConsumable(w)!
  const rng = w.rng.world
  const time = w.content.balance.time
  let n = 0
  while (true) {
    n += 1
    const due = longSleepDue(w)
    if (due) return { earlyByThirst: due === 'thirst', sleepAge: ch.mutation!.long_sleep_age }
    const i = rng.weightedIndex(SORTIES.map(([weight]) => weight))
    const m = SORTIES[i]![1]
    const night = rng.chance(nightRatio(w))
    thirstOnSortieStart(w, night ? 'night' : 'day')
    thirstFromProgress(w, m.minutes)
    for (let k = 0; k < Math.round(m.wins); k++) thirstOnWin(w, { timeOfDay: night ? 'night' : 'day', rank: 'normal' })
    if (rng.chance(m.eliteBoss)) thirstOnWin(w, { timeOfDay: night ? 'night' : 'day', rank: 'boss' })
    ch.eff_min += m.minutes + 2 // 출정 + 마을
    // 중상이 잦으면 마을에서 피의 휴식을 되풀이한다(09 §7.5 갈증이 100에 닿는 경우)
    if (opts.bloodRestEvery && n % opts.bloodRestEvery === 0) {
      ch.injuries.push({ grade: 'serious', stat: 'str', remaining_min: 0, source: 'test' })
      applyBloodRest(w)
    }
    // 마을: 자동 구매가 켜져 있으면 한 병을 채워 두고 기준을 넘으면 마신다
    if (opts.moonWine) {
      w.state.inventory.consumables[cp.id] = 1
      if (autoDrinkDue(w, 'town')) drinkThirstConsumable(w)
    }
    if (ch.eff_min > (time.base_retire_age + 60 - time.start_age) * time.min_per_year) {
      return { earlyByThirst: false, sleepAge: ch.mutation!.long_sleep_age }
    }
  }
}

describe('흡혈귀 시나리오 20생애(17 §4 단계 5)', () => {
  it('정해진 긴 잠 나이는 20/20에서 min(은퇴 예정 + 30, 118)이고, 갈증 100으로 앞당겨진 생애는 4 이하다', () => {
    let early = 0
    for (let i = 0; i < 20; i++) {
      const r = runVampireLife(`00000000000000${i.toString(16).padStart(2, '0')}`, { moonWine: true })
      assert.equal(r.sleepAge, 98)
      if (r.earlyByThirst) early += 1
    }
    assert.ok(early <= 4, `갈증 100으로 앞당겨진 생애 ${early}/20`)
  })

  it('CP08 없이 피의 휴식이 잦으면 갈증 한계로 긴 잠이 앞당겨진다(09 §7.5)', () => {
    const r = runVampireLife('0123456789abcdef', { moonWine: false, bloodRestEvery: 2 })
    assert.equal(r.earlyByThirst, true)
    assert.equal(r.sleepAge, 98) // 정해진 시점은 그대로고, 실제 긴 잠만 앞당겨진다
  })
})
