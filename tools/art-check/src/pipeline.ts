// 대응표 + 매니페스트 → 정규화 실행. 기준 시트를 먼저 정규화하고 그 변환을 레이어에 물려준다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { findEntry, referenceOf, type DerivedEntry, type LoadedMap, type PaletteRef, type ReferenceEntry, type SourceEntry } from './imagegen-map'
import type { Manifest } from './manifest'
import {
  compareOverlap,
  compareRecompose,
  DEFAULT_DERIVE,
  deriveLayers,
  stackLayers,
  type DeriveCellReport,
  type DeriveOptions,
  type OverlapCell,
  type RecomposeCell,
  type StackSlot,
} from './derive'
import { colorDistance, normalizeSheet, Snapper, type KeyOptions, type NormalizeResult, type PaletteEntry, type SheetReport } from './normalize'
import { decodePng } from './png'
import { encodeIndexedPng } from './png-write'
import { hexRgb, type Raster } from './raster'

export function paletteFor(manifest: Manifest, ref: PaletteRef): PaletteEntry[] {
  const out: PaletteEntry[] = []
  const seen = new Set<string>()
  const groups = typeof ref === 'string' ? manifest.palette_sets[ref] ?? [] : ref
  for (const group of groups) {
    for (const hex of manifest.palettes[group] ?? []) {
      if (seen.has(hex)) continue
      seen.add(hex)
      const [r, g, b] = hexRgb(hex)
      out.push({ hex, r, g, b, group })
    }
  }
  return out
}

/**
 * 피부 겹침 검사에 쓸 피부색(0xRRGGBB) 집합. 매니페스트 skin 묶음에서, 옷 레이어가 쓰는 피부 아닌 색과
 * 가중 거리 minDistance 미만인 색은 뺀다 — 원본의 크림색 옷은 #F0E6CC와 #F6D9C2 사이에 있어
 * 기준 시트에서 옷이 두 색으로 갈라지므로, 그런 색을 피부로 세면 옷 위의 옷도 피부 겹침이 된다.
 */
export function skinColors(manifest: Manifest, clothingColors: number[], minDistance = 40): Set<number> {
  const skin = (manifest.palettes['skin'] ?? []).map((h) => Number.parseInt(h.slice(1), 16))
  const skinSet = new Set(skin)
  const others = clothingColors.filter((c) => !skinSet.has(c))
  const ch = (c: number): [number, number, number] => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff]
  return new Set(skin.filter((s) => others.every((o) => colorDistance(...ch(s), ...ch(o)) >= minDistance)))
}

export function keyOptions(lm: LoadedMap): KeyOptions {
  return { key: hexRgb(lm.map.key), tolerance: lm.map.key_tolerance, alphaThreshold: lm.map.alpha_threshold, despill: lm.map.key_despill }
}

export interface EntryResult extends NormalizeResult {
  entry: SourceEntry
  sourcePath: string
}

/** 대응표의 항목들을 메모리에서 정규화한다(쓰지 않는다). 레이어는 기준 시트를 먼저 정규화해 변환을 물려받는다 */
export class Normalizer {
  private readonly done = new Map<string, EntryResult>()
  constructor(readonly lm: LoadedMap, readonly manifest: Manifest) {}

  run(entry: SourceEntry): EntryResult {
    const hit = this.done.get(entry.name)
    if (hit !== undefined) return hit
    const ref = referenceOf(this.lm.map, entry)
    const refResult = entry.role === 'layer' ? this.run(ref) : undefined
    const result = this.normalizeFile(entry, resolve(this.lm.sourceDir, entry.source), ref, refResult)
    this.done.set(entry.name, result)
    return result
  }

  /** 대응표에 없는 원본을 기준 시트의 변환으로 정규화한다(레이어 정합 검사용) */
  runAdHoc(path: string, ref: ReferenceEntry, palette: PaletteRef): EntryResult {
    const refResult = this.run(ref)
    const entry: SourceEntry = { name: path, source: path, role: 'layer', ref: ref.name, palette }
    return this.normalizeFile(entry, resolve(path), ref, refResult)
  }

  private normalizeFile(entry: SourceEntry, sourcePath: string, ref: ReferenceEntry, refResult: EntryResult | undefined): EntryResult {
    const img = decodePng(readFileSync(sourcePath))
    const snapper = new Snapper(paletteFor(this.manifest, entry.palette))
    const spec = { grid: ref.grid, cell: ref.cell, rows: ref.rows, align: ref.align, scale: ref.scale }
    const r = normalizeSheet(img, spec, snapper, keyOptions(this.lm), refResult?.transform)
    return { ...r, entry, sourcePath }
  }
}

export interface WrittenReport extends SheetReport {
  name: string
  source: string
  role: 'reference' | 'layer'
  ref: string | null
  palette: PaletteRef
  rows: ReferenceEntry['rows']
}

/** 정규화 결과를 out_dir/<이름>.png(인덱스 색)와 <이름>.json(보고)으로 쓴다 */
export function writeResult(lm: LoadedMap, r: EntryResult): { png: string; json: string; report: WrittenReport } {
  mkdirSync(lm.outDir, { recursive: true })
  const png = join(lm.outDir, `${r.entry.name}.png`)
  const json = join(lm.outDir, `${r.entry.name}.json`)
  writeFileSync(png, encodeIndexedPng(r.raster.width, r.raster.height, r.raster.rgba))
  const ref = referenceOf(lm.map, r.entry)
  const report: WrittenReport = {
    name: r.entry.name,
    source: `${lm.map.source_dir}/${r.entry.source}`,
    role: r.entry.role,
    ref: r.entry.role === 'layer' ? r.entry.ref : null,
    palette: r.entry.palette,
    rows: ref.rows,
    ...r.report,
  }
  writeFileSync(json, JSON.stringify(report, null, 2) + '\n')
  return { png, json, report }
}

