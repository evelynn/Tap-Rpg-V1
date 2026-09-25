import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { AlignSpec, RowSpec } from '../src/imagegen-map'
import { measureRegistration } from '../src/layers'
import {
  assignCells,
  isBackground,
  labelCell,
  measurePeriod,
  normalizeSheet,
  Snapper,
  type KeyOptions,
  type PaletteEntry,
  type SourceImage,
} from '../src/normalize'
import { decodePng } from '../src/png'
import { normalizeToSpec, referenceHeight } from '../src/pipeline'
import { normalizeStrip } from '../src/strip'
import type { ReferenceEntry } from '../src/imagegen-map'
import { encodeIndexedPng, encodeRgbaPng } from '../src/png-write'
import type { Raster } from '../src/raster'

const MAGENTA: [number, number, number] = [255, 0, 255]
const KEY: KeyOptions = { key: MAGENTA, tolerance: 90, alphaThreshold: 128, despill: 60 }

function pal(hex: string, group = 'g'): PaletteEntry {
  const n = Number.parseInt(hex.slice(1), 16)
  return { hex, r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff, group }
}
const OUTLINE = pal('#2B2233', 'outline')
const SKIN = pal('#E8B89A', 'skin')
const CLOTH = pal('#5A7FA8', 'cloth')
const PALETTE = [OUTLINE, SKIN, CLOTH]
const rgbOf = (p: PaletteEntry): [number, number, number] => [p.r, p.g, p.b]

/** 자홍 배경 원본. 논리 그림 art(행 문자열, '.' = 빈칸)를 scale배로 키워 (ox, oy)에 찍는다 */
function source(w: number, h: number): SourceImage & { stamp(art: string[], colors: Record<string, [number, number, number]>, scale: number, ox: number, oy: number, noise?: number): void } {
  const rgba = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) rgba.set([...MAGENTA, 255], i * 4)
  return {
    width: w,
    height: h,
    rgba,
    stamp(art, colors, scale, ox, oy, noise = 0) {
      let seed = 7
      const rnd = (): number => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return (seed / 0x7fffffff) * 2 - 1
      }
      art.forEach((line, ay) => {
        ;[...line].forEach((ch, ax) => {
          const c = colors[ch]
          if (c === undefined) return
          for (let y = Math.round(oy + ay * scale); y < Math.round(oy + (ay + 1) * scale); y++) {
            for (let x = Math.round(ox + ax * scale); x < Math.round(ox + (ax + 1) * scale); x++) {
              const n = Math.round(rnd() * noise)
              rgba.set([c[0] + n, c[1] + n, c[2] + n].map((v) => Math.max(0, Math.min(255, v))).concat(255), (y * w + x) * 4)
            }
          }
        })
      })
    },
  }
}

const COLORS: Record<string, [number, number, number]> = { o: rgbOf(OUTLINE), s: rgbOf(SKIN), c: rgbOf(CLOTH) }

/** 논리 칸 안의 화소를 문자 격자로 읽는다(시험 비교용) */
function readCell(r: Raster, col: number, row: number, cw: number, ch: number): string[] {
  const inv = new Map(PALETTE.map((p, i) => [(p.r << 16) | (p.g << 8) | p.b, 'osc'[i]!]))
  const out: string[] = []
  for (let y = 0; y < ch; y++) {
    let line = ''
    for (let x = 0; x < cw; x++) {
      const o = ((row * ch + y) * r.width + col * cw + x) * 4
      line += r.rgba[o + 3] === 0 ? '.' : inv.get((r.rgba[o]! << 16) | (r.rgba[o + 1]! << 8) | r.rgba[o + 2]!) ?? '?'
    }
    out.push(line)
  }
  return out
}

function bounds(lines: string[]): { x0: number; x1: number; y0: number; y1: number } {
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  lines.forEach((l, y) => [...l].forEach((ch, x) => {
    if (ch === '.') return
    x0 = Math.min(x0, x)
    x1 = Math.max(x1, x)
    y0 = Math.min(y0, y)
    y1 = Math.max(y1, y)
  }))
  return { x0, x1, y0, y1 }
}

