// 효과 실행기 56종(16 §4.3, CONTENT_SCHEMA §4.2). 상태 변화와 포트 호출을 본다.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { effects, type Effect } from '../../src/index'
import {
  makeConditionTest, newEffectOutput, runEffects, ruleContext,
  type EffectOutput, type EffectRun, type EventScope,
} from '../../src/events/index'
import { fakePorts, makeWorld, startSortie, type FakePorts, type TestWorld } from './fixture'

interface Applied {
  tw: TestWorld
  out: EffectOutput
  ports: FakePorts
}

function apply(list: Effect[], setup?: (tw: TestWorld) => void, place = 'H1'): Applied {
  const tw = makeWorld()
  tw.scope.place = place
  tw.w.state.character!.location = place
  tw.scope.vars = { rumor_place: 'A1', target_place: 'H2', enemy: 'EN03' }
  startSortie(tw, { location_id: place })
  setup?.(tw)
  const ports = fakePorts()
  const scope: EventScope = { place, vars: tw.scope.vars, eventId: 'L01' }
  const test = makeConditionTest(tw.w, scope)
  const run: EffectRun = {
    w: tw.w, ports, scope, test, rule: ruleContext(tw.w, test), pre: { dice: {}, chance: {} }, rewardMult: 1, out: newEffectOutput(),
  }
  runEffects(run, list, 'c/always')
  return { tw, out: run.out, ports }
}

const ch = (a: Applied) => a.tw.w.state.character!
const called = (a: Applied, port: string) => a.ports.log.calls.some((c) => c.port === port)

