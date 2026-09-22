// 13 §8.3 "행동 시작 때 결과를 확정한다" — reopen_choices로 다시 열리는 선택지의 주사위도 확정 단계에서 굴린다.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { validateContent } from '../../../content-kit/src/index'
import { Content, World, type ConditionTest, type RawDefs } from '../../src/index'
import { applyOccurrence, makeConditionTest, prepareOccurrence, type EventScope } from '../../src/events/index'
import { fakePorts, APPEARANCE, SEED } from './fixture'

const baseDir = fileURLToPath(new URL('../../../../content/base', import.meta.url))

// 두 선택지 모두 판정이 있고, 첫 선택지는 자기를 빼고 창을 다시 연다
const choice = (id: string, reopen: boolean) => ({
  id,
  label: id,
  short: id,
  risk: 'none',
  tags: ['safe'],
  check: { kind: 'forage' },
  outcomes: {
    success: { effects: reopen ? [{ type: 'reopen_choices', exclude: [id] }] : [], line: `${id} 성공` },
    failure: { effects: reopen ? [{ type: 'reopen_choices', exclude: [id] }] : [], line: `${id} 실패` },
  },
})

const REOPEN_EVENT = {
  id: 'ZZ_REOPEN',
  name: '되열기 시험',
  category: 'life',
  locations: ['H1'],
  triggers: ['after_encounter'],
  condition: true,
  weight: 1,
  allow_serious_injury: false,
  hold: 'none',
  intro: { lines: ['시험 사건이 일어났다', '또 시험 사건이 일어났다'], tag: 'hunt' },
  choices: [choice('first', true), choice('second', false)],
}

function worldWithEvent(): World {
  const bundle = validateContent([baseDir]).bundle!
  const defs = { ...bundle.defs, event: { ...bundle.defs.event, ZZ_REOPEN: REOPEN_EVENT } } as RawDefs
  const content = Content.fromBundle({ format: bundle.format, defs })
  const scope: EventScope & { place: string | null } = { place: 'H1', vars: {} }
  let world: World | undefined
  const test: ConditionTest = (cond) => makeConditionTest(world!, scope)(cond)
  world = World.create(content, {
    familyName: '조약돌', familySeed: SEED, foundedUtc: 1789500000000,
    character: { name: '모라', background: 'bg_river', birthSeason: 'spring', appearance: APPEARANCE },
  }, { test })
  world.state.character!.location = 'H1'
  return world
}

describe('reopen_choices 확정 시점', () => {
  it('다시 열릴 수 있는 선택지의 주사위까지 확정 단계에서 미리 굴린다', () => {
    const w = worldWithEvent()
    const occ = prepareOccurrence(w, 'ZZ_REOPEN', 'H1', fakePorts(), { choiceId: 'first' })
    assert.deepEqual(Object.keys(occ.dice).sort(), ['first', 'second'])
  })

  it('다시 고른 선택지는 미리 굴린 주사위를 쓴다(적용 단계에서 다시 굴리지 않는다)', () => {
    const w = worldWithEvent()
    const occ = prepareOccurrence(w, 'ZZ_REOPEN', 'H1', fakePorts(), { choiceId: 'first' })
    const before = w.rng.event.toState()
    const res = applyOccurrence(w, occ, fakePorts())
    assert.equal(res.choice_id, 'second')
    assert.equal(res.check!.dice, occ.dice.second)
    assert.deepEqual(w.rng.event.toState(), before, '적용 단계는 event 흐름을 쓰지 않는다')
  })
})
