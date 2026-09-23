// 검사 8항목. 매니페스트가 정한 규격과 실제 PNG 화소를 대조한다.
//   M1 크기·격자 정수 나눗셈      M2 칸 경계 침범·이웃 칸 접촉
//   M3 알파 이진성                M4 색 수 상한(전체·칸별)
//   M5 팔레트 준수                M6 빈 칸
//   M7 동반 JSON 존재·형식        M8 기준점이 칸 안에 있는지
import { formatHex, type ResolvedFile } from './manifest'
import { decodePng, PngError, type PngImage } from './png'

export type Severity = 'error' | 'warn'

export interface Finding {
  code: string
  severity: Severity
  message: string
}

export interface ImageFacts {
  width: number
  height: number
  colorType: number
  bitDepth: number
  paletteSize: number
  pixels: number
  opaque: number
  /** 알파가 0도 255도 아닌 화소 수 */
  partialAlpha: number
  /** 불투명 화소의 고유 RGB 수 */
  colors: number
  /** 내용이 있는 칸 수 */
  filledCells: number
}

export interface FileResult {
  id: string
  card: string
  priority: string
  path: string
  /** 규격 격자 [열, 행] */
  grid: [number, number]
  status: 'pass' | 'fail' | 'missing'
  facts: ImageFacts | null
  findings: Finding[]
}

export interface CheckOptions {
  /** 참이면 '내용이 있어야 하는데 빈 칸'을 경고로 낮춘다. 한 시트를 카드 여러 장이 나눠 채우는 동안 쓴다 */
  allowEmpty?: boolean
}

export interface FileSource {
  /** 없으면 null */
  readBinary(relPath: string): Uint8Array | null
  /** 없으면 null. JSON이 깨졌으면 Error를 돌려준다 */
  readJson(relPath: string): unknown | null | Error
}

interface CellStat {
  col: number
  row: number
  opaque: number
  colors: Set<number>
  /** 가장자리 margin 링 안의 불투명 화소 수 */
  ring: number
}

const MAX_LIST = 8

function brief(items: string[], limit = MAX_LIST): string {
  if (items.length <= limit) return items.join(', ')
  return `${items.slice(0, limit).join(', ')} 외 ${items.length - limit}건`
}

function key(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b
}

/** 이미지 전체 통계. 칸 구조와 무관하게 한 번 훑는다. */
export function imageFacts(img: PngImage): Omit<ImageFacts, 'filledCells'> {
  let opaque = 0
  let partial = 0
  const colors = new Set<number>()
  const n = img.width * img.height
  for (let i = 0; i < n; i++) {
    const a = img.rgba[i * 4 + 3]!
    if (a === 0) continue
    if (a !== 255) partial++
    opaque++
    colors.add(key(img.rgba[i * 4]!, img.rgba[i * 4 + 1]!, img.rgba[i * 4 + 2]!))
  }
  return {
    width: img.width,
    height: img.height,
    colorType: img.colorType,
    bitDepth: img.bitDepth,
    paletteSize: img.paletteSize,
    pixels: n,
    opaque,
    partialAlpha: partial,
    colors: colors.size,
  }
}

function cellStats(img: PngImage, cw: number, ch: number, cols: number, rows: number, margin: number): CellStat[] {
  const out: CellStat[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const stat: CellStat = { col: c, row: r, opaque: 0, colors: new Set(), ring: 0 }
      for (let y = 0; y < ch; y++) {
        const py = r * ch + y
        const edgeY = y < margin || y >= ch - margin
        for (let x = 0; x < cw; x++) {
          const o = (py * img.width + c * cw + x) * 4
          if (img.rgba[o + 3]! === 0) continue
          stat.opaque++
          stat.colors.add(key(img.rgba[o]!, img.rgba[o + 1]!, img.rgba[o + 2]!))
          if (margin > 0 && (edgeY || x < margin || x >= cw - margin)) stat.ring++
        }
      }
      out.push(stat)
    }
  }
  return out
}

