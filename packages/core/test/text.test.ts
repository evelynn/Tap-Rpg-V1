import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderTemplate, templateVars } from '../src/text/index'

describe('문장 템플릿: 14 §6 예시', () => {
  const cases: [string, string, Record<string, string | number>, string][] = [
    ['리아', '{name:이/가} 떠났다', { name: '리아' }, '리아가 떠났다'],
    ['아린', '{name:은/는} 웃었다', { name: '아린' }, '아린은 웃었다'],
    ['레벨 2', '레벨 {level:이/가} 되었다', { level: 2 }, '레벨 2가 되었다'],
    ['레벨 10', '레벨 {level:이/가} 되었다', { level: 10 }, '레벨 10이 되었다'],
    ['광재 골짜기', '{place:으로/로} 떠났다', { place: '광재 골짜기' }, '광재 골짜기로 떠났다'],
    ['종소리 폐광 상층', '{place:으로/로} 떠났다', { place: '종소리 폐광 상층' }, '종소리 폐광 상층으로 떠났다'],
    ['Neil', '{name:이/가} 떠났다', { name: 'Neil' }, 'Neil이 떠났다'],
    ['Kate', '{name:을/를} 불렀다', { name: 'Kate' }, 'Kate를 불렀다'],
    ['Rick', '{name:이/가} 떠났다', { name: 'Rick' }, 'Rick이(가) 떠났다'],
    // 6항 으로/로 예
    ['늑대 언덕', '{place:으로/로}', { place: '늑대 언덕' }, '늑대 언덕으로'],
    ['여울가 풀밭', '{place:으로/로}', { place: '여울가 풀밭' }, '여울가 풀밭으로'],
    ['마을', '{place:으로/로}', { place: '마을' }, '마을로'],
    ['폐광 심층', '{place:으로/로}', { place: '폐광 심층' }, '폐광 심층으로'],
  ]
  for (const [label, tpl, values, expected] of cases) {
    it(label, () => assert.equal(renderTemplate(tpl, values), expected))
  }

  it('01 §18.5 예', () => {
    assert.equal(
      renderTemplate('{name:이/가} {item:을/를} 내려놓았다.', { name: '리아', item: '녹슨 검' }),
      '리아가 녹슨 검을 내려놓았다.',
    )
  })
})

