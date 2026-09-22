import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { int, ratio } from '../../../src/schema/common'
import { enemyFamilySchema, enemySchema, enemySpecials, registerEnemySpecial } from '../../../src/schema/world/index'
import { clone, expectFail, expectOk, registerTestVocabulary } from './helpers'

registerTestVocabulary()
// 확장 모듈 흉내: 첫 파싱 전에 새 특수능력을 등록하면 데이터로만 쓸 수 있다
registerEnemySpecial('acid_spit', { chance: ratio, ac_add: int }, '확장 테스트용')

const lines = ['{enemy:이/가} 낮게 으르렁거렸다.', '{enemy:이/가} 언덕 너머에서 달려왔다.', '{enemy:이/가} 꼬리를 말고 물러났다.']

// 07 §4.1 EN04
const EN04 = {
  id: 'EN04', name: '잿빛 늑대', family: 'wolf', level: 15, rank: 'normal',
  hp: 42, ac: 15, hit: 7, damage: [3, 8], xp: 51, coins: 81, material_id: 'mat_EN04',
  specials: [{ kind: 'howl', check: 'fear', on_fail: [{ target: 'hit', op: 'add', value: -1 }] }],
  sprite_family: 'wolf', palette_id: 'wolf_ash', lines,
  victory_lines: ['잿빛 늑대의 울음이 멎었다.', '능선의 잿빛 늑대를 몰아냈다.'],
  exit_line: '한 번 더 울고 능선으로 사라진다.',
}

// 07 §4.1 EN07 어둠 방어(조건 파라미터)
const EN07 = {
  ...EN04, id: 'EN07', name: '그림자 박쥐', family: 'bat', level: 23, hp: 61, ac: 17, hit: 9, damage: [4, 11], xp: 75, coins: 220,
  material_id: 'mat_EN07',
  specials: [{ kind: 'dark_defense', ac_add: 1, when: { any: [{ time_of_day: 'night' }, { location_kind: ['dungeon_floor'] }] } }],
}

// 07 §4.3 EB02 갱도 흔들기(효과 파라미터)
const EB02 = {
  ...EN04, id: 'EB02', name: '늙은 광부장', family: 'kobold', level: 21, rank: 'elite', hp: 141, ac: 17, hit: 11,
  damage: [6, 13], xp: 172, coins: 435, material_id: 'mat_EB02',
  specials: [{
    kind: 'cave_shake', hp_thresholds: [0.6, 0.3], check: 'trap_evade', dc_offset: 0,
    fail: [{ type: 'damage', hp_ratio: 0.08 }], partial: [{ type: 'damage', hp_ratio: 0.04 }],
  }],
}

// 07 §4.4 EB03 단계
const EB03 = {
  ...EN04, id: 'EB03', name: '부서진 종의 파수꾼', family: 'unique', level: 29, rank: 'boss', hp: 373, ac: 21, hit: 14,
  damage: [8, 20], xp: 930, coins: 4330, material_id: 'mat_EB03', lethal: true,
  specials: [{
    kind: 'phases',
    phases: [
      { hp_above: 0.66, name: '종 울림',
        fear_check: { every_rounds: 3, dc_offset: 0, fail: [{ target: 'hit', op: 'add', value: -2 }],
          partial: [{ target: 'hit', op: 'add', value: -1 }], duration_rounds: 2 } },
      { hp_above: 0.33, name: '파편 비', attacks_per_round: 2, damage_mult: 0.6 },
      { hp_above: 0, name: '마지막 종소리', damage_mult: 1.3, ac_add: -2, fx: 'red_flash' },
    ],
  }],
}

describe('enemy: 정상', () => {
  it('EN04·EN07·EB02·EB03이 통과한다', () => {
    for (const e of [EN04, EN07, EB02, EB03]) expectOk(enemySchema, e)
  })

  it('lethal 기본값은 false', () => {
    assert.equal(expectOk(enemySchema, EN04).lethal, false)
  })

  it('확장 특수능력도 데이터로 쓸 수 있다', () => {
    expectOk(enemySchema, { ...EN04, specials: [{ kind: 'acid_spit', chance: 0.2, ac_add: -1 }] })
    assert.equal(enemySpecials.names().length, 14)
  })

  it('적 계열', () => {
    expectOk(enemyFamilySchema, { id: 'wolf', name: '늑대', sprite_family: 'wolf' })
    expectFail(enemyFamilySchema, { id: 'wolf', name: '늑대' })
  })
})

describe('enemy: 오류', () => {
  it('등록되지 않은 특수능력(16 예시의 pack_call)과 옛 note 필드', () => {
    expectFail(enemySchema, { ...EN04, specials: [{ kind: 'pack_call', chance: 0.15 }] })
    expectFail(enemySchema, { ...EN04, specials: [{ kind: 'screech', fatigue: 2, note: '07 문서가 확정' }] })
  })

  it('특수능력 파라미터 누락', () => {
    const paths = expectFail(enemySchema, { ...EN04, specials: [{ kind: 'howl', on_fail: [] }] })
    assert.deepEqual(paths, ['specials.0.check'])
  })

  it('적 행동 문장 3개 미만, 모르는 등급', () => {
    const e = clone(EN04) as Record<string, any>
    e.lines = lines.slice(0, 2)
    e.rank = 'champion'
    const paths = expectFail(enemySchema, e)
    assert.ok(paths.includes('lines'), paths.join())
    assert.ok(paths.includes('rank'), paths.join())
  })

  it('첫 파싱 뒤 특수능력 등록은 예외다', () => {
    expectOk(enemySchema, EN04)
    assert.throws(() => registerEnemySpecial('late_spit', { chance: z.number() }), /잠겼다/)
  })
})
