import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { estimateBlock, runGate, type GateImage } from '../src/gate'
import { decodePng } from '../src/png'
import { encodeRgbaPng } from '../src/png-write'
import { createRaster, fillRect, upscale, blit, type Raster } from '../src/raster'
import { renderTemplate, writeTemplate } from '../src/template'
import { DEFAULT_SPECS, parseTemplateArgs, templateMain } from '../src/template-cli'
import { cellSpecs, computeLayout, loadSpecs, parseRowToken, resolveSheet, SpecError, type LoadedSpecs, type SpecFile } from '../src/template-spec'

const MAGENTA: [number, number, number] = [255, 0, 255]
const CYAN: [number, number, number] = [0, 255, 255]
const DARK: [number, number, number] = [43, 34, 51]
const LIGHT: [number, number, number] = [232, 184, 154]
const BLUE: [number, number, number] = [90, 127, 168]

// 작은 시험 규격: 캔버스 256×192, 여백 8. 칸 16×16 × 3열 × 2행 → S = min(⌊240/48⌋, ⌊176/32⌋) = 5, 격자 240×160, 원점 (8, 16)
function testFile(root = '.'): SpecFile {
  return {
    version: 1,
    root,
    out_dir: 'out',
    canvas: { landscape: [256, 192], portrait: [192, 256], margin: [8, 8] },
    colors: { key: '#FF00FF', guide: '#00FFFF', silhouette: '#808080' },
    key: { tolerance: 90, alpha_threshold: 128, despill: 60 },
    gate: { ground_tol: 1, center_tol: 2, height_tol: 0.08, block_tol: 0.15, scale_tol: 0.06, min_background: 0.99, max_partial_alpha: 0.01, min_fill: 0.98, max_guide_pixels: 0 },
    families: {
      chr: {
        cell: [16, 16], cols: 3, align: 'ground', ground_y: 14, center_x: 7, height: 10, margin: 0,
        placeholder: { source: 'ref.png', cell: [16, 16], frame: [0, 0] },
        actions: { idle: { frames: 3 }, jump: { frames: 3, lift: [0, 2, 0] }, lie: { frames: 2, height: null, center: false } },
      },
      strip: { cell: [32, 8], cols: 1, align: 'none', ground_y: 6, margin: 0, canvas_margin: [0, 8] },
    },
    sheets: [
      { name: 'test_chr', family: 'chr', rows: ['idle', 'jump'] },
      { name: 'test_tall', family: 'chr', cols: 3, rows: ['idle', 'idle', 'idle', 'idle', 'idle'] },
      { name: 'test_near', family: 'strip', rows: [{ action: 'near', frames: 1 }], fill: 'partial', ground_band: true },
      { name: 'test_scene', family: 'strip', rows: [{ action: 'scene', frames: 1 }], fill: 'opaque' },
    ],
  }
}

function specsOf(file: SpecFile, root = process.cwd()): LoadedSpecs {
  return { path: join(root, 'specs.json'), root, file }
}

/** 논리 8×10 그림: 외곽선 + 속은 1논리화소 체크무늬(색 경계가 블록마다 생겨 블록 크기를 잴 수 있다) */
function figure(w = 8, h = 10, check = 1): Raster {
  const r = createRaster(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1
      const c = edge ? DARK : (Math.floor(x / check) + Math.floor(y / check)) % 2 === 0 ? LIGHT : BLUE
      fillRect(r, x, y, 1, 1, c)
    }
  }
  return r
}

interface Placed { col: number; row: number; dx?: number; dy?: number; fig?: Raster }