function cellName(s: CellStat): string {
  return `r${s.row}c${s.col}`
}

// ── 동반 JSON ────────────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isIntArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((n) => typeof n === 'number' && Number.isInteger(n))
}

function checkFrames(file: ResolvedFile, data: unknown, out: Finding[]): void {
  const path = file.path
  if (!isObject(data)) {
    out.push({ code: 'M7', severity: 'error', message: `${path}: frames.json이 객체가 아니다` })
    return
  }
  const [cols, rows] = file.spec.grid
  if (typeof data['sheet'] !== 'string') {
    out.push({ code: 'M7', severity: 'error', message: `${path}: frames.json에 sheet 문자열이 없다` })
  }
  const actions = data['actions']
  if (!isObject(actions)) {
    out.push({ code: 'M7', severity: 'error', message: `${path}: frames.json에 actions 객체가 없다` })
    return
  }
  let total = 0
  const usedRows = new Set<number>()
  for (const [name, raw] of Object.entries(actions)) {
    const where = `${path}: actions.${name}`
    if (!isObject(raw)) {
      out.push({ code: 'M7', severity: 'error', message: `${where}이 객체가 아니다` })
      continue
    }
    const row = raw['row']
    if (typeof row !== 'number' || !Number.isInteger(row) || row < 0 || row >= rows) {
      out.push({ code: 'M7', severity: 'error', message: `${where}.row가 0~${rows - 1} 정수가 아니다` })
    } else {
      if (usedRows.has(row)) out.push({ code: 'M7', severity: 'error', message: `${where}.row ${row}이 다른 동작과 겹친다` })
      usedRows.add(row)
    }
    const frames = raw['frames']
    if (!isIntArray(frames) || frames.length === 0) {
      out.push({ code: 'M7', severity: 'error', message: `${where}.frames가 정수 배열이 아니다` })
      continue
    }
    const bad = frames.filter((f) => f < 0 || f >= cols)
    if (bad.length > 0) {
      out.push({ code: 'M7', severity: 'error', message: `${where}.frames에 열 범위(0~${cols - 1}) 밖 값이 있다: ${brief(bad.map(String))}` })
    }
    const ms = raw['ms']
    if (!Array.isArray(ms) || ms.some((v) => typeof v !== 'number')) {
      out.push({ code: 'M7', severity: 'error', message: `${where}.ms가 수 배열이 아니다` })
    } else if (ms.length !== frames.length) {
      out.push({ code: 'M7', severity: 'error', message: `${where}.ms 길이 ${ms.length}가 frames 길이 ${frames.length}와 다르다` })
    }
    if (typeof raw['loop'] !== 'boolean') {
      out.push({ code: 'M7', severity: 'error', message: `${where}.loop가 참거짓이 아니다` })
    }
    total += frames.length
  }
  if (total !== file.spec.frames) {
    out.push({ code: 'M7', severity: 'error', message: `${path}: frames.json 프레임 합 ${total}이 매니페스트 ${file.spec.frames}와 다르다` })
  }
  // 동작 이름은 항목이 파일 하나만 가질 때만 대조한다(여러 파일을 묶은 항목은 파일마다 이름이 다르다)
  const specRows = file.spec.rows
  if (specRows !== undefined && file.spec.files.length === 1) {
    const want = specRows.filter((r) => r.frames > 0)
    for (const r of want) {
      const got = actions[r.action]
      if (!isObject(got)) {
        out.push({ code: 'M7', severity: 'error', message: `${path}: frames.json에 동작 ${r.action}이 없다` })
        continue
      }
      const frames = got['frames']
      if (isIntArray(frames) && frames.length !== r.frames) {
        out.push({ code: 'M7', severity: 'error', message: `${path}: 동작 ${r.action}의 프레임 수 ${frames.length}가 규격 ${r.frames}와 다르다` })
      }
    }
    const extra = Object.keys(actions).filter((k) => !want.some((r) => r.action === k))
    if (extra.length > 0) {
      out.push({ code: 'M7', severity: 'error', message: `${path}: frames.json에 규격에 없는 동작이 있다: ${brief(extra)}` })
    }
  }
}

