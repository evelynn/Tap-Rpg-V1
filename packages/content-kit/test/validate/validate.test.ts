import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { CONTENT_KIND_NAMES, condition } from '../../src/core'
import { contentHash } from '../../src/pack/bundle'
import { formatIssue, toPointer, type ContentIssue } from '../../src/validate/issues'
import { validateContent, type ValidateOptions } from '../../src/validate/index'

const fx = (p: string) => fileURLToPath(new URL(`../fixtures/${p}`, import.meta.url))
// 로더 동작만 본다. 종류 스키마(W2~W4)는 무엇이든 받게 바꿔 끼우고 참조·의미 검사는 끈다(스키마 모양에 묶이지 않게).
const ANY = Object.fromEntries(CONTENT_KIND_NAMES.map((k) => [k, z.unknown()]))
const run = (paths: string[], schemas: ValidateOptions['schemas'] = {}) =>
  validateContent(paths.map(fx), { schemas: { ...ANY, ...schemas }, rules: false })
const where = (issues: ContentIssue[]) => issues.map((i) => `${i.severity} ${i.code} ${i.pack}/${i.file}#${i.pointer}`)

describe('validateContent — 정상 팩', () => {
  it('기반·확장·패치 팩을 순서대로 읽어 번들을 만든다', () => {
    const { bundle, issues } = run(['packs'])
    assert.deepEqual(issues, [])
    assert.ok(bundle)
    assert.equal(bundle.format, 1)
    assert.deepEqual(bundle.packs, [
      { id: 'base', version: '0.1.0' },
      { id: 'moss_forest', version: '0.1.0' },
      { id: 'tune_l05', version: '0.1.0' },
    ])
    assert.match(bundle.content_hash, /^[0-9a-f]{64}$/)
  })

  it('확장 팩이 기존 팩 위에 새 정의를 더한다', () => {
    const { defs } = run(['packs'])!.bundle!
    assert.deepEqual(Object.keys(defs.region!), ['H1', 'A1', 'T00', 'MF_H1', 'MF_A1'])
    assert.deepEqual(Object.keys(defs.enemy!), ['EN01', 'MF_EN01'])
    assert.deepEqual(Object.keys(defs.chain!), ['C01', 'MF_C01'])
    assert.deepEqual(Object.keys(defs.event!), ['C01-1', 'L01', 'L05', 'MF_C01-1'])
    assert.deepEqual(Object.keys(defs.flag!), ['life.l01_marked_{place}', 'life.mf_marked_{place}'])
  })

  it('ID는 종류별 이름공간이다(장소 A1과 장비 A1은 따로)', () => {
    const { defs } = run(['packs/base']).bundle!
    assert.equal((defs.region!.A1 as { name: string }).name, '여울 들길')
    assert.equal((defs.item!.A1 as { name: string }).name, '누비옷')
  })

  it('패치 merge: 값 교체·null 키 삭제·배열 통째 교체, 키 순서 유지', () => {
    const l05 = run(['packs']).bundle!.defs.event!.L05 as Record<string, unknown>
    assert.deepEqual(l05, { id: 'L05', name: '소문', category: 'life', locations: ['T00'], weight: 8, tags: ['rumor'] })
    assert.deepEqual(Object.keys(l05), ['id', 'name', 'category', 'locations', 'weight', 'tags'])
  })

  it('번들은 결정적이다(2회 동일, 인자 순서 무관)', () => {
    const a = run(['packs']).bundle!
    const b = run(['packs']).bundle!
    const c = run(['packs/tune_l05', 'packs/moss_forest', 'packs/base']).bundle!
    assert.equal(JSON.stringify(a), JSON.stringify(b))
    assert.equal(JSON.stringify(a), JSON.stringify(c))
    assert.notEqual(run(['packs/base']).bundle!.content_hash, a.content_hash)
  })

  it('content_hash는 키 순서와 무관하다(정규 JSON)', () => {
    assert.equal(contentHash({ prop: { b: { x: 1, y: [1, { p: 1, q: 2 }] } } }), contentHash({ prop: { b: { y: [1, { q: 2, p: 1 }], x: 1 } } }))
  })
})