/** 틀과 같은 배치로 납품 그림을 만든다. 그림 최하단 = 13 − lift + dy, 가로 중심(열 중앙값) = 7 + dx */
function delivery(specs: LoadedSpecs, sheetName: string, placed: Placed[], size?: [number, number]): Raster & GateImage {
  const sheet = resolveSheet(specs, sheetName)
  const layout = computeLayout(specs, sheet)
  const cells = cellSpecs(sheet, layout)
  const [W, H] = size ?? layout.canvas
  const out = createRaster(W, H)
  fillRect(out, 0, 0, W, H, MAGENTA)
  for (const p of placed) {
    const c = cells.find((k) => k.col === p.col && k.row === p.row)!
    const fig = p.fig ?? figure()
    const logical = createRaster(sheet.cell[0], sheet.cell[1])
    const bottom = 13 - c.lift + (p.dy ?? 0)
    blit(logical, fig, 7 - Math.floor((fig.width - 1) / 2) + (p.dx ?? 0), bottom - fig.height + 1)
    blit(out, upscale(logical, layout.S), c.x, c.y)
  }
  return out
}

const FULL: Placed[] = [0, 1, 2].flatMap((col) => [0, 1].map((row) => ({ col, row })))

// 붙어 있는 장면 칸을 메모리에서 검사한다. 에셋 파일은 만들지 않는다.
function joinedScene() {
  const file = testFile()
  file.families.strip!.cell = [8, 8]
  const sheet = file.sheets.find((s) => s.name === 'test_scene')!
  sheet.cols = 4
  sheet.rows = [{ action: 'scene', frames: 4 }]
  sheet.ground_band = true
  const specs = specsOf(file)
  const layout = computeLayout(specs, resolveSheet(specs, sheet.name))
  const img = createRaster(...layout.canvas)
  fillRect(img, 0, 0, img.width, img.height, MAGENTA)
  for (let y = 0; y < layout.gridH; y += layout.S) {
    for (let x = 0; x < layout.gridW; x += layout.S) {
      const color = (x / layout.S + y / layout.S) % 2 === 0 ? LIGHT : BLUE
      fillRect(img, layout.x0 + x, layout.y0 + y, layout.S, layout.S, color)
    }
  }
  return { specs, layout, img, name: sheet.name }
}

describe('배치 틀 규격', () => {
  it('S는 격자가 캔버스 − 여백에 들어가는 가장 큰 정수이고 격자는 가운데다', () => {
    const specs = specsOf(testFile())
    const l = computeLayout(specs, resolveSheet(specs, 'test_chr'))
    assert.deepEqual([l.S, l.x0, l.y0, l.gridW, l.gridH, l.orientation], [5, 8, 16, 240, 160, 'landscape'])
  })

  it('세로 캔버스는 S가 더 클 때만 고른다', () => {
    const specs = specsOf(testFile())
    // 3열 × 5행: 가로 min(⌊240/48⌋, ⌊176/80⌋) = 2, 세로 min(⌊176/48⌋, ⌊240/80⌋) = 3
    const l = computeLayout(specs, resolveSheet(specs, 'test_tall'))
    assert.deepEqual([l.orientation, l.S, l.canvas], ['portrait', 3, [192, 256]])
  })

  it('띠는 가로 여백 0으로 캔버스 폭을 채우고 세로 가운데에 놓인다', () => {
    const specs = specsOf(testFile())
    const l = computeLayout(specs, resolveSheet(specs, 'test_near'))
    // ⌊256/32⌋ = 8, ⌊176/8⌋ = 22 → 8. 띠 256×64, y0 = (192 − 64)/2
    assert.deepEqual([l.S, l.x0, l.y0, l.gridW, l.gridH], [8, 0, 64, 256, 64])
  })

  it('동작 목록을 합치고 --rows 표기를 푼다', () => {
    const specs = specsOf(testFile())
    const s = resolveSheet(specs, 'test_chr')
    assert.deepEqual(s.rows[1]!.lift, [0, 2, 0])
    assert.deepEqual(s.rows[0]!.height, [10, 10, 10])
    assert.equal(s.bottom, 13)
    const cells = cellSpecs(s, computeLayout(specs, s))
    assert.equal(cells.find((c) => c.row === 1 && c.col === 1)!.bottom, 11)
    assert.deepEqual(parseRowToken('walk:6'), { action: 'walk', frames: 6 })
    assert.equal(parseRowToken('idle'), 'idle')
    const o = resolveSheet(specs, 'test_chr', [parseRowToken('lie'), parseRowToken('idle:2')])
    assert.deepEqual(o.rows.map((r) => [r.action, r.frames, r.height[0], r.center[0]]), [['lie', 2, null, false], ['idle', 2, 10, true]])
    assert.throws(() => resolveSheet(specs, 'test_chr', [parseRowToken('idle:4')]), SpecError)
    assert.throws(() => resolveSheet(specs, 'test_chr', ['nope']), SpecError)
  })

  it('저장소 specs.json의 모든 시트가 풀리고 결정된 S와 맞는다', () => {
    const specs = loadSpecs(DEFAULT_SPECS)
    const S = (n: string): [number, number, number] => {
      const l = computeLayout(specs, resolveSheet(specs, n))
      return [l.S, l.x0, l.y0]
    }
    assert.deepEqual(S('chr_actions_a'), [4, 192, 32]) // 6×5 × 48 → 셀 192
    assert.equal(S('enm_rat')[0], 8)
    assert.deepEqual(S('bg_far'), [6, 0, 320]) // 1536×384, y 320..703
    assert.deepEqual(S('scene_event'), [3, 0, 416]) // 512×64 → 1536×192
    for (const s of specs.file.sheets) {
      const l = computeLayout(specs, resolveSheet(specs, s.name))
      assert.ok(l.x0 >= Math.min(32, specs.file.families[s.family]!.canvas_margin?.[0] ?? 32), s.name)
      assert.ok(l.x0 + l.gridW <= l.canvas[0] && l.y0 + l.gridH <= l.canvas[1] - 32, s.name)
    }
  })
})

