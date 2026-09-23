import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderChoice, renderEntry, renderHeir, renderLife, renderStatus } from '../src/render'

describe('데모 출력', () => {
  it('일상 기록은 나이·계절·태그와 문장 한 줄이다', () => {
    const line = renderEntry({ age: 24, season: 'spring', tag: 'hunt', importance: 'daily', line: '여울 늑대를 쫓아냈다.', detail: '숨겨 둔 상세' })
    assert.equal(line, '  [24세 봄] [사냥] 여울 늑대를 쫓아냈다.')
  })

  it('일상이 아닌 기록은 ★와 상세가 붙고 color면 굵게 나온다', () => {
    const view = { age: 30, season: 'winter', tag: 'injury', importance: 'major', line: '다리를 크게 다쳤다.', detail: '중상' } as const
    assert.equal(renderEntry(view), '★ [30세 겨울] [부상] 다리를 크게 다쳤다. — 중상')
    assert.ok(renderEntry(view, true).startsWith('\x1b[1m'))
  })

  it('상태 줄에 나이·레벨·체력·동전이 있다', () => {
    const text = renderStatus({ gen: 2, name: '리아', age: 31, season: 'autumn', level: 7, hp: 40, maxHp: 55, coins: 120, place: '늑대 언덕', state: 'hunt' })
    assert.equal(text, '2대 리아 | 31세 가을 | Lv7 | 체력 40/55 | 동전 120 | 늑대 언덕·사냥')
  })

  it('운명 선택은 번호 목록으로 보여 준다', () => {
    const text = renderChoice({
      kind: 'fate',
      title: '갈림길',
      body: '길이 둘로 갈린다.',
      options: [{ id: 'a', label: '왼쪽', benefit: '빠르다', cost: '위험' }, { id: 'b', label: '오른쪽' }],
    })
    assert.match(text, /^\[운명\] 갈림길/)
    assert.match(text, /1\) 왼쪽 — 빠르다 \/ 위험/)
    assert.match(text, /2\) 오른쪽$/)
  })

  it('생애 요약에 사망 원인과 유품이 들어간다', () => {
    const text = renderLife({
      gen: 1, name: '모라', epithet: '여울의 모라', endAge: 41, endKind: 'died', roleName: null,
      causeText: '늑대 언덕 · 잿빛 늑대', peakLevel: 9,
      summary: { sorties: 12, encounters: 80, defeats: 3, serious_injuries: 1, discoveries: 2, coins_earned: 900 },
      relicNames: ['낡은 단검'], majorLines: ['처음으로 관문을 넘었다.'],
    })
    assert.match(text, /41세 사망 \(늑대 언덕 · 잿빛 늑대\)/)
    assert.match(text, /최고 Lv9/)
    assert.match(text, /유품: 낡은 단검/)
    assert.match(text, /처음으로 관문을 넘었다\./)
  })

  it('계승 결과에 후계자·유전 특성·이전 동전이 들어간다', () => {
    const text = renderHeir({ gen: 2, name: '리아', relation: 'direct', parentCall: '어머니', traitNames: ['튼튼한 체질'], relicNames: [], coins: 300, capped: true })
    assert.match(text, /2대 리아 \(직계, 부모를 어머니라 부른다\)/)
    assert.match(text, /유전 특성: 튼튼한 체질/)
    assert.match(text, /이전 동전 300 \(상한\)/)
  })
})
