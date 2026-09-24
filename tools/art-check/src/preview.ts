// 검수용 확대본(ASSET_ORDERS 0.10절 V1·V3·V7). 게임이 읽지 않는다.
//   <시트>.x4.png           정규화 시트 ×4(체크무늬 위, 칸 경계·지면선 표시)
//   window.x4.png            520 × 64 기본 창 모형(03 §2.2) — 대기(+걷기) 프레임마다 한 줄
//   window-small.x4.png      320 × 48 축소 창(03 §3) — 배경 아래 48줄, 적은 x 56~92
//   layers.x4.png            칸마다 [기준 | 레이어 합성 | 차이] (빨강 = 기준 실루엣 밖 레이어, 파랑 = 레이어가 안 덮은 기준)
//   derived-<파생>.x4.png     칸마다 [기준 | 재합성 | 파생 부류만 | 차이] (derive를 먼저 돌린 파생 항목만)
//   <48>_vs_<32>.x1.png/.x2.png  32·48 실크기·2배 비교
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { derivedOutputs, findEntry, referenceOf, type DerivedEntry, type LoadedMap, type ReferenceEntry } from './imagegen-map'
import { colorDistance } from './normalize'
import { decodePng } from './png'
import { encodeRgbaPng } from './png-write'
import { blit, createRaster, crop, fillRect, hexRgb, upscale, type Raster } from './raster'

const SKY = hexRgb('#B9C8FF')
const GRASS = hexRgb('#8FC06A')
const GRASS_LINE = hexRgb('#5E9A4A')
const PANEL = hexRgb('#F4EFE6')
const CHECK_A = hexRgb('#D6D6D6')
const CHECK_B = hexRgb('#C4C4C4')

/** 창 배치 수치(03 §2.2·§3, 15 §1.1). 창 모형만 쓴다 */
const WINDOW = { w: 520, h: 64, ground: 56, charX: 16, enemyX: 72, enemyW: 48, sceneW: 128, panelX: 136, panelEnd: 512 }
const SMALL = { w: 320, h: 48, cropTop: 16, enemyX: 56, enemyW: 36, sceneW: 96, panelX: 104, panelEnd: 312 }

interface Sheet {
  name: string
  raster: Raster
  entry: ReferenceEntry
}

function loadSheet(lm: LoadedMap, name: string): Sheet {
  const file = join(lm.outDir, `${name}.png`)
  if (!existsSync(file)) throw new Error(`${file}이 없다 — 먼저 normalize를 돌려라`)
  const png = decodePng(readFileSync(file))
  return { name, raster: { width: png.width, height: png.height, rgba: png.rgba }, entry: referenceOf(lm.map, findEntry(lm.map, name)) }
}

function cellOf(s: Sheet, col: number, row: number): Raster {
  const [cw, ch] = s.entry.cell
  return crop(s.raster, col * cw, row * ch, cw, ch)
}

/** 내용이 있는 칸 [열, 행] 목록(행 순서) */
function filledCells(s: Sheet): [number, number][] {
  const out: [number, number][] = []
  s.entry.rows.forEach((r, row) => {
    for (let col = 0; col < r.frames; col++) out.push([col, row])
  })
  return out
}

/** 셀 안 지면선 y(발이 딛는 선 = 최하단 불투명 행 + 1). 가운데 정렬 시트면 칸 아래 끝 */
function groundOf(s: Sheet): number {
  return s.entry.align.mode === 'ground' ? s.entry.align.bottom + 1 : s.entry.cell[1]
}

function rowIndex(s: Sheet, action: string): number {
  return s.entry.rows.findIndex((r) => r.action === action)
}

function save(dir: string, file: string, r: Raster): string {
  const path = join(dir, file)
  writeFileSync(path, encodeRgbaPng(r.width, r.height, r.rgba))
  return path
}

function checker(w: number, h: number): Raster {
  const r = createRaster(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) fillRect(r, x, y, 1, 1, ((x >> 1) + (y >> 1)) % 2 === 0 ? CHECK_A : CHECK_B)
  return r
}