function checkAnchors(file: ResolvedFile, data: unknown, out: Finding[]): void {
  const path = file.path
  if (!isObject(data)) {
    out.push({ code: 'M7', severity: 'error', message: `${path}: anchors.json이 객체가 아니다` })
    return
  }
  const [cw, ch] = file.spec.cell
  const [cols, rows] = file.spec.grid
  const cell = data['cell']
  if (!isIntArray(cell) || cell.length !== 2 || cell[0] !== cw || cell[1] !== ch) {
    out.push({ code: 'M7', severity: 'error', message: `${path}: anchors.json의 cell이 ${cw}×${ch}가 아니다` })
  }
  const grid = data['grid']
  if (!isObject(grid) || grid['cols'] !== cols || grid['rows'] !== rows) {
    out.push({ code: 'M7', severity: 'error', message: `${path}: anchors.json의 grid가 ${cols}×${rows}가 아니다` })
  }
  const groundY = data['ground_y']
  const centerX = data['center_x']
  if (typeof groundY !== 'number' || groundY < 0 || groundY >= ch) {
    out.push({ code: 'M8', severity: 'error', message: `${path}: ground_y가 칸 높이 0~${ch - 1} 밖이다` })
  }
  if (typeof centerX !== 'number' || centerX < 0 || centerX >= cw) {
    out.push({ code: 'M8', severity: 'error', message: `${path}: center_x가 칸 너비 0~${cw - 1} 밖이다` })
  }
  const anchors = data['anchors']
  if (!isObject(anchors)) {
    out.push({ code: 'M7', severity: 'error', message: `${path}: anchors.json에 anchors 객체가 없다` })
    return
  }
  const outside: string[] = []
  let count = 0
  for (const [action, list] of Object.entries(anchors)) {
    if (!Array.isArray(list)) {
      out.push({ code: 'M7', severity: 'error', message: `${path}: anchors.${action}이 배열이 아니다` })
      continue
    }
    for (const entry of list) {
      if (!isObject(entry)) {
        out.push({ code: 'M7', severity: 'error', message: `${path}: anchors.${action}의 항목이 객체가 아니다` })
        continue
      }
      const f = entry['f']
      if (typeof f !== 'number' || !Number.isInteger(f) || f < 0 || f >= cols) {
        out.push({ code: 'M7', severity: 'error', message: `${path}: anchors.${action}의 f가 0~${cols - 1} 정수가 아니다` })
      }
      for (const [point, value] of Object.entries(entry)) {
        if (point === 'f') continue
        if (!Array.isArray(value) || typeof value[0] !== 'number' || typeof value[1] !== 'number') {
          out.push({ code: 'M7', severity: 'error', message: `${path}: anchors.${action}.${point}이 [x, y] 꼴이 아니다` })
          continue
        }
        count++
        const x = value[0]
        const y = value[1]
        if (x < 0 || x >= cw || y < 0 || y >= ch) outside.push(`${action} f${String(f)} ${point}=[${x},${y}]`)
      }
    }
  }
  if (count === 0) {
    out.push({ code: 'M7', severity: 'error', message: `${path}: anchors.json에 기준점이 하나도 없다` })
  }
  if (outside.length > 0) {
    out.push({ code: 'M8', severity: 'error', message: `${path}: 기준점 ${outside.length}개가 칸(${cw}×${ch}) 밖이다: ${brief(outside)}` })
  }
}

