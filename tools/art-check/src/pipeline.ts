// 대응표 + 매니페스트 → 정규화 실행. 기준 시트를 먼저 정규화하고 그 변환을 레이어에 물려준다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { referenceOf, type LoadedMap, type MapEntry, type PaletteRef, type ReferenceEntry } from './imagegen-map'
import type { Manifest } from './manifest'
import { colorDistance, normalizeSheet, Snapper, type KeyOptions, type NormalizeResult, type PaletteEntry, type SheetReport } from './normalize'
import { decodePng } from './png'
import { encodeIndexedPng } from './png-write'
import { hexRgb } from './raster'

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
  entry: MapEntry
  sourcePath: string
}

/** 대응표의 항목들을 메모리에서 정규화한다(쓰지 않는다). 레이어는 기준 시트를 먼저 정규화해 변환을 물려받는다 */
export class Normalizer {
  private readonly done = new Map<string, EntryResult>()
  constructor(readonly lm: LoadedMap, readonly manifest: Manifest) {}

  run(entry: MapEntry): EntryResult {
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
    const entry: MapEntry = { name: path, source: path, role: 'layer', ref: ref.name, palette }
    return this.normalizeFile(entry, resolve(path), ref, refResult)
  }

  private normalizeFile(entry: MapEntry, sourcePath: string, ref: ReferenceEntry, refResult: EntryResult | undefined): EntryResult {
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
