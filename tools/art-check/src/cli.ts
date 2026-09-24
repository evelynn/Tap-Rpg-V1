// 에셋 자동 검사기 진입점.
//   tsx tools/art-check/src/cli.ts check   [--manifest <경로>] [--root <경로>] [--priority P0] [--id <id>] [--require-all] [--json]
//   tsx tools/art-check/src/cli.ts inspect <파일·폴더...> [--manifest <경로>] [--json]
//   tsx tools/art-check/src/cli.ts normalize [<대응표>] [--name <이름>] [--json]
//   tsx tools/art-check/src/cli.ts preview   [<대응표>]
//   tsx tools/art-check/src/cli.ts derive    [<대응표>] [--name <파생>] [--min-recompose 0.98] [--json]
//   tsx tools/art-check/src/cli.ts layers    <기준> <레이어...> [--clothing <레이어>] [--min-containment 0.95] [--max-shift 1] [--max-skin 0.03] [--json]
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { checkFile, imageFacts, type FileResult, type FileSource } from './checks'
import { findEntry, loadMap, referenceOf, type DerivedEntry, type LoadedMap, type SourceEntry } from './imagegen-map'
import { DEFAULT_REGISTRATION, measureRegistration, type CellRegistration } from './layers'
import { formatHex, loadManifest, resolveFiles, type Manifest } from './manifest'
import { layerTotals, Normalizer, runDerived, skinColors, writeDerived, writeResult, type EntryResult } from './pipeline'
import { renderPreviews } from './preview'
import { renderFindings, renderSummary, renderTable, summarize } from './report'
import { decodePng, PngError } from './png'
import { templateMain } from './template-cli'

const PKG_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const DEFAULT_MANIFEST = join(PKG_ROOT, 'docs/art/assets.manifest.json')
const DEFAULT_MAP = join(PKG_ROOT, 'docs/art/imagegen.map.json')

export const USAGE = `사용법
  art-check check     [--manifest <경로>] [--root <경로>] [--priority <P0|P1|P2>] [--id <id>] [--require-all] [--allow-empty] [--json]
  art-check inspect   <파일·폴더...> [--manifest <경로>] [--json]
  art-check normalize [<대응표>] [--name <이름>] [--manifest <경로>] [--json]
  art-check preview   [<대응표>] [--manifest <경로>]
  art-check derive    [<대응표>] [--name <파생>] [--min-recompose 0.98] [--manifest <경로>] [--json]
  art-check layers    <기준> <레이어...> [--map <대응표>] [--clothing <레이어>] [--min-containment 0.95] [--max-shift 1] [--max-skin 0.03] [--json]

check     매니페스트가 정한 규격과 실제 PNG를 대조한다. 오류가 하나라도 있으면 종료 코드 1.
          --allow-empty는 아직 안 그린 칸(M6 빈 칸)을 경고로 낮춘다. 한 시트를 카드 여러 장이 나눠 채우는 동안 쓴다.
inspect   매니페스트에 없는 PNG의 사실만 센다(크기·알파·색 수·격자 나눗셈). 읽기 실패만 종료 코드 2.
normalize 생성 원본을 대응표(기본 docs/art/imagegen.map.json)대로 게임 규격 시트로 바꿔 out_dir에 PNG와 보고 JSON을 쓴다.
preview   정규화 결과로 ×4 검수 확대본(시트·520×64 창 모형·320×48 축소 창·레이어 정합·파생 재합성·32/48 비교)을 out_dir/_preview에 쓴다.
derive    대응표의 derived 항목마다 기준 시트 화소에서 옷·무기 같은 부류 레이어를 골라 out_dir/<파생>_<부류>.png와
          <파생>.json을 쓴다. color_source가 reference면 빼는 레이어도 모양은 그대로, 보이는 화소의 색은 기준 시트로 바꿔
          out_dir/<파생>_<레이어>.png로 쓴다. 빼는 레이어와 부류를 그리기 순서대로 쌓은 재합성이 한 칸이라도 기준 시트와
          min_recompose(기본 0.98) 미만으로 같으면 종료 코드 1.
layers    레이어가 기준 시트에 정합하는지 칸마다 잰다. 기준·레이어는 대응표 이름이고, 레이어는 원본 PNG 경로도 된다
          (경로면 기준 시트의 변환으로 정규화한다). 한 칸이라도 기준을 넘으면 종료 코드 1.`

