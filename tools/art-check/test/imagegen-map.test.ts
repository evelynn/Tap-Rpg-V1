import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validateMap, type ImagegenMap } from '../src/imagegen-map'

const MANIFEST = { palettes: { outline: ['#2B2233'], skin: ['#E8B89A'] }, palette_sets: { base: ['outline', 'skin'] } }

function map(): ImagegenMap {
  return {
    version: 1,
    root: '../..',
    source_dir: 's',
    out_dir: 'o',
    key: '#FF00FF',
    key_tolerance: 90,
    alpha_threshold: 128,
    key_despill: 60,
    entries: [
      { name: 'ref', source: 'r.png', role: 'reference', grid: [2, 1], cell: [48, 48], rows: [{ action: 'idle', frames: 2 }], palette: 'base', align: { mode: 'ground', bottom: 43, center_x: 23 } },
      { name: 'hair', source: 'h.png', role: 'layer', ref: 'ref', palette: ['outline', 'skin'] },
    ],
    preview: { character: 'ref', layers: ['hair'], enemy: 'ref', props: [], compare: [], field: [] },
  }
}

describe('대응표 검증', () => {
  it('앞뒤가 맞는 대응표는 통과한다', () => {
    assert.doesNotThrow(() => validateMap(map(), MANIFEST))
  })

  it('없는 팔레트·기준·미리보기 이름과 행 수 불일치를 거절한다', () => {
    const m1 = map()
    m1.entries[1] = { name: 'hair', source: 'h.png', role: 'layer', ref: 'nope', palette: 'base' }
    assert.throws(() => validateMap(m1, MANIFEST), /없는 기준 시트/)
    const m2 = map()
    m2.entries[1] = { name: 'hair', source: 'h.png', role: 'layer', ref: 'ref', palette: ['cloth'] }
    assert.throws(() => validateMap(m2, MANIFEST), /팔레트 묶음/)
    const m3 = map()
    m3.preview.props = ['ghost']
    assert.throws(() => validateMap(m3, MANIFEST), /대응표에 없는 이름/)
    const m4 = map()
    const ref = m4.entries[0]!
    if (ref.role === 'reference') ref.rows = []
    assert.throws(() => validateMap(m4, MANIFEST), /rows 길이/)
  })
})