/** (a) 시트 ×4: 체크무늬 + 칸 경계(회색) + 지면선(파랑) + 가로 중심(주황 점) */
function sheetPreview(s: Sheet): Raster {
  const k = 4
  const base = checker(s.raster.width, s.raster.height)
  blit(base, s.raster, 0, 0)
  const big = upscale(base, k)
  const [cw, ch] = s.entry.cell
  const [cols, rows] = s.entry.grid
  for (let c = 1; c < cols; c++) fillRect(big, c * cw * k, 0, 1, big.height, [110, 110, 110])
  for (let r = 1; r < rows; r++) fillRect(big, 0, r * ch * k, big.width, 1, [110, 110, 110])
  if (s.entry.align.mode === 'ground') {
    const { bottom, center_x } = s.entry.align
    for (let r = 0; r < rows; r++) {
      fillRect(big, 0, (r * ch + bottom + 1) * k, big.width, 1, [60, 90, 220], 160)
      for (let c = 0; c < cols; c++) fillRect(big, (c * cw + center_x) * k + 1, (r * ch + bottom + 1) * k + 1, 2, 3, [230, 120, 30])
    }
  }
  return big
}

/** 창 배경: 들판 층이 모두 있으면 이어 붙이고, 없으면 단색 하늘·풀밭 */
function background(lm: LoadedMap, w: number, h: number, ground: number): Raster {
  const bg = createRaster(w, h)
  const field = lm.map.preview.field
  if (field.length > 0 && field.every((n) => existsSync(join(lm.outDir, `${n}.png`)))) {
    for (const n of field) {
      const png = decodePng(readFileSync(join(lm.outDir, `${n}.png`)))
      const layer: Raster = { width: png.width, height: png.height, rgba: png.rgba }
      for (let x = 0; x < w; x += layer.width) blit(bg, layer, x, h - layer.height)
    }
    return bg
  }
  fillRect(bg, 0, 0, w, ground, SKY)
  fillRect(bg, 0, ground, w, h - ground, GRASS)
  fillRect(bg, 0, ground, w, 1, GRASS_LINE)
  return bg
}

/** 글자 판(88%)과 그 앞 8픽셀 구분 띠(0 → 88% 경사) */
function panel(r: Raster, sceneW: number, x0: number, x1: number): void {
  for (let x = sceneW; x < x0; x++) fillRect(r, x, 0, 1, r.height, PANEL, Math.round((224 * (x - sceneW + 1)) / (x0 - sceneW + 1)))
  fillRect(r, x0, 0, x1 - x0, r.height, PANEL, 224)
}

interface MockParts {
  character: Sheet
  frame: [number, number]
  enemy: Sheet
  enemyFrame: [number, number]
  props: Sheet[]
}

/** (b) 520 × 64 기본 창 한 장(실크기) */
function windowMock(lm: LoadedMap, p: MockParts): Raster {
  const win = background(lm, WINDOW.w, WINDOW.h, WINDOW.ground)
  panel(win, WINDOW.sceneW, WINDOW.panelX, WINDOW.panelEnd)
  blit(win, cellOf(p.character, ...p.frame), WINDOW.charX, WINDOW.ground - groundOf(p.character))
  const [ew] = p.enemy.entry.cell
  blit(win, cellOf(p.enemy, ...p.enemyFrame), WINDOW.enemyX + Math.floor((WINDOW.enemyW - ew) / 2), WINDOW.ground - groundOf(p.enemy))
  // 소품(무기 등)은 기준점이 아직 없어 손에 들리지 못한다 — 글자 판 자리에 실크기로 늘어놓아 크기만 비교한다
  let x = WINDOW.panelX + 4
  for (const s of p.props) {
    const [cw, ch] = s.entry.cell
    for (const [col, row] of filledCells(s)) {
      if (x + cw > WINDOW.panelEnd) break
      blit(win, cellOf(s, col, row), x, Math.floor((WINDOW.h - ch) / 2))
      x += cw
    }
  }
  return win
}

/** (c) 320 × 48 축소 창 한 장(실크기). 배경 아래 48줄을 쓰고 적은 x 56~92 */
function smallMock(lm: LoadedMap, p: MockParts): Raster {
  const full = background(lm, WINDOW.w, WINDOW.h, WINDOW.ground)
  const win = crop(full, 0, SMALL.cropTop, SMALL.w, SMALL.h)
  panel(win, SMALL.sceneW, SMALL.panelX, SMALL.panelEnd)
  const ground = WINDOW.ground - SMALL.cropTop
  blit(win, cellOf(p.character, ...p.frame), WINDOW.charX, ground - groundOf(p.character))
  const [ew] = p.enemy.entry.cell
  blit(win, cellOf(p.enemy, ...p.enemyFrame), SMALL.enemyX + Math.floor((SMALL.enemyW - ew) / 2), ground - groundOf(p.enemy))
  return win
}