/** 기준 시트의 내용 칸 여부(행 우선) */
export function filledCells(ref: ReferenceEntry): boolean[] {
  const out: boolean[] = []
  for (const r of ref.rows) for (let col = 0; col < ref.grid[0]; col++) out.push(col < r.frames)
  return out
}

export interface DerivedRun {
  entry: DerivedEntry
  ref: EntryResult
  /** 부류 순서 */
  classes: { name: string; output: string; raster: Raster }[]
  /** 그리기 순서대로 쌓은 재합성 */
  recomposed: Raster
  options: DeriveOptions & { minRecompose: number }
  cells: DeriveCellReport[]
  recompose: RecomposeCell[]
  overlap: { class: string; compare: string; cells: OverlapCell[] }[]
  pass: boolean
}

/** 파생 항목 하나를 계산한다(쓰지 않는다). minRecompose를 주면 대응표 값보다 앞선다 */
export function runDerived(norm: Normalizer, e: DerivedEntry, minRecompose?: number): DerivedRun {
  const map = norm.lm.map
  const refEntry = findEntry(map, e.ref) as ReferenceEntry
  const ref = norm.run(refEntry)
  const layer = (n: string): EntryResult => norm.run(findEntry(map, n) as SourceEntry)
  const groupOf = new Map<number, string>()
  for (const p of paletteFor(norm.manifest, refEntry.palette)) groupOf.set((p.r << 16) | (p.g << 8) | p.b, p.group)
  const options = {
    matchDistance: e.match_distance ?? DEFAULT_DERIVE.matchDistance,
    reach: e.reach ?? DEFAULT_DERIVE.reach,
    minCore: e.min_core ?? DEFAULT_DERIVE.minCore,
    minRecompose: minRecompose ?? e.min_recompose ?? 0.98,
  }
  const clsIndex = new Map(e.classes.map((c, k) => [c.name, k]))
  const order: StackSlot[] = e.order.map((n) => {
    const k = clsIndex.get(n)
    return k !== undefined ? { cls: k } : { layer: n, raster: layer(n).raster }
  })
  const filled = filledCells(refEntry)
  const result = deriveLayers(
    {
      ref: ref.raster,
      cell: refEntry.cell,
      grid: refEntry.grid,
      filled,
      order,
      classes: e.classes.map((c) => ({ name: c.name, core: c.core, extra: c.extra ?? [], place: c.place, loose: c.loose ?? [] })),
      groupOf: (rgb) => groupOf.get(rgb),
    },
    options,
  )
  const stack = order.map((s) => ('raster' in s ? s.raster : result.layers[s.cls]!))
  const recomposed = stackLayers(ref.raster.width, ref.raster.height, stack)
  const recompose = compareRecompose(ref.raster, recomposed, refEntry.cell, refEntry.grid, filled, options.matchDistance, options.minRecompose)
  const overlap = e.classes.flatMap((c, k) =>
    c.compare === undefined ? [] : [{ class: c.name, compare: c.compare, cells: compareOverlap(result.layers[k]!, layer(c.compare).raster, refEntry.cell, refEntry.grid, filled) }],
  )
  return {
    entry: e,
    ref,
    classes: e.classes.map((c, k) => ({ name: c.name, output: `${e.name}_${c.name}`, raster: result.layers[k]! })),
    recomposed,
    options,
    cells: result.cells,
    recompose,
    overlap,
    pass: recompose.every((c) => c.pass),
  }
}

/** 부류별 out_dir/<파생>_<부류>.png(인덱스 색)와 out_dir/<파생>.json(보고) */
export function writeDerived(lm: LoadedMap, run: DerivedRun): { files: string[]; json: string } {
  mkdirSync(lm.outDir, { recursive: true })
  const files: string[] = []
  for (const c of run.classes) {
    const png = join(lm.outDir, `${c.output}.png`)
    writeFileSync(png, encodeIndexedPng(c.raster.width, c.raster.height, c.raster.rgba))
    files.push(png)
  }
  const json = join(lm.outDir, `${run.entry.name}.json`)
  const e = run.entry
  const recomposeByCell = new Map(run.recompose.map((r) => [`${r.col},${r.row}`, r]))
  const report = {
    name: e.name,
    role: 'derived',
    ref: e.ref,
    subtract: e.subtract,
    order: e.order,
    classes: e.classes,
    outputs: run.classes.map((c) => c.output),
    options: run.options,
    pass: run.pass,
    totals: {
      ref_pixels: run.cells.reduce((s, c) => s + c.ref_pixels, 0),
      leftover: run.cells.reduce((s, c) => s + c.leftover, 0),
      assigned: Object.fromEntries(e.classes.map((c) => [c.name, run.cells.reduce((s, x) => s + (x.assigned[c.name] ?? 0), 0)])),
      ambiguous: run.cells.reduce((s, c) => s + c.ambiguous, 0),
      residual: run.cells.reduce((s, c) => s + c.residual_no_class + c.residual_blocked + c.residual_unreached + c.residual_rejected, 0),
      recompose_min: Math.min(...run.recompose.map((r) => r.rate)),
      recompose_mean: Math.round((run.recompose.reduce((s, r) => s + r.rate, 0) / Math.max(1, run.recompose.length)) * 10000) / 10000,
    },
    cells: run.cells.map((c) => ({ ...c, recompose: recomposeByCell.get(`${c.col},${c.row}`) ?? null })),
    overlap: run.overlap,
  }
  writeFileSync(json, JSON.stringify(report, null, 2) + '\n')
  return { files, json }
}
