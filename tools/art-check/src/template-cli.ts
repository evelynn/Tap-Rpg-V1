// 배치 틀·납품 문 명령. cli.ts가 첫 인자 template·gate를 여기로 넘긴다.
//   template [<시트>...] [--all] [--specs <경로>] [--out <폴더>] [--json]
//   gate     <png> --spec <시트> [--no-canvas] [--rows idle,attack:6,...] [--specs <경로>] [--json]
//            [--ground-tol 1] [--center-tol 2] [--height-tol 0.08] [--block-tol 0.15]
import { readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runGate, type GateResult } from './gate'
import { decodePng } from './png'
import { renderTemplate, SourceCache, writeTemplate } from './template'
import { loadSpecs, parseRowToken, type GateTolerances, type SheetRow } from './template-spec'

const PKG_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
export const DEFAULT_SPECS = join(PKG_ROOT, 'docs/art/templates/specs.json')

export const TEMPLATE_USAGE = `사용법
  art-check template [<시트>...] [--all] [--specs <경로>] [--out <폴더>] [--json]
  art-check gate     <png> --spec <시트> [--no-canvas] [--rows <동작[:프레임],...>] [--specs <경로>] [--json]
                     [--ground-tol 1] [--center-tol 2] [--height-tol 0.08] [--block-tol 0.15]

template  틀 규격(기본 docs/art/templates/specs.json)의 시트마다 <이름>.grid.png · .placeholder.png · .silhouette.png와
          <이름>.json을 out_dir(기본 docs/art/templates)에 쓴다. 시트 이름을 안 적거나 --all이면 전부.
gate      생성기 납품 PNG를 틀과 대조한다. 불합격이면 칸별 표와 다시 생성용 영어 지적문을 찍고 종료 코드 1.
          --no-canvas: 틀 없이 만든 옛 납품. 이미지를 등간격 격자로 나누고 S를 그림 키에서 추정해, 지면선·중심은 칸끼리 비교한다.
          --rows: 행 구성을 바꾼다(예 idle,attack,sit_eat,sleep · walk:6,walk:6). 동작 규칙은 계열 목록에서 찾는다.`

export interface TemplateArgs {
  command: 'template' | 'gate'
  specs: string
  out: string | null
  names: string[]
  all: boolean
  json: boolean
  spec: string | null
  noCanvas: boolean
  rows: SheetRow[] | null
  tolerances: Partial<GateTolerances>
  paths: string[]
}

export function parseTemplateArgs(argv: string[]): TemplateArgs {
  const command = argv[0]
  if (command !== 'template' && command !== 'gate') throw new Error(`모르는 명령이다: ${command ?? ''}`)
  const a: TemplateArgs = {
    command, specs: DEFAULT_SPECS, out: null, names: [], all: false, json: false,
    spec: null, noCanvas: false, rows: null, tolerances: {}, paths: [],
  }
  const num = (name: string, v: string | undefined): number => {
    const n = Number(v)
    if (v === undefined || v.trim() === '' || !Number.isFinite(n)) throw new Error(`${name}는 수여야 한다: ${v ?? ''}`)
    return n
  }
  for (let i = 1; i < argv.length; i++) {
    const raw = argv[i]!
    const eq = raw.indexOf('=')
    const name = raw.startsWith('--') && eq > 0 ? raw.slice(0, eq) : raw
    const inline = raw.startsWith('--') && eq > 0 ? raw.slice(eq + 1) : undefined
    const next = (): string => {
      const v = inline ?? argv[++i]
      if (v === undefined) throw new Error(`${name}에 값이 없다`)
      return v
    }
    switch (name) {
      case '--specs': a.specs = next(); break
      case '--out': a.out = next(); break
      case '--all': a.all = true; break
      case '--json': a.json = true; break
      case '--spec': a.spec = next(); break
      case '--no-canvas': a.noCanvas = true; break
      case '--rows': a.rows = next().split(',').map((t) => parseRowToken(t.trim())); break
      case '--ground-tol': a.tolerances.ground_tol = num(name, next()); break
      case '--center-tol': a.tolerances.center_tol = num(name, next()); break
      case '--height-tol': a.tolerances.height_tol = num(name, next()); break
      case '--block-tol': a.tolerances.block_tol = num(name, next()); break
      default:
        if (raw.startsWith('-')) throw new Error(`모르는 옵션이다: ${raw}`)
        a.paths.push(raw)
    }
  }
  if (command === 'template') {
    a.names = a.paths
    a.paths = []
  } else {
    if (a.paths.length !== 1) throw new Error('gate는 PNG 하나를 받는다')
    if (a.spec === null) throw new Error('gate에는 --spec <시트>가 필요하다')
  }
  return a
}