function stack(parts: Raster[], gap: number): Raster {
  const w = Math.max(...parts.map((p) => p.width))
  const h = parts.reduce((s, p) => s + p.height, 0) + gap * (parts.length - 1)
  const out = createRaster(w, h)
  fillRect(out, 0, 0, w, h, [40, 36, 48])
  let y = 0
  for (const p of parts) {
    blit(out, p, 0, y)
    y += p.height + gap
  }
  return out
}

/** (d) 칸마다 [기준 | 레이어 합성 | 차이] */
function layersPreview(ref: Sheet, layers: Sheet[]): Raster {
  const [cw, ch] = ref.entry.cell
  const [cols, rows] = ref.entry.grid
  const gap = 6
  const tw = cw * 3 + gap
  const out = checker(cols * tw, rows * (ch + gap))
  for (const [col, row] of filledCells(ref)) {
    const x = col * tw
    const y = row * (ch + gap)
    const r = cellOf(ref, col, row)
    const comp = createRaster(cw, ch)
    for (const l of layers) blit(comp, cellOf(l, col, row), 0, 0)
    blit(out, r, x, y)
    blit(out, comp, x + cw, y)
    const diff = createRaster(cw, ch)
    for (let j = 0; j < ch; j++) {
      for (let i = 0; i < cw; i++) {
        const o = (j * cw + i) * 4
        const inRef = r.rgba[o + 3]! > 0
        const inComp = comp.rgba[o + 3]! > 0
        if (inRef && inComp) fillRect(diff, i, j, 1, 1, [150, 146, 140])
        else if (inComp) fillRect(diff, i, j, 1, 1, [224, 80, 74])
        else if (inRef) fillRect(diff, i, j, 1, 1, [90, 127, 168])
      }
    }
    blit(out, diff, x + cw * 2, y)
  }
  return upscale(out, 4)
}

function loadRaster(lm: LoadedMap, name: string): Raster {
  const png = decodePng(readFileSync(join(lm.outDir, `${name}.png`)))
  return { width: png.width, height: png.height, rgba: png.rgba }
}

/**
 * (d') 파생 항목: 칸마다 [기준 | 재합성(그리기 순서) | 파생 부류만 | 차이].
 * 차이: 회색 = 같음(허용 거리 안), 주황 = 색이 허용 거리를 넘게 다름, 파랑 = 기준에만 있음(빠짐), 빨강 = 재합성에만 있음(넘침)
 */
function derivedPreview(lm: LoadedMap, e: DerivedEntry): Raster {
  const ref = loadSheet(lm, e.ref)
  const outputs = new Map(e.classes.map((c, k) => [c.name, derivedOutputs(e)[k]!]))
  const stack = e.order.map((n) => loadRaster(lm, outputs.get(n) ?? n))
  const classes = e.classes.map((c) => loadRaster(lm, outputs.get(c.name)!))
  const matchDistance = e.match_distance ?? 100
  const [cw, ch] = ref.entry.cell
  const [cols, rows] = ref.entry.grid
  const gap = 6
  const tw = cw * 4 + gap
  const out = checker(cols * tw, rows * (ch + gap))
  for (const [col, row] of filledCells(ref)) {
    const x = col * tw
    const y = row * (ch + gap)
    const r = cellOf(ref, col, row)
    const comp = createRaster(cw, ch)
    for (const l of stack) blit(comp, crop(l, col * cw, row * ch, cw, ch), 0, 0)
    const only = createRaster(cw, ch)
    for (const l of classes) blit(only, crop(l, col * cw, row * ch, cw, ch), 0, 0)
    const diff = createRaster(cw, ch)
    for (let j = 0; j < ch; j++) {
      for (let i = 0; i < cw; i++) {
        const o = (j * cw + i) * 4
        const inRef = r.rgba[o + 3]! > 0
        const inComp = comp.rgba[o + 3]! > 0
        if (inRef && inComp) {
          const d = colorDistance(r.rgba[o]!, r.rgba[o + 1]!, r.rgba[o + 2]!, comp.rgba[o]!, comp.rgba[o + 1]!, comp.rgba[o + 2]!)
          fillRect(diff, i, j, 1, 1, d <= matchDistance ? [150, 146, 140] : [236, 150, 40])
        } else if (inComp) fillRect(diff, i, j, 1, 1, [224, 80, 74])
        else if (inRef) fillRect(diff, i, j, 1, 1, [70, 110, 220])
      }
    }
    blit(out, r, x, y)
    blit(out, comp, x + cw, y)
    blit(out, only, x + cw * 2, y)
    blit(out, diff, x + cw * 3, y)
  }
  return upscale(out, 4)
}

