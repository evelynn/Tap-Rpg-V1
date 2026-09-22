import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as core from '../src/index'

const fixture = (p: string) => JSON.parse(readFileSync(new URL(`./schema/${p}`, import.meta.url), 'utf8'))

// 합치기 순서 3(CONTENT_SCHEMA §9): W2·W4 예시를 테스트 임시 등록이 아닌 실제 W4 등록부로 다시 검증한다
describe('공개 진입점(@tap/core)', () => {
  it('5.1 balance 예시가 실제 조건·효과 등록부로 통과한다', () => {
    const r = core.balanceSchema.safeParse(fixture('world/fixtures/balance.json'))
    assert.ok(r.success, r.error?.message)
  })

  it('사건 예시가 공개 스키마로 통과한다', () => {
    for (const id of ['L01', 'L06', 'C01-3', 'F03']) {
      const r = core.eventSchema.safeParse(fixture(`event/fixtures/${id}.json`))
      assert.ok(r.success, `${id}: ${r.error?.message}`)
    }
  })

  it('난수·시간·템플릿과 등록부를 함께 내보낸다', () => {
    assert.equal(core.Pcg32.seed(42n, 54n).nextU32(), 0xa15c02b7)
    assert.equal(core.ageAt(24, { min_per_year: 12, season_min: 3, start_age: 18 }), 20)
    assert.equal(core.renderTemplate('{name:이/가} 왔다', { name: '리아' }), '리아가 왔다')
    assert.deepEqual(core.extractTemplateVars('{name:이/가} {place:으로/로}'), ['name', 'place'])
    // 템플릿 변수 등록부(W4)는 추출 함수와 다른 이름으로 공존한다
    assert.equal(core.templateVars.match('rumor_place')?.meta.source, 'event')
    assert.deepEqual(core.SEASONS, ['spring', 'summer', 'autumn', 'winter'])
  })
})