describe('문장 템플릿: 추가 사례', () => {
  const one = (tpl: string, v: string | number) => renderTemplate(tpl, { x: v })

  it('리아가 / 모라는 / 검을 / 폐광으로 / 서울로 / Lily는', () => {
    assert.equal(one('{x:이/가}', '리아'), '리아가')
    assert.equal(one('{x:은/는}', '모라'), '모라는')
    assert.equal(one('{x:을/를}', '검'), '검을')
    assert.equal(one('{x:으로/로}', '폐광'), '폐광으로')
    assert.equal(one('{x:으로/로}', '서울'), '서울로')
    assert.equal(one('{x:은/는}', 'Lily'), 'Lily는')
  })

  it('영문: m·n은 받침 있음, 그 밖의 자음은 병기형', () => {
    // 14 §6 4항: m → 받침 있음이므로 Tom은 병기형이 아니다
    assert.equal(one('{x:이/가}', 'Tom'), 'Tom이')
    assert.equal(one('{x:으로/로}', 'Tom'), 'Tom으로')
    assert.equal(one('{x:이/가}', 'Bob'), 'Bob이(가)')
    assert.equal(one('{x:으로/로}', 'Jack'), 'Jack(으)로')
    assert.equal(one('{x:으로/로}', 'Neil'), 'Neil로')
    assert.equal(one('{x:을/를}', 'ANNA'), 'ANNA를')
  })

  it('숫자 끝자리', () => {
    for (const d of [1, 7, 8]) assert.equal(one('{x:으로/로}', d), `${d}로`)
    for (const d of [1, 7, 8]) assert.equal(one('{x:이/가}', d), `${d}이`)
    for (const d of [3, 6, 0]) assert.equal(one('{x:으로/로}', d), `${d}으로`)
    for (const d of [2, 4, 5, 9]) assert.equal(one('{x:이/가}', d), `${d}가`)
    assert.equal(one('{x:을/를}', 64), '64를')
  })

  it('조사 쌍 9종', () => {
    const pairs: [string, string, string, string, string][] = [
      // 쌍, 받침 있음(검), 받침 없음(리아), ㄹ(마을), 병기형(Rick)
      ['이/가', '이', '가', '이', '이(가)'],
      ['은/는', '은', '는', '은', '은(는)'],
      ['을/를', '을', '를', '을', '을(를)'],
      ['과/와', '과', '와', '과', '과(와)'],
      ['으로/로', '으로', '로', '로', '(으)로'],
      ['아/야', '아', '야', '아', '아(야)'],
      ['이랑/랑', '이랑', '랑', '이랑', '(이)랑'],
      ['이나/나', '이나', '나', '이나', '(이)나'],
      ['이라/라', '이라', '라', '이라', '(이)라'],
    ]
    for (const [pair, fin, none, rieul, unknown] of pairs) {
      const tpl = `{x:${pair}}`
      assert.equal(one(tpl, '검'), `검${fin}`)
      assert.equal(one(tpl, '리아'), `리아${none}`)
      assert.equal(one(tpl, '마을'), `마을${rieul}`)
      assert.equal(one(tpl, 'Rick'), `Rick${unknown}`)
    }
  })

  it('끝의 공백·괄호·따옴표·문장부호는 건너뛴다', () => {
    assert.equal(one('{x:을/를}', '검"'), '검"을')
    assert.equal(one('{x:이/가}', '리아.'), '리아.가')
    assert.equal(one('{x:으로/로}', '늑대 언덕 '), '늑대 언덕 으로')
    assert.equal(one('{x:은/는}', '모라(Mora)'), '모라(Mora)는')
    assert.equal(one('{x:이/가}', '『광부의 지도』'), '『광부의 지도』가')
  })

  it('판정 불가 문자는 병기형', () => {
    assert.equal(one('{x:이/가}', '劍'), '劍이(가)')
    assert.equal(one('{x:을/를}', '🐺'), '🐺을(를)')
    assert.equal(one('{x:이/가}', ''), '이(가)')
  })

  it('중괄호 이스케이프와 조사 없는 변수', () => {
    assert.equal(renderTemplate('{{name}} = {name}', { name: '리아' }), '{name} = 리아')
    assert.equal(renderTemplate('{{{coins}}}', { coins: 64 }), '{64}')
    assert.equal(renderTemplate('}}', {}), '}')
  })

  it('값이 없거나 문법이 틀리면 예외', () => {
    assert.throws(() => renderTemplate('{name:이/가}', {}), /name/)
    assert.throws(() => renderTemplate('{constructor}', {}), /constructor/)
    assert.throws(() => renderTemplate('{name:이/은}', { name: '리아' }), /조사/)
    assert.throws(() => renderTemplate('{name', { name: '리아' }), /짝/)
    assert.throws(() => renderTemplate('name}', { name: '리아' }), /짝/)
    assert.throws(() => renderTemplate('{na{me}', { name: '리아' }), /짝/)
    assert.throws(() => renderTemplate('{}', {}), /이름/)
    assert.throws(() => renderTemplate('{:이/가}', {}), /이름/)
  })
})

describe('templateVars', () => {
  it('변수 이름을 처음 나온 순서로 중복 없이 낸다', () => {
    assert.deepEqual(templateVars('{name:이/가} {item:을/를} 내려놓았다. {name}'), ['name', 'item'])
    assert.deepEqual(templateVars('{{name}} 그대로'), [])
    assert.deepEqual(templateVars('{luck-2}'), ['luck-2']) // 옛 표기 판별은 검증기 몫
  })

  it('문법 오류는 예외', () => {
    assert.throws(() => templateVars('{name:이/은}'))
    assert.throws(() => templateVars('{name'))
  })
})