const FIGURE = [
  '.ooo.',
  'ossso',
  '.ooo.',
  'occco',
  'occco',
  '.o.o.',
]
const ROWS: RowSpec[] = [{ action: 'idle', frames: 2 }]
const GROUND: AlignSpec = { mode: 'ground', bottom: 10, center_x: 5 }

describe('PNG 기록', () => {
  it('RGBA PNG는 해석기로 되읽으면 화소가 같다', () => {
    const rgba = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 43, 34, 51, 255, 1, 2, 3, 4, 5, 6, 7, 8])
    const img = decodePng(encodeRgbaPng(3, 2, rgba))
    assert.equal(img.colorType, 6)
    assert.deepEqual([...img.rgba], [...rgba])
  })

  it('인덱스 PNG는 인덱스 0이 투명이고 되읽으면 화소가 같다', () => {
    const rgba = new Uint8Array([0, 0, 0, 0, 43, 34, 51, 255, 232, 184, 154, 255, 43, 34, 51, 255])
    const img = decodePng(encodeIndexedPng(2, 2, rgba))
    assert.equal(img.colorType, 3)
    assert.equal(img.paletteSize, 3)
    assert.equal(img.hasTrns, true)
    assert.deepEqual([...img.rgba], [...rgba])
  })

  it('인덱스 PNG는 반투명 화소를 거절한다', () => {
    assert.throws(() => encodeIndexedPng(1, 1, new Uint8Array([1, 2, 3, 100])), /알파 0·255/)
  })
})

describe('배경 열쇠', () => {
  const px = (r: number, g: number, b: number, a = 255): boolean => isBackground(new Uint8Array([r, g, b, a]), 0, KEY)
  it('자홍색과 그 잡음, 낮은 알파는 배경이다', () => {
    assert.equal(px(255, 0, 255), true)
    assert.equal(px(248, 12, 246), true)
    assert.equal(px(43, 34, 51, 100), true)
  })
  it('자홍과 섞인 테두리 화소는 번짐 제거로 배경이 된다', () => {
    assert.equal(px(145, 21, 150), true) // 외곽선과 반반
    assert.equal(px(247, 112, 221), true) // 피부와 반반
  })
  it('캐릭터 색은 배경이 아니다', () => {
    assert.equal(px(43, 34, 51), false)
    assert.equal(px(232, 184, 154), false)
    assert.equal(px(90, 127, 168), false)
  })
})