export interface Args {
  command: 'check' | 'inspect' | 'normalize' | 'preview' | 'derive' | 'layers' | 'help'
  manifest: string
  root: string | null
  priority: string | null
  ids: string[]
  requireAll: boolean
  allowEmpty: boolean
  json: boolean
  paths: string[]
  map: string
  names: string[]
  clothing: string[]
  minContainment: number
  maxShift: number
  maxSkin: number
  /** null = 대응표 값 */
  minRecompose: number | null
}

const COMMANDS = ['check', 'inspect', 'normalize', 'preview', 'derive', 'layers'] as const

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    command: 'help',
    manifest: DEFAULT_MANIFEST,
    root: null,
    priority: null,
    ids: [],
    requireAll: false,
    allowEmpty: false,
    json: false,
    paths: [],
    map: DEFAULT_MAP,
    names: [],
    clothing: [],
    minContainment: DEFAULT_REGISTRATION.minContainment,
    maxShift: DEFAULT_REGISTRATION.maxShift,
    maxSkin: DEFAULT_REGISTRATION.maxSkin,
    minRecompose: null,
  }
  let i = 0
  const first = argv[0]
  if ((COMMANDS as readonly string[]).includes(first ?? '')) {
    args.command = first as Args['command']
    i = 1
  } else if (first === undefined || first === '--help' || first === '-h' || first === 'help') {
    return args
  } else {
    throw new Error(`모르는 명령이다: ${first}`)
  }
  const value = (name: string, given: string | undefined): string => {
    if (given === undefined) throw new Error(`${name}에 값이 없다`)
    return given
  }
  const num = (name: string, v: string): number => {
    const n = Number(v)
    if (v.trim() === '' || !Number.isFinite(n)) throw new Error(`${name}는 수여야 한다: ${v}`)
    return n
  }
  for (; i < argv.length; i++) {
    const a = argv[i]!
    const eq = a.indexOf('=')
    const name = a.startsWith('--') && eq > 0 ? a.slice(0, eq) : a
    const inline = a.startsWith('--') && eq > 0 ? a.slice(eq + 1) : undefined
    const next = (): string => (inline !== undefined ? inline : value(name, argv[++i]))
    switch (name) {
      case '--manifest': args.manifest = next(); break
      case '--root': args.root = next(); break
      case '--priority': args.priority = next(); break
      case '--id': args.ids.push(next()); break
      case '--require-all': args.requireAll = true; break
      case '--allow-empty': args.allowEmpty = true; break
      case '--json': args.json = true; break
      case '--map': args.map = next(); break
      case '--name': args.names.push(next()); break
      case '--clothing': args.clothing.push(next()); break
      case '--min-containment': args.minContainment = num(name, next()); break
      case '--max-shift': args.maxShift = num(name, next()); break
      case '--max-skin': args.maxSkin = num(name, next()); break
      case '--min-recompose': args.minRecompose = num(name, next()); break
      case '--help':
      case '-h': args.command = 'help'; break
      default:
        if (a.startsWith('-')) throw new Error(`모르는 옵션이다: ${a}`)
        args.paths.push(a)
    }
  }
  // normalize·preview·derive는 위치 인자 하나를 대응표 경로로 받는다
  if ((args.command === 'normalize' || args.command === 'preview' || args.command === 'derive') && args.paths.length > 0) {
    if (args.paths.length > 1) throw new Error(`${args.command}는 대응표 하나만 받는다`)
    args.map = args.paths[0]!
    args.paths = []
  }
  return args
}

