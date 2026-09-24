import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadManifest, ManifestError, resolveFiles, validateManifest, type Manifest } from '../src/manifest'

const REAL = fileURLToPath(new URL('../../../docs/art/assets.manifest.json', import.meta.url))

function minimal(): Manifest {
  return {
    version: 1,
    source: '시험',
    notes: [],
    palettes: { outline: ['#2B2233'], cloth: ['#F0E6CC'] },
    palette_sets: { base: ['outline', 'cloth'] },
    defaults: { alpha: [0, 255], margin: 1, root: '../..' },
    assets: [
      {
        id: 'a',
        card: 'AO-00',
        priority: 'P0',
        dir: 'assets/test',
        files: ['a.png'],
        size: [96, 48],
        cell: [48, 48],
        grid: [2, 1],
        rows: [{ action: 'x', frames: 2 }],
        frames: 2,
        max_colors: 4,
        palette: 'base',
        companions: [],
      },
    ],
    unspecified: [],
  }
}

describe('매니페스트', () => {
  it('실제 docs/art/assets.manifest.json이 앞뒤가 맞는다', () => {
    const m = loadManifest(REAL)
    assert.ok(m.assets.length > 0)
    const files = resolveFiles(m)
    assert.ok(files.length >= m.assets.length)
    assert.equal(new Set(files.map((f) => f.path)).size, files.length)
  })

  it('기본 묶음은 15 §2.2의 52색이다(48 + 속옷 2 + 바지 2, D73)', () => {
    const m = loadManifest(REAL)
    const base = m.palette_sets['base']!
    const colors = base.flatMap((g) => m.palettes[g]!)
    assert.equal(colors.length, 52)
    assert.equal(new Set(colors).size, 52)
    assert.ok(!colors.includes('#000000'), '순흑은 등록하지 않는다')
  })

  it('항목을 파일 단위로 펼치고 기본값을 채운다', () => {
    const m = minimal()
    m.assets[0]!.files = ['a.png', 'b.png']
    m.assets[0]!.margin = 3
    const files = resolveFiles(m)
    assert.deepEqual(files.map((f) => f.path), ['assets/test/a.png', 'assets/test/b.png'])
    assert.equal(files[0]!.margin, 3)
    assert.deepEqual(files[1]!.alpha, [0, 255])
    assert.equal(files[0]!.maxColorsPerCell, 4)
    assert.equal(files[0]!.palette.size, 2)
  })

  it('크기가 칸×격자와 다르면 거절한다', () => {
    const m = minimal()
    m.assets[0]!.size = [100, 48]
    assert.throws(() => validateManifest(m), ManifestError)
  })

  it('행 프레임 합이 frames와 다르면 거절한다', () => {
    const m = minimal()
    m.assets[0]!.rows = [{ action: 'x', frames: 1 }]
    assert.throws(() => validateManifest(m), /rows 프레임 합 1/)
  })

  it('없는 팔레트 키·중복 id·중복 경로를 거절한다', () => {
    const bad1 = minimal()
    bad1.assets[0]!.palette = 'nope'
    assert.throws(() => validateManifest(bad1), /없는 팔레트 키/)

    const bad2 = minimal()
    bad2.assets.push({ ...bad2.assets[0]! })
    assert.throws(() => validateManifest(bad2), /id가 중복/)

    const bad3 = minimal()
    bad3.assets.push({ ...bad3.assets[0]!, id: 'b' })
    assert.throws(() => validateManifest(bad3), /경로가 겹친다/)
  })

  it('색 표기가 틀리면 거절한다', () => {
    const m = minimal()
    m.palettes['outline'] = ['#2b2233']
    assert.throws(() => validateManifest(m), /색 표기가 잘못됐다/)
  })
})