describe('정규화', () => {
  it('잡음 섞인 정수배 확대 그림을 논리 화소로 되돌리고 팔레트 오차를 센다', () => {
    const src = source(120, 60)
    src.stamp(FIGURE, COLORS, 5, 12, 11, 6)
    src.stamp(FIGURE, COLORS, 5, 73, 8, 6)
    const r = normalizeSheet(src, { grid: [2, 1], cell: [12, 12], rows: ROWS, align: GROUND, scale: 5 }, new Snapper(PALETTE), KEY)
    for (const col of [0, 1]) {
      const cell = readCell(r.raster, col, 0, 12, 12)
      const b = bounds(cell)
      assert.deepEqual(cell.slice(b.y0, b.y1 + 1).map((l) => l.slice(b.x0, b.x1 + 1)), FIGURE, `칸 ${col}`)
    }
    const c0 = r.report.cells[0]!
    assert.equal(c0.status, 'ok')
    assert.ok(c0.palette_error.mean > 0 && c0.palette_error.max < 40)
    assert.deepEqual(r.report.totals.colors, ['#2B2233', '#5A7FA8', '#E8B89A'])
    assert.equal(r.report.scale_origin, 'map')
  })

  it('기준 정렬: 가장 아래 행을 지면에, 불투명 화소 x 중앙값을 중심에 둔다', () => {
    const src = source(120, 60)
    src.stamp(FIGURE, COLORS, 5, 12, 11)
    src.stamp(FIGURE, COLORS, 5, 64, 2)
    const r = normalizeSheet(src, { grid: [2, 1], cell: [12, 12], rows: ROWS, align: GROUND, scale: 5 }, new Snapper(PALETTE), KEY)
    for (const col of [0, 1]) {
      const b = bounds(readCell(r.raster, col, 0, 12, 12))
      assert.equal(b.y1, 10, `칸 ${col} 최하단`)
      assert.equal(b.x0 + 2, 5, `칸 ${col} 중심(그림 가운데 열)`)
    }
  })

  it('가운데 정렬은 bbox를 칸 가운데에 둔다', () => {
    const src = source(60, 60)
    src.stamp(['cc', 'cc'], COLORS, 5, 3, 40)
    const r = normalizeSheet(src, { grid: [1, 1], cell: [12, 12], rows: [{ action: 'a', frames: 1 }], align: { mode: 'center' }, scale: 5 }, new Snapper(PALETTE), KEY)
    assert.deepEqual(bounds(readCell(r.raster, 0, 0, 12, 12)), { x0: 5, x1: 6, y0: 5, y1: 6 })
  })

  it('격자선을 넘은 발끝은 이웃 칸이 아니라 제 칸에 남는다', () => {
    const src = source(60, 120)
    // 칸 경계 y 60을 3화소 넘는 그림(무게중심은 위 칸)
    src.stamp(FIGURE, COLORS, 5, 18, 33)
    const own = assignCells(src, KEY, 1, 2)
    assert.equal(own.boxes[1], null)
    assert.deepEqual(own.boxes[0], { x0: 18, y0: 33, x1: 43, y1: 63 })
    const r = normalizeSheet(src, { grid: [1, 2], cell: [12, 12], rows: [{ action: 'a', frames: 1 }, { action: 'b', frames: 0 }], align: GROUND, scale: 5 }, new Snapper(PALETTE), KEY)
    assert.equal(r.report.cells[1]!.status, 'empty')
    assert.equal(bounds(readCell(r.raster, 0, 0, 12, 12)).y1 - bounds(readCell(r.raster, 0, 0, 12, 12)).y0 + 1, FIGURE.length)
  })

  it('빈 칸이어야 할 곳에 내용이 있으면 보고하고 출력에서 뺀다', () => {
    const src = source(120, 60)
    src.stamp(FIGURE, COLORS, 5, 12, 11)
    src.stamp(FIGURE, COLORS, 5, 72, 11)
    const r = normalizeSheet(src, { grid: [2, 1], cell: [12, 12], rows: [{ action: 'a', frames: 1 }], align: GROUND, scale: 5 }, new Snapper(PALETTE), KEY)
    assert.equal(r.report.cells[1]!.status, 'unexpected_content')
    assert.ok(readCell(r.raster, 1, 0, 12, 12).every((l) => /^\.+$/.test(l)))
  })

  it('칸 비율이 정사각이 아니면 큰 값을 축척으로 쓰고 알린다', () => {
    const src = source(96, 60)
    src.stamp(FIGURE, COLORS, 5, 30, 11)
    const r = normalizeSheet(src, { grid: [1, 1], cell: [12, 12], rows: [{ action: 'a', frames: 1 }], align: GROUND }, new Snapper(PALETTE), KEY)
    assert.equal(r.report.scale, 8)
    assert.equal(r.report.scale_origin, 'cell_ratio')
    assert.ok(r.report.notes.some((n) => n.includes('정사각')))
  })

  it('원본 화소 블록 크기를 잰다', () => {
    const art = ['ocsocsocso', 'sococsocso', 'cscoocsocs', 'ocsocsocso', 'sococsocso', 'cscoocsocs', 'ocsocsocso', 'sococsocso']
    const src = source(90, 60)
    src.stamp(art, COLORS, 6, 7, 5)
    const own = assignCells(src, KEY, 1, 1)
    const p = measurePeriod([labelCell(src, own, 0, new Snapper(PALETTE))])
    assert.ok(p !== null && Math.abs(p - 6) < 0.2, `잰 값 ${p}`)
  })
})