function makeSource(root: string): FileSource {
  return {
    readBinary(rel) {
      try {
        return readFileSync(join(root, rel))
      } catch {
        return null
      }
    },
    readJson(rel) {
      let text: string
      try {
        text = readFileSync(join(root, rel), 'utf8')
      } catch {
        return null
      }
      try {
        return JSON.parse(text) as unknown
      } catch (e) {
        return e instanceof Error ? e : new Error(String(e))
      }
    },
  }
}

function resolveRoot(args: Args, manifest: Manifest, manifestPath: string): string {
  if (args.root !== null) return resolve(args.root)
  return resolve(dirname(manifestPath), manifest.defaults.root)
}

function runCheck(args: Args): number {
  const manifestPath = resolve(args.manifest)
  const manifest = loadManifest(manifestPath)
  const root = resolveRoot(args, manifest, manifestPath)
  const src = makeSource(root)
  let files = resolveFiles(manifest)
  if (args.priority !== null) files = files.filter((f) => f.priority === args.priority)
  if (args.ids.length > 0) files = files.filter((f) => args.ids.includes(f.id))
  if (files.length === 0) throw new Error('고른 조건에 맞는 산출물이 없다')

  const results: FileResult[] = files.map((f) => checkFile(f, src, { allowEmpty: args.allowEmpty }))
  const summary = summarize(results)
  const failed = summary.errors > 0 || (args.requireAll && summary.missing > 0)

  if (args.json) {
    process.stdout.write(JSON.stringify({
      manifest: relative(root, manifestPath).split('\\').join('/'),
      root: root.split('\\').join('/'),
      summary,
      unspecified: manifest.unspecified,
      results,
    }, null, 2) + '\n')
    return failed ? 1 : 0
  }

  process.stdout.write(renderTable(results) + '\n')
  const findings = renderFindings(results)
  if (findings !== '') process.stdout.write('\n지적\n' + findings + '\n')
  if (manifest.unspecified.length > 0) {
    process.stdout.write('\n명세 미정(검사 못 함)\n')
    for (const u of manifest.unspecified) {
      process.stdout.write(`    ${u.files} [${u.card}] — ${u.missing}\n`)
    }
  }
  process.stdout.write('\n' + renderSummary(summary) + '\n')
  if (args.requireAll && summary.missing > 0) {
    process.stdout.write('--require-all: 미제작 파일이 있어 실패로 센다\n')
  }
  return failed ? 1 : 0
}

function listPngs(target: string): string[] {
  const stat = statSync(target)
  if (stat.isFile()) return [target]
  return readdirSync(target)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort()
    .map((f) => join(target, f))
}