function check9slice(file: ResolvedFile, data: unknown, out: Finding[]): void {
  const path = file.path
  if (!isObject(data)) {
    out.push({ code: 'M7', severity: 'error', message: `${path}: 9slice.json이 객체가 아니다` })
    return
  }
  const [w, h] = file.spec.size
  for (const k of ['left', 'right', 'top', 'bottom']) {
    const v = data[k]
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
      out.push({ code: 'M7', severity: 'error', message: `${path}: 9slice.json의 ${k}가 0 이상 정수가 아니다` })
    }
  }
  const l = data['left']
  const r = data['right']
  const t = data['top']
  const b = data['bottom']
  if (typeof l === 'number' && typeof r === 'number' && l + r >= w) {
    out.push({ code: 'M7', severity: 'error', message: `${path}: 9slice left+right ${l + r}가 너비 ${w} 이상이다` })
  }
  if (typeof t === 'number' && typeof b === 'number' && t + b >= h) {
    out.push({ code: 'M7', severity: 'error', message: `${path}: 9slice top+bottom ${t + b}가 높이 ${h} 이상이다` })
  }
}

function companionPath(pngPath: string, kind: string): string {
  return pngPath.replace(/\.png$/, `.${kind}.json`)
}

// ── 파일 하나 검사 ───────────────────────────────────────────────────────────