describe('레이어 정합', () => {
  // 기준: 두 칸에 사람 모양. 레이어: 같은 원본 좌표의 머리(윗 3줄)만
  const HEAD_ONLY = ['.ooo.', 'ossso', '.ooo.']
  function build(): { ref: ReturnType<typeof normalizeSheet>; layer: ReturnType<typeof normalizeSheet>; alone: ReturnType<typeof normalizeSheet> } {
    const spec = { grid: [2, 1] as [number, number], cell: [12, 12] as [number, number], rows: ROWS, align: GROUND, scale: 5 }
    const refSrc = source(120, 60)
    refSrc.stamp(FIGURE, COLORS, 5, 12, 11)
    refSrc.stamp(FIGURE, COLORS, 5, 64, 2)
    const layerSrc = source(120, 60)
    layerSrc.stamp(HEAD_ONLY, COLORS, 5, 12, 11)
    layerSrc.stamp(HEAD_ONLY, COLORS, 5, 64, 2)
    const ref = normalizeSheet(refSrc, spec, new Snapper(PALETTE), KEY)
    return {
      ref,
      layer: normalizeSheet(layerSrc, spec, new Snapper(PALETTE), KEY, ref.transform),
      alone: normalizeSheet(layerSrc, spec, new Snapper(PALETTE), KEY),
    }
  }

  it('레이어는 기준 시트의 이동을 그대로 써서 제자리에 겹친다', () => {
    const { ref, layer, alone } = build()
    for (const col of [0, 1]) {
      const r = readCell(ref.raster, col, 0, 12, 12)
      const l = readCell(layer.raster, col, 0, 12, 12)
      l.forEach((line, y) => [...line].forEach((ch, x) => {
        if (ch !== '.') assert.equal(r[y]![x], ch, `칸 ${col} (${x},${y})`)
      }))
      assert.deepEqual(layer.transform.cells[col]!.shift, ref.transform.cells[col]!.shift)
    }
    // 따로 정렬하면 머리가 지면선으로 내려가 어긋난다 — 물려받기가 필요한 이유
    assert.notDeepEqual(alone.transform.cells[0]!.shift, ref.transform.cells[0]!.shift)
    const cells = measureRegistration(ref.raster, layer.raster, [12, 12], [2, 1], null)
    assert.ok(cells.every((c) => c.pass && c.containment === 1 && c.color_match === 1 && c.best_shift.join() === '0,0'))
    assert.equal(measureRegistration(ref.raster, alone.raster, [12, 12], [2, 1], null).every((c) => c.pass), false)
  })

  it('원본 크기가 다른 레이어는 거절한다', () => {
    const { ref } = build()
    const other = source(100, 60)
    assert.throws(() => normalizeSheet(other, { grid: [2, 1], cell: [12, 12], rows: ROWS, align: GROUND, scale: 5 }, new Snapper(PALETTE), KEY, ref.transform), /원본 크기/)
  })
})

