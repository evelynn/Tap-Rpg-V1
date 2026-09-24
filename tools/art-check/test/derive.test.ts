import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { compareOverlap, compareRecompose, deriveLayers, stackLayers, type DeriveClassSpec, type DeriveOptions, type StackSlot } from '../src/derive'
import { validateMap, type ImagegenMap } from '../src/imagegen-map'
import { createRaster, type Raster } from '../src/raster'

// 글자 → [RGB, 팔레트 묶음]
const COLORS: Record<string, [number, string]> = {
  o: [0x2b2233, 'outline'],
  s: [0xe8b89a, 'skin'],
  t: [0xe3b48e, 'skin'], // s와 가중 거리 약 21(음영 차이)
  h: [0x7a4e30, 'hair'],
  m: [0xb4b2b0, 'metal'],
  w: [0xe8e6e0, 'metal'],
  l: [0x8e5e38, 'leather'],
  c: [0xf0e6cc, 'cloth'],
}
const GROUP = new Map(Object.values(COLORS).map(([rgb, g]) => [rgb, g]))
const groupOf = (rgb: number): string | undefined => GROUP.get(rgb)

/** 행 문자열로 한 칸짜리 래스터를 만든다('.' = 투명) */
function raster(art: string[]): Raster {
  const h = art.length
  const w = art[0]!.length
  const r = createRaster(w, h)
  art.forEach((line, y) => [...line].forEach((ch, x) => {
    const c = COLORS[ch]
    if (c === undefined) return
    const o = (y * w + x) * 4
    r.rgba.set([(c[0] >> 16) & 0xff, (c[0] >> 8) & 0xff, c[0] & 0xff, 255], o)
  }))
  return r
}

/** 래스터를 문자로 되읽는다 */
function read(r: Raster): string[] {
  const inv = new Map(Object.entries(COLORS).map(([ch, [rgb]]) => [rgb, ch]))
  const out: string[] = []
  for (let y = 0; y < r.height; y++) {
    let line = ''
    for (let x = 0; x < r.width; x++) {
      const o = (y * r.width + x) * 4
      line += r.rgba[o + 3] === 0 ? '.' : inv.get((r.rgba[o]! << 16) | (r.rgba[o + 1]! << 8) | r.rgba[o + 2]!) ?? '?'
    }
    out.push(line)
  }
  return out
}

const WEAPON: DeriveClassSpec = { name: 'weapon', core: ['metal'], extra: ['leather', 'outline'], place: 'outside' }
const CLOTH: DeriveClassSpec = { name: 'cloth', core: ['cloth'], extra: ['leather', 'outline'], place: 'inside', loose: ['leather'] }
const OPTS: DeriveOptions = { matchDistance: 40, reach: 3, minCore: 3 }

function derive(ref: Raster, body: Raster, hair: Raster | null, classes: DeriveClassSpec[], opts = OPTS) {
  // 그리기 순서: 몸체 → 옷 → 머리카락 → 무기 (15 §3.1)
  const order: StackSlot[] = [{ layer: 'body', raster: body }]
  const clothIdx = classes.findIndex((c) => c.name === 'cloth')
  const weaponIdx = classes.findIndex((c) => c.name === 'weapon')
  if (clothIdx >= 0) order.push({ cls: clothIdx })
  if (hair !== null) order.push({ layer: 'hair', raster: hair })
  if (weaponIdx >= 0) order.push({ cls: weaponIdx })
  const cell: [number, number] = [ref.width, ref.height]
  const r = deriveLayers({ ref, cell, grid: [1, 1], filled: [true], order, classes, groupOf }, opts)
  const stack = order.map((s) => ('raster' in s ? s.raster : r.layers[s.cls]!))
  return { ...r, recomposed: stackLayers(ref.width, ref.height, stack), cell }
}

describe('남은 화소', () => {
  it('빼는 레이어와 같거나 허용 거리 안인 화소는 남지 않고, 다르거나 덮이지 않은 화소만 남는다', () => {
    const ref = raster([
      'ssc.',
      'sll.',
      '....',
    ])
    const body = raster([
      'tss.',
      'sss.',
      '....',
    ])
    // t↔s는 거리 21 < 40이라 설명된다. c(몸체 밖)·l l(몸체 s 위)만 남는다
    const r = derive(ref, body, null, [CLOTH], { ...OPTS, minCore: 1 })
    const cell = r.cells[0]!
    assert.equal(cell.ref_pixels, 6)
    assert.equal(cell.leftover, 3)
    assert.deepEqual(read(r.layers[0]!), ['..c.', '.ll.', '....'])
  })

  it('허용 거리 0이면 음영 차이도 남는다', () => {
    const ref = raster(['ss'])
    const body = raster(['ts'])
    const r = derive(ref, body, null, [CLOTH], { ...OPTS, matchDistance: 0 })
    assert.equal(r.cells[0]!.leftover, 1)
    // 피부색은 어느 부류 색도 아니라 잔여
    assert.equal(r.cells[0]!.residual_no_class, 1)
    assert.deepEqual(read(r.layers[0]!), ['..'])
  })
})