function runInspect(args: Args): number {
  if (args.paths.length === 0) throw new Error('검사할 파일이나 폴더를 적어라')
  let palette: Set<number> | null = null
  try {
    const manifest = loadManifest(resolve(args.manifest))
    palette = new Set<number>()
    for (const colors of Object.values(manifest.palettes)) {
      for (const c of colors) palette.add(Number.parseInt(c.slice(1), 16))
    }
  } catch {
    palette = null
  }

  const rows: Record<string, unknown>[] = []
  for (const target of args.paths) {
    const abs = isAbsolute(target) ? target : resolve(target)
    for (const file of listPngs(abs)) {
      const buf = readFileSync(file)
      let facts
      try {
        const img = decodePng(buf)
        facts = imageFacts(img)
        let inPalette = 0
        if (palette !== null) {
          for (let i = 0; i < facts.pixels; i++) {
            if (img.rgba[i * 4 + 3]! === 0) continue
            const k = (img.rgba[i * 4]! << 16) | (img.rgba[i * 4 + 1]! << 8) | img.rgba[i * 4 + 2]!
            if (palette.has(k)) inPalette++
          }
        }
        const grid: Record<string, boolean> = {}
        for (const n of [12, 16, 24, 32, 48, 64]) grid[`${n}`] = facts.width % n === 0 && facts.height % n === 0
        rows.push({
          file: relative(process.cwd(), file).split('\\').join('/'),
          size: `${facts.width}×${facts.height}`,
          color_type: facts.colorType,
          bit_depth: facts.bitDepth,
          opaque: facts.opaque,
          partial_alpha: facts.partialAlpha,
          partial_alpha_pct: Number(((facts.partialAlpha / facts.pixels) * 100).toFixed(2)),
          colors: facts.colors,
          in_palette_pct: palette === null ? null : Number(((inPalette / Math.max(1, facts.opaque)) * 100).toFixed(2)),
          grid_divisible: grid,
        })
      } catch (e) {
        const msg = e instanceof PngError ? e.message : String(e)
        rows.push({ file, error: msg })
      }
    }
  }

  if (args.json) {
    process.stdout.write(JSON.stringify({ files: rows }, null, 2) + '\n')
    return 0
  }
  for (const r of rows) {
    if (r['error'] !== undefined) {
      process.stdout.write(`${String(r['file'])}: 읽기 실패 — ${String(r['error'])}\n`)
      continue
    }
    const grid = r['grid_divisible'] as Record<string, boolean>
    const fits = Object.entries(grid).filter(([, ok]) => ok).map(([n]) => n)
    process.stdout.write(
      `${String(r['file'])}\n` +
      `    크기 ${String(r['size'])} · 색타입 ${String(r['color_type'])} · 비트깊이 ${String(r['bit_depth'])}\n` +
      `    불투명 ${String(r['opaque'])} · 반투명 ${String(r['partial_alpha'])}(${String(r['partial_alpha_pct'])}%) · 고유색 ${String(r['colors'])}\n` +
      `    팔레트 안 화소 ${r['in_palette_pct'] === null ? '-' : `${String(r['in_palette_pct'])}%`} · 정수 격자 ${fits.length === 0 ? '없음' : fits.join('/')}\n`,
    )
  }
  return 0
}

function openMap(args: Args): { lm: LoadedMap; manifest: Manifest } {
  const manifest = loadManifest(resolve(args.manifest))
  const lm = loadMap(resolve(args.map), manifest)
  return { lm, manifest }
}

const rel = (p: string): string => relative(process.cwd(), p).split('\\').join('/')

function runNormalize(args: Args): number {
  const { lm, manifest } = openMap(args)
  const picked = args.names.length > 0 ? args.names.map((n) => findEntry(lm.map, n)) : lm.map.entries
  // 파생 항목은 원본이 없다 — derive가 만든다
  const entries = picked.filter((e): e is SourceEntry => e.role !== 'derived')
  const norm = new Normalizer(lm, manifest)
  const reports = []
  for (const e of entries) {
    const { png, json, report } = writeResult(lm, norm.run(e))
    reports.push(report)
    if (args.json) continue
    const t = report.totals
    const filled = report.cells.filter((c) => c.opaque > 0).length
    process.stdout.write(
      `${report.name} ← ${report.source}\n` +
      `    원본 ${report.source_size.join('×')} · 격자 ${report.grid.join('×')} · 논리 칸 ${report.cell.join('×')}` +
      ` · 칸 비율 ${report.cell_ratio.join('/')} · 축척 ${report.scale}(${report.scale_origin}) · 원본 화소 블록 ${report.art_period ?? '-'}\n` +
      `    채운 칸 ${filled} · 불투명 ${t.opaque} · 칸 밖 버림 ${t.dropped_outside} · 외톨이 제거 ${t.specks_removed}` +
      ` · 색 ${t.colors.length} · 팔레트 오차 평균 ${t.palette_error_mean} 최대 ${t.palette_error_max}\n` +
      report.notes.map((n) => `    ! ${n}\n`).join('') +
      `    → ${rel(png)} · ${rel(json)}\n`,
    )
  }
  if (args.json) process.stdout.write(JSON.stringify({ sheets: reports }, null, 2) + '\n')
  return 0
}