const relp = (p: string): string => relative(process.cwd(), p).split('\\').join('/')

function runTemplate(a: TemplateArgs): number {
  const specs = loadSpecs(a.specs)
  const names = a.names.length === 0 || a.all ? specs.file.sheets.map((s) => s.name) : a.names
  const outDir = a.out !== null ? resolve(a.out) : resolve(specs.root, specs.file.out_dir)
  const sources = new SourceCache(specs.root)
  const summary = []
  for (const name of names) {
    const t = renderTemplate(specs, name, sources)
    const files = writeTemplate(t, outDir)
    const j = t.json
    summary.push({ name, canvas: j.canvas, S: j.S, grid: [j.grid.cols, j.grid.rows], cell: j.cell, used: j.used_cells, files: files.map(relp) })
    if (a.json) continue
    process.stdout.write(
      `${name}: 캔버스 ${j.canvas.join('×')} · S ${j.S} · 격자 ${j.grid.cols}×${j.grid.rows} · 칸 ${j.cell.join('×')}(${j.cell_px.join('×')}px)` +
      ` · 원점 (${j.grid.x0},${j.grid.y0}) · 쓰는 칸 ${j.used_cells} · 빈 칸 ${j.empty_cells}` +
      (j.placeholder === null ? ' · 자리표시 없음' : ` · 자리표시 키 ${j.placeholder.height ?? '-'}`) + '\n' +
      `    → ${files.map(relp).join(' · ')}\n`,
    )
  }
  if (a.json) process.stdout.write(JSON.stringify({ templates: summary }, null, 2) + '\n')
  return 0
}

const fmt = (v: number | null, digits = 1): string => (v === null ? '-' : v.toFixed(digits))

export function renderGate(r: GateResult): string {
  const out: string[] = []
  out.push(`${r.pass ? 'PASS' : 'FAIL'} ${r.spec} · ${r.mode} · 이미지 ${r.image.join('×')} (틀 ${r.canvas.join('×')}) · S ${r.S} (${r.S_origin})` +
    ` · 시트 블록 ${fmt(r.block_sheet)} · 배경 ${(r.background_ratio * 100).toFixed(1)}% · 안내색 ${r.guide_pixels} · 격자 밖 ${r.stray_pixels}`)
  out.push('  칸      동작              화소     바닥Δ 중심Δ  키(기준)      블록  반투명  판정')
  for (const c of r.cells) {
    if (!c.used && c.pixels === 0 && c.codes.length === 0) continue
    const cell = `(${c.col},${c.row})`.padEnd(7)
    const label = (c.label ?? '(빈 칸)').padEnd(16)
    const h = c.height === null ? '-' : `${fmt(c.height)}(${c.height_expected ?? '-'})`
    const fill = c.fill === null ? '' : ` 채움 ${(c.fill * 100).toFixed(0)}%${c.ground_fill === null ? '' : `/${(c.ground_fill * 100).toFixed(0)}%`}`
    out.push(`  ${cell} ${label} ${String(c.pixels).padStart(8)} ${fmt(c.ground_delta, 0).padStart(5)} ${fmt(c.center_delta).padStart(5)}  ${h.padEnd(12)} ${fmt(c.block).padStart(5)} ${(c.partial_alpha * 100).toFixed(1).padStart(5)}%  ${c.codes.length === 0 ? 'ok' : '✗ ' + c.codes.join(',')}${fill}`)
  }
  out.push('')
  out.push('Regeneration feedback:')
  out.push(r.feedback)
  return out.join('\n')
}

function runGateCommand(a: TemplateArgs): number {
  const specs = loadSpecs(a.specs)
  const file = resolve(a.paths[0]!)
  const img = decodePng(readFileSync(file))
  const r = runGate(specs, a.spec!, img, {
    noCanvas: a.noCanvas,
    ...(a.rows === null ? {} : { rowsOverride: a.rows }),
    tolerances: a.tolerances,
  })
  if (a.json) process.stdout.write(JSON.stringify({ file: relp(file), ...r }, null, 2) + '\n')
  else process.stdout.write(`${relp(file)}\n${renderGate(r)}\n`)
  return r.pass ? 0 : 1
}

/** 종료 코드: 0 합격·완료 · 1 불합격 · 2 사용법·읽기 실패 */
export function templateMain(argv: string[]): number {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(TEMPLATE_USAGE + '\n')
    return 0
  }
  let a: TemplateArgs
  try {
    a = parseTemplateArgs(argv)
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n\n${TEMPLATE_USAGE}\n`)
    return 2
  }
  try {
    return a.command === 'template' ? runTemplate(a) : runGateCommand(a)
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`)
    return 2
  }
}