describe('정합 측정', () => {
  function raster(lines: string[]): Raster {
    const w = lines[0]!.length
    const r: Raster = { width: w, height: lines.length, rgba: new Uint8Array(w * lines.length * 4) }
    lines.forEach((l, y) => [...l].forEach((ch, x) => {
      const p = { o: OUTLINE, s: SKIN, c: CLOTH }[ch as 'o' | 's' | 'c']
      if (p !== undefined) r.rgba.set([p.r, p.g, p.b, 255], (y * w + x) * 4)
    }))
    return r
  }
  const REF = [
    '..........',
    '..oooooo..',
    '..osssso..',
    '..occcco..',
    '..osccso..',
    '..osccso..',
    '..oooooo..',
    '..........',
  ]

  it('1화소 어긋남은 허용하고, 3화소 어긋남은 최적 이동과 포함률로 걸린다', () => {
    const layer = [
      '..........',
      '..........',
      '..........',
      '....cccc..',
      '.....cc...',
      '.....cc...',
      '..........',
      '..........',
    ]
    const ok = measureRegistration(raster(REF), raster(layer), [10, 8], [1, 1], null)[0]!
    assert.equal(ok.pass, true)
    assert.equal(ok.containment, 1)
    assert.deepEqual(ok.best_shift, [-1, 0])
    const shifted = layer.map((l) => '..' + l.slice(0, 8))
    const bad = measureRegistration(raster(REF), raster(shifted), [10, 8], [1, 1], null)[0]!
    assert.deepEqual(bad.best_shift, [-3, 0])
    assert.ok(bad.reasons.some((r) => r.includes('최적 이동')))
    assert.ok(bad.reasons.some((r) => r.includes('포함률')))
  })

  it('옷 레이어가 기준의 피부 면을 덮으면 피부 겹침으로 걸린다', () => {
    const skin = new Set([(SKIN.r << 16) | (SKIN.g << 8) | SKIN.b])
    const good = ['..........', '..........', '..........', '...cccc...', '....cc....', '....cc....', '..........', '..........']
    const sleeve = ['..........', '..........', '...cccc...', '...cccc...', '...cccc...', '...cccc...', '..........', '..........']
    assert.equal(measureRegistration(raster(REF), raster(good), [10, 8], [1, 1], skin)[0]!.skin_overlap, 0)
    const r = measureRegistration(raster(REF), raster(sleeve), [10, 8], [1, 1], skin)[0]!
    assert.ok(r.skin_overlap! > 0.1)
    assert.equal(r.pass, false)
  })
})

describe('scale_to_spec(시트 축척을 규격 키에)', () => {
  it('기준 행 키 중앙값이 규격 키가 되도록 다시 뽑고, 다른 행도 같은 축척을 쓴다', () => {
    // 원본 칸 288×288(칸 비율 6). 논리 8×20 그림을 6배로 찍으면 키 120화소 → 규격 40이면 축척 ≈ 3
    const img = source(576, 576)
    const tall = Array.from({ length: 20 }, (_, y) => (y === 0 || y === 19 ? 'oooooooo' : 'osssssso'))
    const short = tall.slice(0, 16)
    img.stamp(tall, { o: rgbOf(OUTLINE), s: rgbOf(SKIN) }, 6, 120, 100)
    img.stamp(tall, { o: rgbOf(OUTLINE), s: rgbOf(SKIN) }, 6, 408, 100)
    img.stamp(short, { o: rgbOf(OUTLINE), s: rgbOf(SKIN) }, 6, 120, 390)
    const ref: ReferenceEntry = {
      name: 'r', source: 'r.png', role: 'reference', grid: [2, 2], cell: [48, 48],
      rows: [{ action: 'idle', frames: 2 }, { action: 'sit', frames: 1 }], palette: 'base',
      align: { mode: 'ground', bottom: 43, center_x: 23 }, scale_to_spec: { rows: ['idle'], height: 40 },
    }
    const r = normalizeToSpec(img, { grid: ref.grid, cell: ref.cell, rows: ref.rows, align: ref.align }, new Snapper(PALETTE), KEY, ref)
    assert.equal(r.report.scale_origin, 'spec')
    assert.equal(referenceHeight(r.report, [0]), 40)
    assert.ok(Math.abs(r.transform.scale - 3) < 0.1, String(r.transform.scale))
    const sit = r.report.cells.find((c) => c.row === 1 && c.col === 0)!
    assert.equal(sit.bbox![3] - sit.bbox![1] + 1, 32, JSON.stringify(sit.bbox)) // 16×6/3
    assert.match(r.report.notes[0]!, /scale_to_spec: 기준 행 \[idle\] 키 중앙값 40\(규격 40\)/)
  })
})

