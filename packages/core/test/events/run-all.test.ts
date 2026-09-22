// 기반 팩 사건 전부를 가짜 포트로 실행해 예외가 없는지 본다(모든 선택지 · 모든 결과).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Event } from '../../src/index'
import {
  applyOccurrence, makeConditionTest, newEffectOutput, prepareOccurrence, runEffects, ruleContext,
  type EffectRun, type EventScope,
} from '../../src/events/index'
import { baseContent, fakePorts, makeWorld, startSortie, type TestWorld } from './fixture'

// 사건이 일어날 수 있는 장소 하나(없으면 사냥터)
function placeOf(ev: Event): string {
  if (ev.locations?.length) return ev.locations[0]!
  const m = ev.location_match
  const r = baseContent.list('region').find((x) => !m
    || ((!m.ids || m.ids.includes(x.id)) && (!m.kinds || m.kinds.includes(x.kind)) && (!m.tags || m.tags.some((t) => x.tags?.includes(t)))))
  return r?.id ?? 'H1'
}

// 어떤 사건이든 후보가 될 수 있는 인물(레벨·나이·소지금이 넉넉하고 줄기가 진행 중)
function ready(tw: TestWorld, place: string): void {
  const ch = tw.w.state.character!
  ch.level = 20
  ch.eff_min = 12 * 32 // 50세
  ch.coins = 5000
  ch.stats = { str: 6, dex: 6, kno: 6, wil: 6, soc: 6, luk: 4 }
  ch.hp = 200
  ch.location = place
  ch.flags['life.c01_stage'] = 2
  ch.flags['life.c02_stage'] = 2
  tw.w.state.family.generation = 2
  startSortie(tw, { location_id: place, activity: 'adventure' })
  tw.scope.place = place
}

describe('기반 팩 사건 실행(가짜 포트)', () => {
  const events = baseContent.list('event')

  for (const ev of events) {
    it(`${ev.id} 모든 선택지를 판정·적용한다`, () => {
      const place = placeOf(ev)
      for (const choice of ev.choices) {
        for (const dice of [20, 11, 1]) {
          for (const combat of ['win', 'defeat', 'stalemate'] as const) {
            if (!choice.combat && combat !== 'win') continue
            const tw = makeWorld()
            ready(tw, place)
            const ports = fakePorts({ calls: [], combat })
            const occ = prepareOccurrence(tw.w, ev.id, place, ports, { choiceId: choice.id })
            occ.dice[choice.id] = dice
            for (const key of Object.keys(occ.dice)) if (key !== choice.id) occ.dice[key] = dice
            const res = applyOccurrence(tw.w, occ, ports)
            assert.equal(res.event_id, ev.id)
            assert.ok(res.choice_id !== null)
            assert.ok(tw.w.state.character!.hp >= 1, '사건 피해로 체력이 1 아래로 내려가지 않는다')
          }
        }
      }
    })
  }

  for (const ev of events) {
    it(`${ev.id} 모든 결과의 효과를 적용한다`, () => {
      const place = placeOf(ev)
      for (const choice of ev.choices) {
        for (const [key, outcome] of Object.entries(choice.outcomes)) {
          if (!outcome) continue
          const tw = makeWorld()
          ready(tw, place)
          const ports = fakePorts()
          const scope: EventScope = { place, vars: { rumor_place: 'A1', target_place: 'H2', enemy: 'EN03', friend: '누리', relic_name: '유물', relic_note: '', relic_uid: 'it_000001' }, eventId: ev.id }
          const test = makeConditionTest(tw.w, scope)
          const run: EffectRun = {
            w: tw.w, ports, scope, test, rule: ruleContext(tw.w, test),
            pre: { dice: {}, chance: {} }, rewardMult: 1, out: newEffectOutput(),
          }
          runEffects(run, outcome.effects, `${choice.id}/${key}`)
          assert.ok(tw.w.state.character!.hp >= 1)
        }
      }
    })
  }
})
