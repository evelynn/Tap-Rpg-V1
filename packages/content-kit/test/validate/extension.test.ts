import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { validateContent } from '../../src/validate/index'
import { stagePacks } from '../stage-packs'

// 확장성 e2e: 실제 종류 스키마(KIND_SCHEMAS)와 참조·의미 검사를 켠 채로 기반·확장·패치 팩을 검증한다.
// 확장 팩(moss_forest)은 새 사냥터·적·줄기(2단계)·생활 사건을 더하고, 기반 키 묶음 플래그(life.l01_marked_{place})를 새 장소로 쓴다.
function run(packs: string[], extra: Record<string, unknown> = {}) {
  const { dir, cleanup } = stagePacks(extra)
  try {
    return validateContent(packs.map((p) => join(dir, p)))
  } finally {
    cleanup()
  }
}
const where = (r: ReturnType<typeof run>) => r.issues.map((i) => `${i.severity} ${i.code} ${i.pack}/${i.file}#${i.pointer}`)
const pack = (id: string) => ({ id, name: id, version: '0.1.0', requires: ['base'] })

describe('확장성 e2e(실제 스키마·규칙)', () => {
  it('기반·확장·패치 팩이 코어 수정 없이 모든 검사를 통과한다', () => {
    const r = run(['.'])
    assert.deepEqual(where(r), [])
    const defs = r.bundle!.defs
    assert.deepEqual(Object.keys(defs.region!).filter((id) => id.startsWith('MF_')), ['MF_H1'])
    assert.deepEqual(Object.keys(defs.event!).filter((id) => id.startsWith('MF_')), ['MF_C01-1', 'MF_C01-2', 'MF_L01'])
    assert.ok(defs.enemy!.MF_EN01 && defs.chain!.MF_C01)
    const l05 = defs.event!.L05 as { weight: number; cooldown_min?: number }
    assert.equal(l05.weight, 8)
    assert.equal('cooldown_min' in l05, false)
  })

  it('패치 결과를 다시 검증하고, 이슈에 패치 위치를 붙인다(V13)', () => {
    const patch = [{ target: { kind: 'event', id: 'L05' }, op: 'merge', value: { weight: 11 } }]
    const r = run(['base', 'tune_bad'], { 'tune_bad/pack.json': pack('tune_bad'), 'tune_bad/patches/010_l05.json': patch })
    assert.equal(r.bundle, undefined)
    assert.deepEqual(where(r), ['error V13 base/events/life/L05.json#/weight'])
    assert.match(r.issues[0]!.message, /\(패치: tune_bad\/patches\/010_l05\.json#\/0\)$/)
  })

  it('패치의 __proto__ 키는 버리거나 상속되지 않고 모르는 필드(S01)로 걸린다', () => {
    const patch = JSON.parse('[{"target":{"kind":"event","id":"L05"},"op":"merge","value":{"__proto__":{"allow_serious_injury":true},"intro":{"__proto__":{"tag":"town"}}}}]')
    const r = run(['base', 'tune_bad'], { 'tune_bad/pack.json': pack('tune_bad'), 'tune_bad/patches/010_l05.json': patch })
    assert.equal(r.bundle, undefined)
    assert.deepEqual(where(r), ['error S01 base/events/life/L05.json#/intro', 'error S01 base/events/life/L05.json#'])
  })

  it('확장 팩이 없는 기반 ID를 가리키면 V2', () => {
    const npc = { id: 'MF_N01', name: '이끼지기', role: '숲지기', home: 'T09', speech: { style: '과묵', samples: [] }, events: ['L05'], relation_default: 0 }
    const r = run(['base', 'bad_ref'], { 'bad_ref/pack.json': pack('bad_ref'), 'bad_ref/npcs/MF_N01.json': npc })
    assert.equal(r.bundle, undefined)
    assert.deepEqual(where(r), ['error V2 bad_ref/npcs/MF_N01.json#/home'])
  })

  it('다른 정의가 있는데 balance가 없으면 V2(규칙 검사가 조용히 꺼지지 않게)', () => {
    const r = run(['nobal'], { 'nobal/pack.json': { ...pack('nobal'), requires: [] }, 'nobal/props/book.json': { id: 'book', name: '책', asset_id: 'prop_book' } })
    assert.deepEqual(r.issues.map((i) => `${i.code} ${i.message}`), ['V2 balance 정의가 없다(기반 팩의 balance.json)'])
  })
})