describe('띠 정규화(normalizeStrip)', () => {
  // 100×60 자홍 캔버스의 y 10..29에 80×20 띠(4:1): 왼쪽 절반 파랑, 오른쪽 절반 빨강, 오른쪽 끝 4열은 두 색 교대
  function stripSource(): SourceImage {
    const W = 100
    const H = 60
    const rgba = new Uint8Array(W * H * 4)
    for (let i = 0; i < W * H; i++) rgba.set([...MAGENTA, 255], i * 4)
    for (let y = 10; y < 30; y++) {
      for (let x = 10; x < 90; x++) {
        const c = x >= 86 ? (x % 2 === 0 ? [200, 40, 40] : [40, 40, 200]) : x < 50 ? [40, 40, 200] : [200, 40, 40]
        rgba.set([...c, 255], (y * W + x) * 4)
      }
    }
    return { width: W, height: H, rgba }
  }

  it('띠를 찾아 잘라 논리 크기로 면적 평균하고 palette null이면 섞인 색을 그대로 둔다', () => {
    const r = normalizeStrip(stripSource(), { size: [20, 5], fill: 'opaque', palette: null }, KEY)
    assert.deepEqual(r.report.band, [10, 10, 80, 20])
    assert.deepEqual(r.report.scale, [4, 4])
    assert.equal(r.report.opaque, 100)
    const px = (x: number, y: number): number[] => [...r.raster.rgba.subarray((y * 20 + x) * 4, (y * 20 + x) * 4 + 4)]
    assert.deepEqual(px(0, 0), [40, 40, 200, 255])
    assert.deepEqual(px(15, 4), [200, 40, 40, 255])
    assert.deepEqual(px(19, 2), [120, 40, 120, 255]) // 교대 4열의 면적 평균
    assert.equal(r.report.palette_snapped, false)
    assert.deepEqual(r.report.notes, [])
  })

  it('팔레트를 주면 평균 색을 가장 가까운 팔레트 색으로 스냅하고, 비율이 다르면 비틀림을 알린다', () => {
    const snapped = normalizeStrip(stripSource(), { size: [20, 5], fill: 'opaque', palette: [OUTLINE, CLOTH] }, KEY)
    assert.ok(snapped.report.colors!.every((c) => c === OUTLINE.hex || c === CLOTH.hex))
    // 규격 8:1인데 띠는 4:1(높다): crop은 위 10행을 자르고 바닥을 남긴다, stretch는 가로로 늘린다
    const crop = normalizeStrip(stripSource(), { size: [32, 4], fill: 'opaque', palette: null }, KEY)
    assert.deepEqual([crop.report.band, crop.report.crop_top, crop.report.anisotropy], [[10, 20, 80, 10], 10, 1])
    const stretch = normalizeStrip(stripSource(), { size: [32, 4], fill: 'opaque', palette: null, fit: 'stretch' }, KEY)
    assert.equal(stretch.report.anisotropy, 0.5)
    assert.ok(stretch.report.notes.some((n) => n.includes('늘어난다')))
  })

  it('넓은 띠: tile이면 이음 점수가 가장 작은 창으로 가로를 자르고, 아니면 거절한다', () => {
    // 규격 2:1인데 띠는 4:1(넓다) → 폭 40 창. 왼쪽 절반 파랑·오른쪽 절반 빨강이라 양 끝이 같은 색인 창은 파랑 안(10..49) 또는 빨강 안
    assert.throws(() => normalizeStrip(stripSource(), { size: [8, 4], fill: 'opaque', palette: null }, KEY), /넓다/)
    const r = normalizeStrip(stripSource(), { size: [8, 4], fill: 'opaque', palette: null, tile: true }, KEY)
    assert.equal(r.report.band[2], 40)
    assert.equal(r.report.seam, 0)
    assert.deepEqual(r.report.crop_x, [r.report.band[0] - 10, 90 - r.report.band[0] - 40])
    assert.equal(r.report.anisotropy, 1)
  })
})