describe('validateContent — 오류', () => {
  it('P06 같은 종류의 id를 다른 팩이 다시 정의', () => {
    const r = run(['packs/base', 'errors/dup_region'])
    assert.equal(r.bundle, undefined)
    assert.deepEqual(where(r.issues), ['error P06 dup_region/regions/dup.json#/0/id'])
  })

  it('P04 requires 순환 — 번들을 만들지 않는다', () => {
    const r = run(['errors/cycle'])
    assert.equal(r.bundle, undefined)
    assert.deepEqual(r.issues.map((i) => [i.code, i.message]), [['P04', 'requires 순환: cyc_a → cyc_b → cyc_a']])
  })

  it('P03 로드 대상에 없는 requires', () => {
    assert.deepEqual(where(run(['errors/missing_req']).issues), ['error P03 missing_req/pack.json#/requires/0'])
  })

  it('P01 pack.json 스키마(형식·모르는 필드)와 팩 없음', () => {
    assert.deepEqual(where(run(['errors/bad_manifest']).issues), [
      'error P01 bad_manifest/pack.json#/id',
      'error P01 bad_manifest/pack.json#',
    ])
    assert.deepEqual(where(validateContent([]).issues), ['error P01 /#'])
    assert.deepEqual(where(run(['packs/base/regions']).issues), ['error P01 regions/pack.json#'])
  })

  it('P08 JSON 해석 실패', () => {
    assert.deepEqual(where(run(['errors/bad_json']).issues), ['error P08 bad_json/regions/broken.json#'])
  })

  it('P05 경로·파일 모양(모르는 경로, 분류 폴더, 파일명≠id, category≠폴더, 배열 사건, 객체 아님)', () => {
    assert.deepEqual(where(run(['errors/bad_paths']).issues), [
      'error P05 bad_paths/chains/C09.json#',
      'error P05 bad_paths/events/L90.json#',
      'error P05 bad_paths/events/fate/L93.json#/category',
      'error P05 bad_paths/events/life/L91.json#/id',
      'error P05 bad_paths/monsters/x.json#',
      'warn P05 bad_paths/props/empty.json#',
      'error S01 bad_paths/props/no_id.json#/id',
      'error P05 bad_paths/props/not_object.json#/0',
    ])
  })

  it('P07 패치 대상 없음·merge 아닌 op·id 변경', () => {
    const r = run(['packs/base', 'errors/bad_patch'])
    assert.equal(r.bundle, undefined)
    assert.deepEqual(where(r.issues), [
      'error P07 bad_patch/patches/010_bad.json#/0/target',
      'error P07 bad_patch/patches/010_bad.json#/1/op',
      'error P07 bad_patch/patches/010_bad.json#/2/value/id',
    ])
  })

  it('P09 두 팩이 같은 최상위 키를 merge하면 경고, 번들은 만든다(나중 팩이 이김)', () => {
    const r = run(['packs/base', 'packs/tune_l05', 'errors/tune_l05_again'])
    assert.deepEqual(where(r.issues), ['warn P09 tune_l05_again/patches/010_l05.json#/0/value/weight'])
    assert.equal(r.issues[0]!.message, '두 팩이 같은 키를 merge한다: event L05.weight (tune_l05, tune_l05_again). 나중 팩 값이 남는다')
    assert.equal((r.bundle!.defs.event!.L05 as { weight: number }).weight, 2)
  })
})

describe('validateContent — 스키마 검증(S01·규칙 번호)', () => {
  it('패치를 적용한 결과를 다시 검증한다', () => {
    const event = z.looseObject({ weight: z.number().max(5) })
    assert.deepEqual(run(['packs/base'], { event }).issues, [])
    const r = run(['packs'], { event })
    assert.equal(r.bundle, undefined)
    assert.deepEqual(where(r.issues), ['error S01 base/events/life/L05.json#/weight'])
  })

  it('이슈 params.rule이 있으면 그 번호로 보고한다(조건 V3)', () => {
    // 등록된 단말(discovery_found·visited)은 통과하고, 모르는 단말은 V3다
    const region = z.looseObject({ unlock: condition })
    assert.deepEqual(where(run(['packs'], { region }).issues), [])
    const event = z.looseObject({ condition: condition.optional(), weight: z.number() })
    const r = run(['packs'], { event: event.refine((e) => e.weight < 8, { params: { rule: 'V13' } }) })
    assert.deepEqual(where(r.issues), ['error V13 base/events/life/L05.json#'])
  })
})

describe('issues', () => {
  it('한 줄 형식과 JSON Pointer', () => {
    const line = formatIssue({ severity: 'warn', code: 'P09', pack: 'winter_fest', file: 'patches/010_town.json', pointer: '/0/value/tags', message: 'm' })
    assert.equal(line, 'warn  P09 winter_fest/patches/010_town.json#/0/value/tags: m')
    assert.equal(toPointer(['a/b', 'c~d', 0]), '/a~1b/c~0d/0')
  })
})