describe('부류 나누기', () => {
  // 몸체: 6×6 사각, 칼은 몸 안 손(가죽 손잡이)에서 오른쪽 몸 밖으로 뻗는다
  const body = raster([
    '..........',
    '.ssssss...',
    '.ssssss...',
    '.ssssss...',
    '.ssssss...',
    '.ssssss...',
    '.ssssss...',
    '..........',
  ])

  it('금속 덩어리가 실루엣 밖에 닿으면 무기, 가죽 손잡이는 붙이기로 따라온다', () => {
    const ref = raster([
      '..........',
      '.ssssss...',
      '.sssslmmmm',
      '.ssssss...',
      '.ssssss...',
      '.ssssss...',
      '.ssssss...',
      '..........',
    ])
    const r = derive(ref, body, null, [WEAPON, CLOTH])
    assert.deepEqual(read(r.layers[0]!)[2], '.....lmmmm')
    assert.equal(r.cells[0]!.assigned['weapon'], 5)
    assert.equal(r.cells[0]!.assigned['cloth'], 0)
  })

  it('실루엣 안에만 있는 금속색 덩어리는 무기로 받지 않는다(잔여로 센다)', () => {
    const ref = raster([
      '..........',
      '.ssssss...',
      '.smmmss...',
      '.ssssss...',
      '.ssssss...',
      '.ssssss...',
      '.ssssss...',
      '..........',
    ])
    const r = derive(ref, body, null, [WEAPON, CLOTH])
    assert.equal(r.cells[0]!.assigned['weapon'], 0)
    assert.equal(r.cells[0]!.residual_rejected, 3)
  })

  it('옷 씨앗과 떨어진 몸 안 가죽 조각(허리끈)은 옷, 어두운 윤곽색만의 조각(눈)은 잔여', () => {
    const ref = raster([
      '..........',
      '.ssosss...',
      '.ssssss...',
      '.cccsss...',
      '.ssssss...',
      '.llllll...',
      '.ssssss...',
      '..........',
    ])
    const r = derive(ref, body, null, [WEAPON, CLOTH])
    const cloth = read(r.layers[1]!)
    assert.equal(cloth[3], '.ccc......')
    assert.equal(cloth[5], '.llllll...')
    assert.equal(cloth[1], '..........')
    assert.equal(r.cells[0]!.residual_unreached, 1)
  })

  it('옷보다 위에 그리는 머리카락 레이어가 덮은 자리는 옷이 가질 수 없다', () => {
    const ref = raster([
      '..........',
      '.cccccc...',
      '.cccccc...',
      '.ssssss...',
      '.ssssss...',
      '.ssssss...',
      '.ssssss...',
      '..........',
    ])
    const hair = raster([
      '..........',
      '.hhhhhh...',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
    ])
    const r = derive(ref, body, hair, [WEAPON, CLOTH])
    const cloth = read(r.layers[1]!)
    assert.equal(cloth[1], '..........')
    assert.equal(cloth[2], '.cccccc...')
    assert.equal(r.cells[0]!.residual_blocked, 6)
  })

  it('min_core보다 작은 금속 점은 씨앗이 되지 못한다', () => {
    const ref = raster([
      '..........',
      '.ssssss...',
      '.ssssssm..',
      '.ssssss...',
      '.ssssss...',
      '.ssssss...',
      '.ssssss...',
      '..........',
    ])
    const r = derive(ref, body, null, [WEAPON, CLOTH])
    assert.equal(r.cells[0]!.assigned['weapon'], 0)
    assert.equal(r.cells[0]!.residual_rejected, 1)
  })

  it('잔여 가운데 1화소 옆에 같은 색 레이어 화소가 있으면 어긋남으로 센다', () => {
    const ref = raster([
      '.hs',
      '...',
    ])
    const b = raster([
      '..h',
      '...',
    ])
    // (1,0) h: 몸체가 없어 남음 → 부류 색 아님 → 잔여, 오른쪽 이웃이 h라 어긋남
    // (2,0) s: 몸체 h와 멀어 남음 → 잔여, 이웃에 s 레이어 화소 없음
    const r = derive(ref, b, null, [CLOTH], { ...OPTS, matchDistance: 20 })
    assert.equal(r.cells[0]!.residual_no_class, 2)
    assert.equal(r.cells[0]!.residual_offset, 1)
  })
})