export function checkFile(file: ResolvedFile, src: FileSource, opts: CheckOptions = {}): FileResult {
  const findings: Finding[] = []
  const base: Omit<FileResult, 'status' | 'facts' | 'findings'> = {
    id: file.id,
    card: file.card,
    priority: file.priority,
    path: file.path,
    grid: file.spec.grid,
  }
  const bin = src.readBinary(file.path)
  if (bin === null) return { ...base, status: 'missing', facts: null, findings }

  let img: PngImage
  try {
    img = decodePng(bin)
  } catch (e) {
    const msg = e instanceof PngError ? e.message : String(e)
    findings.push({ code: 'M0', severity: 'error', message: `${file.path}: PNG를 읽지 못했다 — ${msg}` })
    return { ...base, status: 'fail', facts: null, findings }
  }

  const facts = imageFacts(img)
  const [cw, ch] = file.spec.cell
  const [cols, rows] = file.spec.grid
  const [sw, sh] = file.spec.size

  // M1 크기와 격자
  let gridOk = true
  if (img.width !== sw || img.height !== sh) {
    gridOk = false
    findings.push({
      code: 'M1',
      severity: 'error',
      message: `${file.path}: 크기 ${img.width}×${img.height}가 규격 ${sw}×${sh}와 다르다`,
    })
  }
  if (img.width % cw !== 0 || img.height % ch !== 0) {
    gridOk = false
    findings.push({
      code: 'M1',
      severity: 'error',
      message: `${file.path}: 칸 ${cw}×${ch}로 나누어떨어지지 않는다(${img.width}/${cw}=${(img.width / cw).toFixed(3)}, ${img.height}/${ch}=${(img.height / ch).toFixed(3)})`,
    })
  }

  // M3 알파 이진성
  const allowed = new Set(file.alpha)
  let badAlpha = 0
  const badValues = new Set<number>()
  for (let i = 0; i < facts.pixels; i++) {
    const a = img.rgba[i * 4 + 3]!
    if (!allowed.has(a)) {
      badAlpha++
      if (badValues.size < MAX_LIST) badValues.add(a)
    }
  }
  if (badAlpha > 0) {
    const ratio = ((badAlpha / facts.pixels) * 100).toFixed(2)
    findings.push({
      code: 'M3',
      severity: 'error',
      message: `${file.path}: 허용 알파 {${file.alpha.join(', ')}} 밖 화소 ${badAlpha}개(${ratio}%). 관측값 ${brief([...badValues].sort((a, b) => a - b).map(String))}`,
    })
  }

  // M5 팔레트 준수
  const violations = new Map<number, number>()
  for (let i = 0; i < facts.pixels; i++) {
    if (img.rgba[i * 4 + 3]! === 0) continue
    const k = key(img.rgba[i * 4]!, img.rgba[i * 4 + 1]!, img.rgba[i * 4 + 2]!)
    if (file.palette.has(k)) continue
    violations.set(k, (violations.get(k) ?? 0) + 1)
  }
  if (violations.size > 0) {
    const top = [...violations.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${formatHex(k)}×${n}`)
    findings.push({
      code: 'M5',
      severity: 'error',
      message: `${file.path}: 팔레트(${file.spec.palette}) 밖 색 ${violations.size}종: ${brief(top)}`,
    })
  }

  // M4 색 수 상한 — 전체
  if (file.maxColors !== null && facts.colors > file.maxColors) {
    findings.push({
      code: 'M4',
      severity: 'error',
      message: `${file.path}: 고유 색 ${facts.colors}종이 상한 ${file.maxColors}종을 넘는다`,
    })
  }

  let filledCells = 0
  if (gridOk) {
    const stats = cellStats(img, cw, ch, cols, rows, file.margin)
    filledCells = stats.filter((s) => s.opaque > 0).length

    // M2 칸 경계
    const spill = stats.filter((s) => s.ring > 0)
    if (spill.length > 0) {
      findings.push({
        code: 'M2',
        severity: 'error',
        message: `${file.path}: 가장자리 ${file.margin}px 안에 내용이 있는 칸 ${spill.length}개: ${brief(spill.map((s) => `${cellName(s)}(${s.ring}px)`))}`,
      })
    }

    // M4 색 수 상한 — 칸별
    if (file.maxColorsPerCell !== null) {
      const over = stats.filter((s) => s.colors.size > file.maxColorsPerCell!)
      if (over.length > 0) {
        findings.push({
          code: 'M4',
          severity: 'error',
          message: `${file.path}: 칸별 색 수가 상한 ${file.maxColorsPerCell}종을 넘는 칸 ${over.length}개: ${brief(over.map((s) => `${cellName(s)}(${s.colors.size})`))}`,
        })
      }
    }

    // M6 빈 칸 / 남는 칸
    const expected = (row: number, col: number): boolean => {
      const spec = file.spec.rows
      if (spec === undefined) return true
      return col < (spec[row]?.frames ?? 0)
    }
    const empty = stats.filter((s) => expected(s.row, s.col) && s.opaque === 0)
    const dirty = stats.filter((s) => !expected(s.row, s.col) && s.opaque > 0)
    if (empty.length > 0) {
      findings.push({
        code: 'M6',
        severity: opts.allowEmpty === true ? 'warn' : 'error',
        message: `${file.path}: 내용이 있어야 하는데 빈 칸 ${empty.length}개: ${brief(empty.map(cellName))}`,
      })
    }
    if (dirty.length > 0) {
      findings.push({
        code: 'M6',
        severity: 'error',
        message: `${file.path}: 비어 있어야 하는데 내용이 있는 칸 ${dirty.length}개: ${brief(dirty.map(cellName))}`,
      })
    }
  }

  // M7·M8 동반 JSON
  for (const kind of file.spec.companions) {
    const p = companionPath(file.path, kind)
    const data = src.readJson(p)
    if (data === null) {
      findings.push({ code: 'M7', severity: 'error', message: `${p}: 동반 파일이 없다` })
      continue
    }
    if (data instanceof Error) {
      findings.push({ code: 'M7', severity: 'error', message: `${p}: JSON을 읽지 못했다 — ${data.message}` })
      continue
    }
    if (kind === 'frames') checkFrames(file, data, findings)
    else if (kind === 'anchors') checkAnchors(file, data, findings)
    else check9slice(file, data, findings)
  }

  const status = findings.some((f) => f.severity === 'error') ? 'fail' : 'pass'
  return { ...base, status, facts: { ...facts, filledCells }, findings }
}