describe('효과 실행기', () => {
  it('자원: 동전·경험치·체력·피로', () => {
    // H1 동전 단위 7, 경험치 단위 12(10 §6.1)
    const a = apply([{ type: 'add_coins', units: 2 }, { type: 'add_xp', units: 1 }, { type: 'add_fatigue', value: 10 }])
    assert.equal(ch(a).coins - 30, 14) // 시작 동전 30
    assert.equal(ch(a).xp, 12)
    assert.equal(ch(a).fatigue, 10)
    const b = apply([{ type: 'remove_coins', amount: 5 }, { type: 'heal', hp_ratio: 1 }, { type: 'add_fatigue', value: -99 }])
    assert.equal(ch(b).coins, 25)
    assert.equal(ch(b).fatigue, 0)
  })

  it('remove_coins: 소지금 아래로 내려가지 않고 여관비·출정 수입 비율을 읽는다', () => {
    const a = apply([{ type: 'remove_coins', ratio: 2 }])
    assert.equal(ch(a).coins, 0)
    const b = apply([{ type: 'remove_coins', inn_costs: 1 }]) // 5 + 2 × 레벨 1 = 7
    assert.equal(ch(b).coins, 23)
    const c = apply([{ type: 'remove_coins', sortie_income_ratio: 0.5 }], (tw) => {
      tw.w.state.current_activity.sortie!.loot.coins = 10
    })
    assert.equal(ch(c).coins, 25)
  })

  it('damage는 체력을 1 아래로 내리지 않는다(V9 핸들러 계약)', () => {
    const a = apply([{ type: 'damage', hp_ratio: 0.9 }, { type: 'damage', hp: 999 }, { type: 'damage', dice: '2d6+1' }])
    assert.equal(ch(a).hp, 1)
  })

  it('부상·생애 능력치·특성', () => {
    const a = apply([
      { type: 'injury', grade: 'light', stat: 'dex' },
      { type: 'cure_injury', grade: 'all' },
      { type: 'life_stat_add', stat: 'luk', value: -2 },
      { type: 'add_trait', trait_id: 'TA01' },
    ])
    assert.ok(called(a, 'injury.injure') && called(a, 'injury.cure'))
    assert.equal(ch(a).life_stat_mods.length, 1)
    assert.ok(ch(a).traits.some((t) => t.id === 'TA01'))
    assert.ok(a.out.journal.some((d) => d.tag === 'trait'))
    const b = apply([{ type: 'add_trait', trait_id: 'TA07' }], (tw) => {
      tw.w.state.character!.traits = [{ id: 'TI07', since_age: 18, source: 'new' }]
    })
    assert.equal(ch(b).traits.find((t) => t.id === 'TI07')!.inactive, 'replaced') // TA07이 TI07을 대체(06)
    const c = apply([{ type: 'remove_trait', trait_id: 'TI07' }], (tw) => {
      tw.w.state.character!.traits = [{ id: 'TI07', since_age: 18, source: 'new' }]
    })
    assert.equal(ch(c).traits.length, 0)
  })

  it('물건·경제 효과는 포트로 간다', () => {
    const a = apply([
      { type: 'add_item', item_id: 'W02', to: 'bag' },
      { type: 'add_random_item', tier: 'location', grade_table: 'field' },
      { type: 'remove_item', item_id: 'W02' },
      { type: 'add_consumable', consumable_id: 'CP01', count: 1 },
      { type: 'remove_consumable', carry_groups: ['ration'], count: 1 },
      { type: 'add_material', material_id: 'mat_forage', count: 1 },
      { type: 'open_chest' },
      { type: 'register_relic', selector: 'this_item', priority: 1 },
      { type: 'offer_purchase', pool: { facilities: ['general_store'], slots: ['weapon'] }, tier: 'character', grade_weights: { common: 1 }, price_mult: 0.8 },
      { type: 'mutate', trait_id: 'TM01' },
      { type: 'create_partner' },
      { type: 'create_child_candidate' },
      { type: 'sortie_mod', camp: { fatigue_add: 20 } },
    ])
    for (const port of [
      'item.addItem', 'item.addRandomItem', 'item.removeItem', 'item.addConsumable', 'item.removeConsumable', 'item.addMaterial',
      'item.openChest', 'item.registerRelic', 'economy.offerPurchase', 'life.mutate', 'life.createPartner', 'life.createChildCandidate',
      'sortie.sortieMod',
    ]) assert.ok(called(a, port), port)
  })

  it('전문화·수명 연장', () => {
    const a = apply([{ type: 'specialize', spec: 'guardian' }])
    assert.equal(ch(a).specialization, 'guardian')
    const b = apply([{ type: 'extend_lifespan', years: 10 }])
    assert.equal(ch(b).retire_age, 78)
    assert.equal(ch(b).lifespan_extended, true)
  })

  it('플래그·카운터·연속 사건', () => {
    const a = apply([
      { type: 'set_flag', key: 'life.l01_marked_{place}' },
      { type: 'set_family_flag', key: 'fam.c01_rescue' },
      { type: 'set_trip_flag', key: 'trip.fear', remaining: { encounters: 2 } },
      { type: 'counter_add', key: 'safe_returns', value: 1, where: '{place}' },
      { type: 'advance_chain', chain_id: 'C01', stage: 1 },
    ])
    assert.equal(ch(a).flags['life.l01_marked_H1'], true)
    assert.equal(a.tw.w.state.family.flags['fam.c01_rescue'], true)
    assert.equal(a.tw.w.state.family.flag_meta['fam.c01_rescue']!.set_gen, 1)
    assert.deepEqual(a.tw.w.state.current_activity.sortie!.trip_flags['trip.fear'], { value: true, remaining: { encounters: 2 } })
    assert.equal(ch(a).counters.safe_returns, 1)
    assert.equal(ch(a).counters_at.safe_returns!.H1, 1)
    assert.equal(ch(a).flags['life.c01_stage'], 1)

    const b = apply([{ type: 'end_chain', chain_id: 'C01', outcome: 'rescue' }], (tw) => {
      tw.w.state.family.flags['fam.c01_unfinished'] = 2
    })
    assert.equal(ch(b).flags['life.c01_stage'], 3)
    assert.equal(b.tw.w.state.family.flags['fam.c01_done'], true)
    assert.equal(b.tw.w.state.family.flags['fam.c01_rescue'], true)
    assert.equal(b.tw.w.state.family.flags['fam.c01_unfinished'], undefined)

    const c = apply([{ type: 'clear_flag', key: 'life.l01_marked_{place}' }, { type: 'clear_trip_flag', key: 'trip.fear' }], (tw) => {
      tw.w.state.character!.flags['life.l01_marked_H1'] = true
      tw.w.state.current_activity.sortie!.trip_flags['trip.fear'] = { value: true, remaining: null }
    })
    assert.equal(ch(c).flags['life.l01_marked_H1'], undefined)
    assert.deepEqual(c.tw.w.state.current_activity.sortie!.trip_flags, {})
  })

  it('진행·장소: 해금·목적지·의뢰·일시 수정자·던전 조작·예약', () => {
    const a = apply([
      { type: 'unlock_location', location_id: 'H2' },
      { type: 'set_destination', place_var: 'target_place', scope: 'next_sortie' },
      { type: 'temp_mod', modifier: { target: 'location_score.{rumor_place}', op: 'add', value: 15 }, scope: 'next_decision' },
      { type: 'temp_mod', modifier: { target: 'discovery_chance_mult', op: 'mul', value: 2 }, scope: 'next_visit', location: '{rumor_place}' },
      { type: 'dungeon_mod', op: 'add_room', room_kind: 'treasure', count: 1, scope: 'this_sortie' },
      { type: 'add_time', sec: 30 },
      { type: 'shop_discount', ratio: 0.05, uses: 1, facility: 'general_store' },
      { type: 'schedule_event', event_id: 'L05', at: 'next_town_return' },
      { type: 'end_sortie', reason: 'event' },
    ])
    assert.ok(a.tw.w.state.family.discovered_locations.includes('H2'))
    assert.equal(a.tw.w.state.current_activity.next_sortie_override!.location_id, 'H2')
    assert.equal(ch(a).temp_mods[0]!.modifier.target, 'location_score.A1')
    assert.equal(ch(a).next_visit_mods.A1!.length, 1)
    assert.equal(a.tw.w.state.current_activity.sortie!.dungeon_mods.length, 1)
    assert.equal(a.out.addSec, 30)
    assert.equal(ch(a).shop_discounts.length, 1)
    assert.equal(ch(a).scheduled_events[0]!.event_id, 'L05')
    assert.equal(a.out.endSortie, 'event')

    const b = apply([{
      type: 'accept_quest', quest: 'L06', location_var: 'target_place', enemy_var: 'enemy', goal_wins: 5,
      deadline: 'next_sortie', reward: { coin_units: 3, xp_units: 3 }, settle: 'ratio_floor', cancel_on: 'serious_injury',
      lines: { complete: '끝냈다', partial: '반만 했다', cancel: '접었다' },
    }])
    assert.equal(ch(b).quest!.enemy_id, 'EN03')
  })

  it('흐름: if·chance·roll_check·start_combat·on_town_return·reopen_choices', () => {
    const a = apply([
      { type: 'if', cond: { level_gte: 1 }, then: [{ type: 'add_coins', amount: 5 }], else: [{ type: 'add_coins', amount: 100 }] },
      { type: 'chance', p: 1, then: [{ type: 'add_coins', amount: 1 }] },
      { type: 'roll_check', check: { kind: 'forage', dc_offset: 0 }, success: [{ type: 'add_coins', amount: 2 }], failure: [{ type: 'add_fatigue', value: 1 }] },
      { type: 'start_combat', enemies: [{ enemy_id: 'EN01' }], count: 1, on_win: [{ type: 'add_coins', amount: 3 }] },
      { type: 'on_town_return', effects: [{ type: 'add_coins', amount: 7 }], line: '마을에서 받았다' },
      { type: 'reopen_choices', exclude: ['ask'] },
    ])
    assert.equal(ch(a).coins, 30 + 5 + 1 + 3 + (a.out.journal.some((d) => d.check && d.check.result === 'success') ? 2 : 0))
    assert.ok(called(a, 'combat.fight'))
    assert.equal(a.tw.w.state.current_activity.pending_town_effects.length, 1)
    assert.deepEqual(a.out.reopen, { exclude: ['ask'], situational: [] })
  })

  it('기록·관계·연출', () => {
    const a = apply([
      { type: 'npc_relation', npc_id: 'N01', delta: 5 },
      { type: 'skill_use', skill: 'lowest_rank', count: 2 },
      { type: 'family_record', kind: 'chronicle', key: 'k', text: '{name:이/가} 다리를 고쳤다.' },
      { type: 'unlock_family', kind: 'background', id: 'bg_miner' },
      { type: 'journal', tag: 'trait', line: '한마디 남겼다' },
      { type: 'animation', action: 'cheer', props: ['book'] },
    ])
    assert.equal(ch(a).npc_relations.N01, 5)
    assert.ok(Object.values(ch(a).skills).some((s) => s.uses > 0))
    // 연대기 문장은 상세에, 한 줄은 14 §5.1 [가문] 문형
    assert.ok(a.out.journal.some((d) => d.tag === 'house' && d.line === '가문 연대기에 새 장이 열렸다' && d.detail === '모라가 다리를 고쳤다.' && d.importance === 'family'))
    assert.ok(a.tw.w.state.family.unlocks.backgrounds.includes('bg_miner'))
    assert.deepEqual(a.out.animations, [{ action: 'cheer', props: ['book'] }])
  })

  it('when이 거짓인 효과는 건너뛴다', () => {
    const a = apply([{ type: 'add_coins', amount: 100, when: { has_trait: 'TI08' } }])
    assert.equal(ch(a).coins, 30)
  })

  it('적용 순서: 보상 → 특성 → 생애 플래그 → 가문 플래그 → 기록 → 연출(10 §9.1)', () => {
    const a = apply([
      { type: 'animation', action: 'cheer' },
      { type: 'journal', tag: 'hunt', line: '기록' },
      { type: 'set_family_flag', key: 'fam.c01_rescue' },
      { type: 'set_flag', key: 'life.c01_map_read' },
      { type: 'add_trait', trait_id: 'TA01' },
      { type: 'add_coins', amount: 1 },
    ])
    // 기록 초안은 특성 획득(특성 단계) → journal(기록 단계) 순서로 쌓인다
    assert.deepEqual(a.out.journal.map((d) => d.tag), ['trait', 'hunt'])
  })

  it('모든 효과에 실행 핸들러가 있고, 체력 1인 인물에게 적용해도 1 아래로 내려가지 않는다', () => {
    const sample: Record<string, Effect> = {
      damage: { type: 'damage', hp: 50 },
      add_fatigue: { type: 'add_fatigue', value: 100 },
      heal: { type: 'heal', hp: 1 },
    }
    for (const name of effects.names()) {
      if (!sample[name]) continue
      const a = apply([sample[name]!], (tw) => { tw.w.state.character!.hp = 1 })
      assert.ok(ch(a).hp >= 1, name)
    }
  })
})