describe('재합성 비교', () => {
  it('파생 레이어까지 쌓으면 기준을 그대로 되살리고, 빠진 화소가 있으면 기준 비율 아래로 실패한다', () => {
    const ref = raster([
      '..........',
      '.ssssss...',
      '.sssslmmmm',
      '.ssssss...',
      '.ssssss...',
      '.cccsss...',
      '.ssssss...',
      '..........',
    ])
    const body = raster([
      '..........',
      '.ssssss...',
      '.ssssss...',
      '.ssssss...',
      '.ssssss...',
      '.ssssss...',
      '.ssssss...',
      '..........',
    ])
    const r = derive(ref, body, null, [WEAPON, CLOTH])
    const ok = compareRecompose(ref, r.recomposed, r.cell, [1, 1], [true], OPTS.matchDistance, 0.98)[0]!
    assert.equal(ok.rate, 1)
    assert.equal(ok.exact_rate, 1)
    assert.equal(ok.pass, true)

    // 몸체만 쌓으면(부류 없이) 칼의 몸 밖 3화소가 빠지고, 손잡이·몸 안 칼날·옷 5화소는 색이 다르다
    const bodyOnly = compareRecompose(ref, body, r.cell, [1, 1], [true], OPTS.matchDistance, 0.98)[0]!
    assert.equal(bodyOnly.missing, 3)
    assert.equal(bodyOnly.color_off, 5)
    assert.equal(bodyOnly.union, 39)
    assert.equal(bodyOnly.rate, Math.round((31 / 39) * 10000) / 10000)
    assert.equal(bodyOnly.pass, false)
  })

  it('기준 비율 경계: 49/50은 0.98로 통과, 48/50은 실패', () => {
    const line = (n: number): string[] => [`${'s'.repeat(n)}${'.'.repeat(50 - n)}`]
    const ref = raster(line(50))
    const at = (n: number) => compareRecompose(ref, raster(line(n)), [50, 1], [1, 1], [true], 0, 0.98)[0]!
    assert.equal(at(49).pass, true)
    assert.equal(at(48).pass, false)
    // 넘침(기준은 투명인데 재합성이 불투명)도 분모에 든다
    const over = compareRecompose(raster(line(49)), ref, [50, 1], [1, 1], [true], 0, 0.98)[0]!
    assert.equal(over.extra, 1)
    assert.equal(over.rate, 0.98)
  })

  it('비교 레이어와의 겹침은 정밀·재현으로 잰다', () => {
    const a = raster(['mmmm..'])
    const b = raster(['..mmmm'])
    const o = compareOverlap(a, b, [6, 1], [1, 1], [true])[0]!
    assert.equal(o.both, 2)
    assert.equal(o.precision, 0.5)
    assert.equal(o.recall, 0.5)
  })
})

describe('대응표 derived 항목', () => {
  const MANIFEST = { palettes: { outline: ['#2B2233'], skin: ['#E8B89A'], metal: ['#B4B2B0'], cloth: ['#F0E6CC'] }, palette_sets: { base: ['outline', 'skin'] } }
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
        { name: 'body', source: 'b.png', role: 'layer', ref: 'ref', palette: 'base' },
        {
          name: 'split',
          role: 'derived',
          ref: 'ref',
          subtract: ['body'],
          order: ['body', 'cloth', 'weapon'],
          classes: [
            { name: 'weapon', core: ['metal'], extra: ['outline', '#2F2420'], place: 'outside' },
            { name: 'cloth', core: ['#F0E6CC'], loose: ['cloth'], place: 'inside' },
          ],
        },
      ],
      preview: { character: 'ref', layers: ['body'], enemy: 'ref', props: [], compare: [], field: [] },
    }
  }
  const derived = (m: ImagegenMap) => {
    const e = m.entries[2]!
    if (e.role !== 'derived') throw new Error('derived 항목이 아니다')
    return e
  }

  it('앞뒤가 맞는 파생 항목은 통과한다', () => {
    assert.doesNotThrow(() => validateMap(map(), MANIFEST))
  })

  it('order 누락·겹치는 core·없는 묶음·다른 기준의 레이어를 거절한다', () => {
    const m1 = map()
    derived(m1).order = ['body', 'cloth']
    assert.throws(() => validateMap(m1, MANIFEST), /order/)
    const m2 = map()
    derived(m2).classes[1]!.core = ['metal']
    assert.throws(() => validateMap(m2, MANIFEST), /겹친다/)
    const m3 = map()
    derived(m3).classes[0]!.extra = ['bronze']
    assert.throws(() => validateMap(m3, MANIFEST), /팔레트 묶음/)
    const m4 = map()
    derived(m4).subtract = ['ref']
    derived(m4).order = ['ref', 'cloth', 'weapon']
    assert.throws(() => validateMap(m4, MANIFEST), /layer여야/)
  })
})