/** (e) 48 시트와 32 시트의 내용 칸을 위·아래 줄로 */
function comparePreview(a: Sheet, b: Sheet): Raster {
  const rowOf = (s: Sheet): Raster => {
    const cells = filledCells(s)
    const [cw, ch] = s.entry.cell
    const r = createRaster(cells.length * cw, ch)
    cells.forEach(([col, row], n) => blit(r, cellOf(s, col, row), n * cw, 0))
    return r
  }
  const top = rowOf(a)
  const bottom = rowOf(b)
  const out = createRaster(Math.max(top.width, bottom.width) + 8, top.height + bottom.height + 12)
  fillRect(out, 0, 0, out.width, out.height, SKY)
  blit(out, top, 4, 4)
  blit(out, bottom, 4, top.height + 8)
  return out
}

export function renderPreviews(lm: LoadedMap): string[] {
  const dir = join(lm.outDir, '_preview')
  mkdirSync(dir, { recursive: true })
  const written: string[] = []
  const p = lm.map.preview

  // (a) 정규화된 모든 시트(파생 부류 시트 포함)
  for (const e of lm.map.entries) {
    for (const name of e.role === 'derived' ? derivedOutputs(e) : [e.name]) {
      if (!existsSync(join(lm.outDir, `${name}.png`))) continue
      const png = decodePng(readFileSync(join(lm.outDir, `${name}.png`)))
      const sheet: Sheet = { name, raster: { width: png.width, height: png.height, rgba: png.rgba }, entry: referenceOf(lm.map, e) }
      written.push(save(dir, `${name}.x4.png`, sheetPreview(sheet)))
    }
  }

  const character = loadSheet(lm, p.character)
  const enemy = loadSheet(lm, p.enemy)
  const props = p.props.map((n) => loadSheet(lm, n))

  // (b)(c) 대기 프레임 전부 + 걷기 프레임이 있으면 그것도
  const frames: [number, number][] = []
  for (const action of ['idle', 'walk']) {
    const row = rowIndex(character, action)
    if (row < 0) continue
    for (let col = 0; col < character.entry.rows[row]!.frames; col++) frames.push([col, row])
  }
  if (frames.length === 0) frames.push(filledCells(character)[0]!)
  const enemyIdle = Math.max(0, rowIndex(enemy, 'idle'))
  const enemyFrames = enemy.entry.rows[enemyIdle]!.frames
  const parts = frames.map((frame, n): MockParts => ({ character, frame, enemy, enemyFrame: [n % enemyFrames, enemyIdle], props }))
  written.push(save(dir, 'window.x4.png', upscale(stack(parts.map((m) => windowMock(lm, m)), 4), 4)))
  written.push(save(dir, 'window-small.x4.png', upscale(stack(parts.map((m) => smallMock(lm, m)), 4), 4)))

  // (d) 레이어 정합
  if (p.layers.length > 0) {
    written.push(save(dir, 'layers.x4.png', layersPreview(character, p.layers.map((n) => loadSheet(lm, n)))))
  }

  // (d') 파생 재합성
  for (const e of lm.map.entries) {
    if (e.role !== 'derived' || !derivedOutputs(e).every((n) => existsSync(join(lm.outDir, `${n}.png`)))) continue
    written.push(save(dir, `derived-${e.name}.x4.png`, derivedPreview(lm, e)))
  }

  // (e) 32·48 비교
  for (const [a, b] of p.compare) {
    const img = comparePreview(loadSheet(lm, a), loadSheet(lm, b))
    written.push(save(dir, `${a}_vs_${b}.x1.png`, img))
    written.push(save(dir, `${a}_vs_${b}.x2.png`, upscale(img, 2)))
  }
  return written
}