function runPreview(args: Args): number {
  const { lm } = openMap(args)
  for (const file of renderPreviews(lm)) process.stdout.write(`${rel(file)}\n`)
  return 0
}

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`

function runDerive(args: Args): number {
  const { lm, manifest } = openMap(args)
  const all = lm.map.entries.filter((e): e is DerivedEntry => e.role === 'derived')
  const entries = args.names.length > 0 ? args.names.map((n) => {
    const e = findEntry(lm.map, n)
    if (e.role !== 'derived') throw new Error(`${n}은 파생(derived) 항목이 아니다`)
    return e
  }) : all
  if (entries.length === 0) throw new Error('대응표에 derived 항목이 없다')
  const norm = new Normalizer(lm, manifest)
  let failed = false
  const out = []
  const NL = '\n'
  for (const e of entries) {
    const run = runDerived(norm, e, args.minRecompose ?? undefined)
    const { files, json } = writeDerived(lm, run)
    if (!run.pass) failed = true
    out.push({ name: e.name, pass: run.pass, options: run.options, cells: run.cells, recompose: run.recompose, overlap: run.overlap, ...(run.layers.length === 0 ? {} : { layers: layerTotals(run) }) })
    if (args.json) continue
    const bad = run.recompose.filter((c) => !c.pass)
    process.stdout.write(
      `${e.name} ← ${e.ref} − [${e.subtract.join(', ')}] · 순서 ${e.order.join(' → ')}${NL}` +
      `    허용 거리 ${run.options.matchDistance} · 붙이기 ${run.options.reach}걸음 · 재합성 기준 ${pct(run.options.minRecompose)}: ` +
      `${bad.length === 0 ? '통과' : `실패 ${bad.length}칸`}${NL}`,
    )
    run.cells.forEach((c, i) => {
      const r = run.recompose[i]!
      const residual = c.residual_no_class + c.residual_blocked + c.residual_unreached + c.residual_rejected
      const groups = Object.entries(c.residual_groups).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([g, n]) => `${g} ${n}`).join(', ')
      process.stdout.write(
        `    (${c.col},${c.row}) 재합성 ${pct(r.rate).padStart(6)} (같은 색 ${pct(r.exact_rate)}) · 기준 ${c.ref_pixels} · 남음 ${c.leftover}` +
        ` · ${Object.entries(c.assigned).map(([k, n]) => `${k} ${n}`).join(' · ')} · 모호 ${c.ambiguous}` +
        ` · 잔여 ${residual}${groups === '' ? '' : ` (${groups})`} 중 1화소 어긋남 ${c.residual_offset} · 빠짐 ${r.missing} 넘침 ${r.extra} 색 ${r.color_off}` +
        (r.pass ? '' : '  ✗') + NL,
      )
    })
    for (const [name, t] of Object.entries(run.layers.length === 0 ? {} : layerTotals(run))) {
      process.stdout.write(
        `    ${name} (색 = 기준): 보임 ${t.visible} 중 색 바뀜 ${t.recolored} (평균 이동 ${t.mean_shift}) · 이웃으로 넓힘 ${t.grown} · 흡수 ${t.absorbed}` +
        ` · 가려짐 ${t.hidden} (생성기 색) · 삐져나옴 버림 ${t.trimmed} · 실루엣 밖 버림 ${t.dropped}${NL}`,
      )
    }
    for (const o of run.overlap) {
      const both = o.cells.reduce((s, c) => s + c.both, 0)
      const d = o.cells.reduce((s, c) => s + c.derived, 0)
      const t = o.cells.reduce((s, c) => s + c.other, 0)
      process.stdout.write(`    ${o.class} ↔ ${o.compare}: 파생 ${d} · 비교 ${t} · 겹침 ${both} (정밀 ${pct(d === 0 ? 1 : both / d)} · 재현 ${pct(t === 0 ? 1 : both / t)})${NL}`)
      for (const c of o.cells) {
        if (c.derived === 0 && c.other === 0) continue
        process.stdout.write(`      (${c.col},${c.row}) 파생 ${c.derived} · 비교 ${c.other} · 정밀 ${c.precision.toFixed(3)} · 재현 ${c.recall.toFixed(3)}${NL}`)
      }
    }
    process.stdout.write(`    → ${files.map(rel).join(' · ')} · ${rel(json)}${NL}`)
  }
  if (args.json) process.stdout.write(JSON.stringify({ derived: out }, null, 2) + NL)
  return failed ? 1 : 0
}

function runLayers(args: Args): number {
  if (args.paths.length < 2) throw new Error('기준 시트 이름과 레이어를 하나 이상 적어라')
  const { lm, manifest } = openMap(args)
  const [refName, ...layerArgs] = args.paths as [string, ...string[]]
  const refEntry = findEntry(lm.map, refName)
  if (refEntry.role !== 'reference') throw new Error(`${refName}은 기준 시트(reference)가 아니다`)
  const norm = new Normalizer(lm, manifest)
  const ref = norm.run(refEntry)
  const opts = { ...DEFAULT_REGISTRATION, minContainment: args.minContainment, maxShift: args.maxShift, maxSkin: args.maxSkin }
  let failed = false
  const results: { layer: string; clothing: boolean; skin: string[]; cells: CellRegistration[] }[] = []
  for (const name of layerArgs) {
    const mapped = lm.map.entries.find((e): e is SourceEntry => e.name === name && e.role !== 'derived')
    let layer: EntryResult
    if (mapped !== undefined) {
      if (referenceOf(lm.map, mapped).name !== refEntry.name) throw new Error(`${name}의 기준 시트는 ${refName}이 아니다`)
      layer = norm.run(mapped)
    } else {
      layer = norm.runAdHoc(name, refEntry, refEntry.palette)
    }
    const clothing = args.clothing.includes(name) || (mapped?.role === 'layer' && mapped.clothing === true)
    const skin = clothing ? skinColors(manifest, layer.report.totals.colors.map((h) => Number.parseInt(h.slice(1), 16))) : null
    const cells = measureRegistration(ref.raster, layer.raster, refEntry.cell, refEntry.grid, skin, opts)
    if (cells.some((c) => !c.pass)) failed = true
    results.push({ layer: name, clothing, skin: skin === null ? [] : [...skin].map(formatHex), cells })
  }
  if (args.json) {
    process.stdout.write(JSON.stringify({ reference: refName, options: opts, layers: results }, null, 2) + '\n')
    return failed ? 1 : 0
  }
  for (const r of results) {
    const bad = r.cells.filter((c) => !c.pass)
    const skinNote = r.clothing ? ` (옷: 피부 겹침 검사, 피부색 ${r.skin.join(' ')})` : ''
    process.stdout.write(`${r.layer} → ${refName}${skinNote}: ${bad.length === 0 ? '통과' : `실패 ${bad.length}칸`}\n`)
    for (const c of r.cells) {
      if (c.layer_pixels === 0) continue
      process.stdout.write(
        `    (${c.col},${c.row}) 화소 ${String(c.layer_pixels).padStart(4)} · 포함률 ${c.containment.toFixed(3)}` +
        ` · 색 일치 ${c.color_match.toFixed(3)} · 최적 이동 (${c.best_shift.join(',')}) ${c.best_color_match.toFixed(3)}` +
        (c.skin_overlap === null ? '' : ` · 피부 겹침 ${c.skin_overlap.toFixed(3)}`) +
        (c.pass ? '' : `  ✗ ${c.reasons.join(' / ')}`) + '\n',
      )
    }
  }
  return failed ? 1 : 0
}

export function main(argv: string[]): number {
  // 배치 틀·납품 문은 template-cli.ts가 맡는다
  if (argv[0] === 'template' || argv[0] === 'gate') return templateMain(argv)
  let args: Args
  try {
    args = parseArgs(argv)
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n\n${USAGE}\n`)
    return 2
  }
  if (args.command === 'help') {
    process.stdout.write(USAGE + '\n')
    return 0
  }
  try {
    switch (args.command) {
      case 'check': return runCheck(args)
      case 'inspect': return runInspect(args)
      case 'normalize': return runNormalize(args)
      case 'preview': return runPreview(args)
      case 'derive': return runDerive(args)
      case 'layers': return runLayers(args)
    }
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`)
    return 2
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2))
}