describe('art:template 그리기', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tpl-'))
  // 자리표시 원본: 16×16 칸 1개, 그림 최하단 12·열 중앙값 5(규격 13·7로 옮겨져야 한다)
  const ref = createRaster(16, 16)
  blit(ref, figure(), 2, 3)
  writeFileSync(join(dir, 'ref.png'), encodeRgbaPng(16, 16, ref.rgba))
  const specs = specsOf(testFile(), dir)

  it('grid는 칸 안이 전부 자홍이고 안내 눈금은 여백에만 있다', () => {
    const t = renderTemplate(specs, 'test_chr')
    const g = t.grid
    assert.deepEqual([g.width, g.height], [256, 192])
    let inside = 0
    let guides = 0
    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        const o = (y * g.width + x) * 4
        const rgb = [g.rgba[o], g.rgba[o + 1], g.rgba[o + 2]]
        const isGuide = rgb[0] === 0 && rgb[1] === 255 && rgb[2] === 255
        if (isGuide) guides++
        const inGrid = x >= 8 && x < 248 && y >= 16 && y < 176
        if (inGrid && !(rgb[0] === 255 && rgb[1] === 0 && rgb[2] === 255)) inside++
      }
    }
    assert.equal(inside, 0)
    assert.ok(guides > 0)
    // 지면선 눈금: 행 0의 논리 행 14 = y 16 + 70 .. +5, 왼쪽 여백
    const gy = 16 + 14 * 5
    const o = (gy * 256 + 2) * 4
    assert.deepEqual([g.rgba[o], g.rgba[o + 1], g.rgba[o + 2]], CYAN)
    assert.deepEqual(t.json.ground_y_px, [86, 166])
    assert.deepEqual(t.json.cells[4]!.bottom_px, [16 + 80 + 11 * 5, 16 + 80 + 12 * 5]) // 행 1 열 1: lift 2 → 최하단 11
  })

  it('placeholder는 기준 그림을 ×S로 키워 규격 지면선(− lift)·중심에 놓고, silhouette은 회색이다', () => {
    const t = renderTemplate(specs, 'test_chr')
    const p = t.placeholder!
    const cell = (col: number, row: number): { bottom: number; median: number } => {
      const xs: number[] = []
      let bottom = -1
      for (let y = 0; y < 80; y++) {
        for (let x = 0; x < 80; x++) {
          const o = ((16 + row * 80 + y) * 256 + 8 + col * 80 + x) * 4
          if (p.rgba[o] === 255 && p.rgba[o + 1] === 0 && p.rgba[o + 2] === 255) continue
          xs.push(x)
          bottom = y
        }
      }
      xs.sort((a, b) => a - b)
      return { bottom: Math.floor(bottom / 5), median: Math.floor(xs[(xs.length - 1) >> 1]! / 5) }
    }
    assert.deepEqual(cell(0, 0), { bottom: 13, median: 7 })
    assert.deepEqual(cell(1, 1), { bottom: 11, median: 7 })
    assert.equal(t.json.placeholder!.height, 10)
    const s = t.silhouette!
    const o = ((16 + 13 * 5) * 256 + 8 + 7 * 5) * 4
    assert.deepEqual([s.rgba[o], s.rgba[o + 1], s.rgba[o + 2]], [128, 128, 128])
  })

  it('파일 3종과 JSON을 쓰고 PNG는 다시 읽힌다', () => {
    const files = writeTemplate(renderTemplate(specs, 'test_chr'), join(dir, 'out'))
    assert.equal(files.length, 4)
    const img = decodePng(readFileSync(join(dir, 'out', 'test_chr.grid.png')))
    assert.deepEqual([img.width, img.height, img.colorType], [256, 192, 3])
    const j = JSON.parse(readFileSync(join(dir, 'out', 'test_chr.json'), 'utf8')) as { S: number; used_cells: number }
    assert.deepEqual([j.S, j.used_cells], [5, 6])
  })

  it('원본이 없으면 정규화하라고 알린다', () => {
    const f = testFile()
    f.families.chr!.placeholder = { source: 'none.png', cell: [16, 16], frame: [0, 0] }
    assert.throws(() => renderTemplate(specsOf(f, dir), 'test_chr'), /자리표시 원본이 없다/)
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('art:gate 납품 문', () => {
  const specs = specsOf(testFile())
  const gate = (img: GateImage, noCanvas = false, sheet = 'test_chr') => runGate(specs, sheet, img, { noCanvas })

  it('틀대로 그린 납품은 통과한다', () => {
    const r = gate(delivery(specs, 'test_chr', FULL))
    assert.equal(r.pass, true, r.feedback)
    assert.equal(r.cells.filter((c) => c.used).every((c) => c.ground_delta === 0 && c.height === 10), true)
    assert.equal(r.block_sheet, 5)
  })

  it('떠 있는 발은 지면선 지적과 몇 블록인지 영어 문장으로 돌려준다', () => {
    const r = gate(delivery(specs, 'test_chr', FULL.map((p) => (p.col === 2 && p.row === 0 ? { ...p, dy: -3 } : p))))
    assert.equal(r.pass, false)
    assert.deepEqual(r.failures.map((f) => [f.code, f.cell]), [['ground', [2, 0]]])
    assert.match(r.feedback, /Cell \(2,0\) "idle 3": the lowest pixel is 3 blocks above the ground line of the other frames in this row; move the figure down 3 blocks/)
    assert.deepEqual(r.warnings.map((w) => [w.code, w.cell]), [['ground', [2, 0]]])
  })

  it('틀 지면선에서 시트 전체가 어긋나도 행끼리 맞으면 경고만 하고 통과한다', () => {
    const r = gate(delivery(specs, 'test_chr', FULL.map((p) => ({ ...p, dy: -2 }))))
    assert.equal(r.pass, true, r.feedback)
    assert.equal(r.warnings.filter((w) => w.code === 'ground').length, 6)
    assert.ok(r.cells.filter((c) => c.used).every((c) => c.ground_delta === 0 && c.ground_template === -2), JSON.stringify(r.cells))
    assert.match(r.feedback, /No regeneration needed/)
  })

  it('점프 프레임(lift)은 떠 있어야 통과하고 바닥에 붙으면 실패한다', () => {
    const r = gate(delivery(specs, 'test_chr', FULL.map((p) => (p.col === 1 && p.row === 1 ? { ...p, dy: 2 } : p))))
    assert.deepEqual(r.failures.map((f) => [f.code, f.cell]), [['ground', [1, 1]]])
    assert.match(r.feedback, /must float exactly 2 blocks above the ground line/)
  })

  it('가로 중심·키·빈 칸·없는 칸을 가른다', () => {
    const placed: Placed[] = [
      { col: 0, row: 0, dx: 3 },
      { col: 1, row: 0, fig: figure(8, 13) },
      { col: 2, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 },
    ]
    const img = delivery(specs, 'test_chr', placed)
    // 틀에서 쓰는 칸은 6개 — (2,1)은 비었다
    const r = gate(img)
    const codes = r.failures.map((f) => `${f.code}@${f.cell?.join(',')}`)
    assert.deepEqual(codes.sort(), ['missing@2,1', 'scale@1,0'])
    assert.deepEqual(r.warnings.map((w) => `${w.code}@${w.cell?.join(',')}`), ['center@0,0'])
    assert.match(r.warnings[0]!.message, /horizontal center 3.4 blocks right of the template center mark/)
    assert.match(r.feedback, /30% taller than the other frames of this row \(13 vs 10 blocks\)/)
    assert.doesNotMatch(r.feedback, /center/)
  })

  it('빈 칸이어야 할 곳의 그림, 안내 색, 격자 밖 그림, 반투명 속을 잡는다', () => {
    const f = testFile()
    f.families.chr!.actions!.idle = { frames: 2 }
    const sp = specsOf(f)
    const img = delivery(sp, 'test_chr', [...FULL])
    fillRect(img, 0, 0, 4, 4, CYAN)
    fillRect(img, 150, 180, 50, 10, DARK)
    const layout = computeLayout(sp, resolveSheet(sp, 'test_chr'))
    // (0,1) 그림 속 알파 200
    for (let y = layout.y0 + 80 + 40; y < layout.y0 + 80 + 60; y++) {
      for (let x = layout.x0 + 30; x < layout.x0 + 45; x++) img.rgba[(y * img.width + x) * 4 + 3] = 200
    }
    const r = runGate(sp, 'test_chr', img, { noCanvas: false })
    const codes = new Set(r.failures.map((x) => x.code))
    for (const c of ['unexpected', 'guide', 'stray', 'alpha', 'background']) assert.ok(codes.has(c as never), c)
    assert.match(r.feedback, /Cell \(2,0\) "idle \(empty\)": this cell must stay empty/)
  })

  it('화소 블록이 S와 다르면 경고만 한다(정규화가 다시 뽑는다)', () => {
    const coarse = upscale(figure(4, 5, 1), 2) // 논리 8×10이지만 그림 화소 하나가 2×2 논리 → 블록 10화소
    const r = gate(delivery(specs, 'test_chr', FULL.map((p) => ({ ...p, fig: coarse }))))
    assert.equal(r.pass, true, r.feedback)
    assert.ok(r.warnings.some((w) => w.code === 'block'), JSON.stringify(r.warnings))
    assert.equal(r.block_sheet, 10)
  })

  it('규격 키와 다른 크기는 경고와 배율, 행끼리 다른 축척은 실패', () => {
    const tall = figure(8, 12)
    const all = gate(delivery(specs, 'test_chr', FULL.map((p) => ({ ...p, fig: tall }))))
    assert.equal(all.pass, true, all.feedback)
    assert.equal(all.height_ratio, 1.2)
    assert.equal(all.scale_factor, 0.833)
    assert.ok(all.warnings.some((w) => w.code === 'height' && /resamples the sheet by x0.83/.test(w.message)), JSON.stringify(all.warnings))
    const mixed = gate(delivery(specs, 'test_chr', FULL.map((p) => (p.row === 1 ? { ...p, fig: tall } : p))))
    assert.equal(mixed.pass, false)
    assert.deepEqual(mixed.failures.map((f) => [f.code, f.cell]), [['scale', null], ['scale', null]])
    assert.match(mixed.feedback, /Row 1 "jump": the figures are 9% larger than in the other rows/)
  })

  it('이웃 그림과 닿거나 겹치면 실패한다', () => {
    const l = computeLayout(specs, resolveSheet(specs, 'test_chr'))
    // 닿음: (0,0)·(1,0) 그림(논리 x 4..11 · 20..27) 사이를 논리 11..20 막대로 잇는다
    const touch = delivery(specs, 'test_chr', FULL)
    fillRect(touch, l.x0 + 11 * l.S, l.y0 + 8 * l.S, 10 * l.S, l.S, DARK)
    // 겹침: (1,0)을 비우고 그 그림을 (0,0) 그림에 논리 2열 겹쳐 그린다
    const overlap = delivery(specs, 'test_chr', FULL.filter((p) => !(p.col === 1 && p.row === 0)))
    blit(overlap, upscale(figure(), l.S), l.x0 + 9 * l.S, l.y0 + 4 * l.S)
    for (const img of [touch, overlap]) {
      const r = gate(img)
      // 합쳐진 덩어리는 무게중심이 든 칸 하나의 것이 되고, 짝 칸은 빈다(어느 쪽인지는 무게중심에 달렸다)
      const codes = r.failures.map((f) => `${f.code}@${f.cell?.join(',')}`).sort()
      assert.ok(['missing@0,0|touch@1,0', 'missing@1,0|touch@0,0'].includes(codes.join('|')), `${codes.join('|')} ${r.feedback}`)
      assert.match(r.feedback, /joined to a neighbouring frame/)
    }
  })

  it('이미지 가장자리에 닿은 그림은 실패, 정확한 자홍이 아닌 배경은 경고', () => {
    const img = delivery(specs, 'test_chr', FULL, undefined)
    for (let i = 0; i < img.width * img.height; i++) {
      if (img.rgba[i * 4] === 255 && img.rgba[i * 4 + 1] === 0) { img.rgba[i * 4] = 250; img.rgba[i * 4 + 1] = 3; img.rgba[i * 4 + 2] = 249 }
    }
    const soft = gate(img)
    assert.equal(soft.pass, true, soft.feedback)
    assert.ok(soft.warnings.some((w) => w.code === 'key_color' && /#FA03F9/.test(w.message)), JSON.stringify(soft.warnings))
    fillRect(img, 0, 100, 12, 12, DARK)
    const edge = gate(img)
    assert.ok(edge.failures.some((f) => f.code === 'edge'), edge.feedback)
  })

  it('캔버스 크기가 다르면 칸 검사 없이 캔버스 실패', () => {
    const r = gate(delivery(specs, 'test_chr', FULL, [300, 200]))
    assert.deepEqual(r.failures.map((f) => f.code), ['canvas'])
    assert.match(r.feedback, /exactly 256x192 pixels/)
  })

  it('--no-canvas는 등간격 격자·잰 블록 크기로 같은 행끼리 지면선을 비교한다', () => {
    // 틀 없이 만든 납품: 캔버스 여백 없이 칸 3×2가 그림 전체(칸당 16·S=5 → 240×160)
    const sheet = resolveSheet(specs, 'test_chr')
    const mk = (lifted: boolean): GateImage => {
      const out = createRaster(240, 160)
      fillRect(out, 0, 0, 240, 160, MAGENTA)
      for (const p of FULL) {
        const logical = createRaster(16, 16)
        const lift = sheet.rows[p.row]!.lift[p.col]!
        const extra = lifted && p.col === 0 && p.row === 0 ? 4 : 0
        blit(logical, figure(), 4, 13 - lift - extra - 9)
        blit(out, upscale(logical, 5), p.col * 80, p.row * 80 + 3) // 행 전체가 3화소 내려가도 칸끼리는 같다
      }
      return out
    }
    const ok = runGate(specs, 'test_chr', mk(false), { noCanvas: true })
    assert.equal(ok.pass, true, ok.feedback)
    assert.deepEqual([ok.mode, ok.S_origin, ok.grid], ['no-canvas', 'cell_ratio', 'cells'])
    assert.ok(Math.abs(ok.S - 5) < 0.1, String(ok.S))
    const bad = runGate(specs, 'test_chr', mk(true), { noCanvas: true })
    assert.deepEqual(bad.failures.map((f) => [f.code, f.cell]), [['ground', [0, 0]]])
    assert.match(bad.feedback, /4 blocks above the ground line of the other frames in this row/)
  })

  it('--no-canvas: 그림이 등간격 칸에 앉지 않으면 내용에서 행·열을 추정해 대조한다', () => {
    // 왼쪽에 120화소 빈 여백: 등간격 칸(120폭)으로는 무게중심이 1·2·2열에 몰린다
    const sheet = resolveSheet(specs, 'test_chr')
    const mk = (frames: Placed[]): GateImage => {
      const out = createRaster(360, 160)
      fillRect(out, 0, 0, 360, 160, MAGENTA)
      for (const p of frames) {
        const logical = createRaster(16, 16)
        blit(logical, figure(), 4, 13 - sheet.rows[p.row]!.lift[p.col]! - 9)
        blit(out, upscale(logical, 5), 120 + p.col * 80, p.row * 80)
      }
      return out
    }
    const ok = runGate(specs, 'test_chr', mk(FULL), { noCanvas: true })
    assert.equal(ok.pass, true, ok.feedback)
    assert.equal(ok.grid, 'inferred')
    // 점프 lift는 칸 비율 S(7.5)로 재어 그린 블록(5)과 달라 1 안쪽으로 어긋날 수 있다
    assert.ok(ok.cells.filter((c) => c.used).every((c) => c.pixels > 0 && Math.abs(c.ground_delta!) <= 1), JSON.stringify(ok.cells))
    // 한 칸이 빠지면 추정이 맞지 않아 등간격 칸으로 판정하고 실패한다
    const bad = runGate(specs, 'test_chr', mk(FULL.slice(1)), { noCanvas: true })
    assert.equal(bad.pass, false)
    assert.equal(bad.grid, 'cells')
  })

  it('띠: 지면선 아래가 비면 ground_band, 불투명 띠가 비면 fill 실패', () => {
    const l = computeLayout(specs, resolveSheet(specs, 'test_near'))
    const img = createRaster(256, 192)
    fillRect(img, 0, 0, 256, 192, MAGENTA)
    // 가까운 층: 위 절반은 비고(자홍) 논리 행 3~7을 칠함 → 지면선 6 아래 채움
    for (let y = 3; y < 8; y++) for (let x = 0; x < 32; x++) fillRect(img, x * 8, l.y0 + y * 8, 8, 8, (x + y) % 2 ? LIGHT : BLUE)
    assert.equal(runGate(specs, 'test_near', img, { noCanvas: false }).pass, true)
    fillRect(img, 64, l.y0 + 6 * 8, 64, 16, MAGENTA)
    const r = runGate(specs, 'test_near', img, { noCanvas: false })
    assert.deepEqual(r.failures.map((f) => f.code), ['ground_band'])
    const scene = runGate(specs, 'test_scene', img, { noCanvas: false })
    assert.ok(scene.failures.some((f) => f.code === 'fill'))
  })

  it('불투명 장면 네 칸은 경계에서 붙어 있어도 각 칸으로 판정한다', () => {
    const { specs: sp, img, name } = joinedScene()
    const result = runGate(sp, name, img, { noCanvas: false })
    assert.equal(result.pass, true, result.feedback)
    assert.equal(result.cells.length, 4)
    assert.ok(result.cells.every((c) => c.pixels > 0 && c.fill === 1))
  })

  it('장면 칸을 나누어 검사해도 빈 칸과 띠 밖으로 이어진 그림을 잡는다', () => {
    const { specs: sp, layout, img, name } = joinedScene()
    const panelWidth = layout.gridW / 4
    fillRect(img, layout.x0 + panelWidth, layout.y0, panelWidth, layout.gridH, MAGENTA)
    fillRect(img, layout.x0, layout.y0 - layout.S * 2, panelWidth, layout.S * 2, BLUE)
    const result = runGate(sp, name, img, { noCanvas: false })
    assert.equal(result.pass, false)
    assert.ok(result.failures.some((f) => f.code === 'missing' && f.cell?.[0] === 1))
    assert.ok(result.failures.some((f) => f.code === 'stray'), result.feedback)
  })

  it('블록 추정: 깨끗한 정수배 그림은 S를 정확히 잰다', () => {
    const img = createRaster(120, 120)
    fillRect(img, 0, 0, 120, 120, MAGENTA)
    blit(img, upscale(figure(20, 20), 6), 0, 0)
    const owner = new Int32Array(120 * 120).fill(-1)
    for (let i = 0; i < 120 * 120; i++) if (img.rgba[i * 4 + 1] !== 0) owner[i] = 0
    assert.equal(estimateBlock(img, owner, 0, 0, 0, 120, 120), 6)
  })
})

describe('template·gate 명령줄', () => {
  it('인자를 푼다', () => {
    const a = parseTemplateArgs(['gate', 'x.png', '--spec', 'enm_rat', '--no-canvas', '--rows=idle,walk:6', '--ground-tol', '2'])
    assert.deepEqual([a.command, a.paths, a.spec, a.noCanvas, a.tolerances.ground_tol], ['gate', ['x.png'], 'enm_rat', true, 2])
    assert.deepEqual(a.rows, ['idle', { action: 'walk', frames: 6 }])
    assert.deepEqual(parseTemplateArgs(['template', 'a', 'b']).names, ['a', 'b'])
    assert.throws(() => parseTemplateArgs(['gate', 'x.png']), /--spec/)
  })

  it('gate 종료 코드: 통과 0 · 실패 1 · 사용법 2', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gate-'))
    try {
      const specs = specsOf(testFile())
      writeFileSync(join(dir, 'specs.json'), JSON.stringify(testFile(dir)))
      const good = delivery(specs, 'test_chr', FULL)
      writeFileSync(join(dir, 'good.png'), encodeRgbaPng(good.width, good.height, good.rgba))
      const bad = delivery(specs, 'test_chr', FULL.slice(1))
      writeFileSync(join(dir, 'bad.png'), encodeRgbaPng(bad.width, bad.height, bad.rgba))
      const write = process.stdout.write.bind(process.stdout)
      const err = process.stderr.write.bind(process.stderr)
      process.stdout.write = (() => true) as typeof process.stdout.write
      process.stderr.write = (() => true) as typeof process.stderr.write
      let codes: number[]
      try {
        codes = [
          templateMain(['gate', join(dir, 'good.png'), '--spec', 'test_chr', '--specs', join(dir, 'specs.json')]),
          templateMain(['gate', join(dir, 'bad.png'), '--spec', 'test_chr', '--specs', join(dir, 'specs.json')]),
          templateMain(['gate', join(dir, 'bad.png')]),
        ]
      } finally {
        process.stdout.write = write
        process.stderr.write = err
      }
      assert.deepEqual(codes, [0, 1, 2])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
