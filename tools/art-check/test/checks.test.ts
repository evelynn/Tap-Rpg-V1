import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkFile, type FileSource } from '../src/checks'
import type { AssetSpec, ResolvedFile } from '../src/manifest'
import { canvas } from './helpers/png-encode'

const PATH = 'assets/test/a.png'
// 시험용 허용 색: 외곽선 · 크림 · 가죽 · 짙은 가죽
const PALETTE = ['#2B2233', '#F0E6CC', '#C08A58', '#8E5E38']
const OUTLINE: [number, number, number, number] = [0x2b, 0x22, 0x33, 255]
const CREAM: [number, number, number, number] = [0xf0, 0xe6, 0xcc, 255]
const LEATHER: [number, number, number, number] = [0xc0, 0x8a, 0x58, 255]

function resolved(over: Partial<AssetSpec> = {}): ResolvedFile {
  const spec: AssetSpec = {
    id: 'test',
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
    ...over,
  }
  return {
    id: spec.id,
    card: spec.card,
    priority: spec.priority,
    path: PATH,
    spec,
    palette: new Set(PALETTE.map((h) => Number.parseInt(h.slice(1), 16))),
    alpha: spec.alpha ?? [0, 255],
    margin: spec.margin ?? 1,
    maxColors: spec.max_colors,
    maxColorsPerCell: spec.max_colors_per_cell === undefined ? spec.max_colors : spec.max_colors_per_cell,
  }
}

function source(png: Uint8Array, json: Record<string, unknown> = {}): FileSource {
  return {
    readBinary: (p) => (p === PATH ? png : null),
    readJson: (p) => (p in json ? json[p]! : null),
  }
}

/** 정상 시트: 두 칸 안쪽에 크림색 덩어리 하나씩 */
function goodSheet(): Uint8Array {
  const c = canvas(96, 48)
  c.fill(4, 4, 10, 10, CREAM)
  c.fill(52, 4, 10, 10, CREAM)
  return c.png()
}

function codes(file: ResolvedFile, src: FileSource): string[] {
  return [...new Set(checkFile(file, src).findings.map((f) => f.code))].sort()
}

describe('에셋 검사', () => {
  it('규격대로면 통과한다', () => {
    const r = checkFile(resolved(), source(goodSheet()))
    assert.equal(r.status, 'pass', JSON.stringify(r.findings))
    assert.equal(r.facts?.colors, 1)
    assert.equal(r.facts?.filledCells, 2)
  })

  it('파일이 없으면 미제작이다', () => {
    const r = checkFile(resolved(), { readBinary: () => null, readJson: () => null })
    assert.equal(r.status, 'missing')
    assert.deepEqual(r.findings, [])
  })

  it('M1 크기와 격자 나눗셈을 본다', () => {
    const c = canvas(100, 48)
    c.fill(4, 4, 10, 10, CREAM)
    const r = checkFile(resolved(), source(c.png()))
    assert.equal(r.status, 'fail')
    const m1 = r.findings.filter((f) => f.code === 'M1')
    assert.equal(m1.length, 2)
    assert.match(m1[0]!.message, /크기 100×48/)
    assert.match(m1[1]!.message, /나누어떨어지지 않는다/)
  })

  it('M2 칸 가장자리 침범을 잡는다', () => {
    const c = canvas(96, 48)
    c.fill(4, 4, 10, 10, CREAM)
    c.fill(47, 20, 2, 2, CREAM) // 0칸 오른쪽 끝 + 1칸 왼쪽 끝
    assert.ok(codes(resolved(), source(c.png())).includes('M2'))
    // 여백 3px 규격에서는 2px 자리도 침범이다
    const near = canvas(96, 48)
    near.fill(2, 20, 4, 4, CREAM)
    near.fill(52, 20, 4, 4, CREAM)
    assert.ok(codes(resolved({ margin: 3 }), source(near.png())).includes('M2'))
    assert.ok(!codes(resolved({ margin: 1 }), source(near.png())).includes('M2'))
  })

  it('M3 알파가 0·255가 아니면 잡고, 허용값을 적으면 통과한다', () => {
    const c = canvas(96, 48)
    c.fill(4, 4, 10, 10, [0x2b, 0x22, 0x33, 89])
    c.fill(52, 4, 10, 10, [0x2b, 0x22, 0x33, 89])
    const bad = checkFile(resolved(), source(c.png()))
    const m3 = bad.findings.find((f) => f.code === 'M3')
    assert.ok(m3 !== undefined)
    assert.match(m3.message, /89/)
    const ok = checkFile(resolved({ alpha: [0, 89], max_colors: 1 }), source(c.png()))
    assert.equal(ok.status, 'pass', JSON.stringify(ok.findings))
  })

  it('M4 색 수 상한을 전체와 칸별로 본다', () => {
    const c = canvas(96, 48)
    c.fill(4, 4, 10, 10, CREAM)
    c.fill(4, 16, 10, 10, LEATHER)
    c.fill(4, 28, 10, 10, OUTLINE)
    c.fill(52, 4, 10, 10, CREAM)
    // 전체 3색 ≤ 4이므로 전체는 통과, 칸별 상한 2를 0칸이 넘는다
    const percell = checkFile(resolved({ max_colors_per_cell: 2 }), source(c.png()))
    const m4 = percell.findings.filter((f) => f.code === 'M4')
    assert.equal(m4.length, 1)
    assert.match(m4[0]!.message, /r0c0\(3\)/)
    // 전체 상한 2로 낮추면 전체도 걸린다
    const total = checkFile(resolved({ max_colors: 2 }), source(c.png()))
    assert.ok(total.findings.some((f) => f.code === 'M4' && /고유 색 3종/.test(f.message)))
  })

  it('M5 팔레트 밖 색을 목록으로 돌려준다', () => {
    const c = canvas(96, 48)
    c.fill(4, 4, 10, 10, [0x12, 0x34, 0x56, 255])
    c.fill(52, 4, 10, 10, CREAM)
    const r = checkFile(resolved(), source(c.png()))
    const m5 = r.findings.find((f) => f.code === 'M5')
    assert.ok(m5 !== undefined)
    assert.match(m5.message, /#123456×100/)
  })

  it('M6 빈 칸과 남는 칸을 가린다', () => {
    const empty = canvas(96, 48)
    empty.fill(4, 4, 10, 10, CREAM)
    const r1 = checkFile(resolved(), source(empty.png()))
    assert.ok(r1.findings.some((f) => f.code === 'M6' && /빈 칸 1개: r0c1/.test(f.message)))
    const r2 = checkFile(resolved({ rows: [{ action: 'x', frames: 1 }], frames: 1 }), source(goodSheet()))
    assert.ok(r2.findings.some((f) => f.code === 'M6' && /내용이 있는 칸 1개: r0c1/.test(f.message)))
  })

  it('--allow-empty는 안 그린 칸만 경고로 낮춘다', () => {
    const half = canvas(96, 48)
    half.fill(4, 4, 10, 10, CREAM)
    const lenient = checkFile(resolved(), source(half.png()), { allowEmpty: true })
    assert.equal(lenient.status, 'pass')
    assert.equal(lenient.findings[0]?.severity, 'warn')
    // 남는 칸 오염은 그대로 오류다
    const dirty = checkFile(resolved({ rows: [{ action: 'x', frames: 1 }], frames: 1 }), source(goodSheet()), { allowEmpty: true })
    assert.equal(dirty.status, 'fail')
  })

  it('M7 동반 JSON의 존재와 형식을 본다', () => {
    const spec = { companions: ['frames' as const] }
    const png = goodSheet()
    assert.ok(codes(resolved(spec), source(png)).includes('M7'))

    const bad = {
      'assets/test/a.frames.json': {
        sheet: 'a.png',
        actions: { x: { row: 0, frames: [0, 1], ms: [100], loop: true } },
      },
    }
    const r = checkFile(resolved(spec), source(png, bad))
    assert.ok(r.findings.some((f) => f.code === 'M7' && /ms 길이 1/.test(f.message)))

    const wrongName = {
      'assets/test/a.frames.json': {
        sheet: 'a.png',
        actions: { walk: { row: 0, frames: [0, 1], ms: [100, 100], loop: true } },
      },
    }
    assert.ok(checkFile(resolved(spec), source(png, wrongName)).findings.some((f) => /동작 x이 없다/.test(f.message)))

    const good = {
      'assets/test/a.frames.json': {
        sheet: 'a.png',
        actions: { x: { row: 0, frames: [0, 1], ms: [100, 120], loop: true } },
      },
    }
    assert.equal(checkFile(resolved(spec), source(png, good)).status, 'pass')
  })

  it('M8 기준점이 칸을 벗어나면 잡는다', () => {
    const spec = { companions: ['anchors' as const] }
    const png = goodSheet()
    const base = {
      sheet: 'a.png',
      cell: [48, 48],
      grid: { cols: 2, rows: 1 },
      ground_y: 44,
      center_x: 23,
    }
    const good = { 'assets/test/a.anchors.json': { ...base, anchors: { x: [{ f: 0, body: [23, 29], head: [23, 6, '기본'] }] } } }
    assert.equal(checkFile(resolved(spec), source(png, good)).status, 'pass')

    const bad = { 'assets/test/a.anchors.json': { ...base, anchors: { x: [{ f: 0, body: [60, 29] }] } } }
    const r = checkFile(resolved(spec), source(png, bad))
    assert.ok(r.findings.some((f) => f.code === 'M8' && /body=\[60,29\]/.test(f.message)))

    const outOfCell = { 'assets/test/a.anchors.json': { ...base, ground_y: 48, anchors: { x: [{ f: 0, body: [23, 29] }] } } }
    assert.ok(checkFile(resolved(spec), source(png, outOfCell)).findings.some((f) => f.code === 'M8' && /ground_y/.test(f.message)))
  })

  it('PNG가 깨졌으면 M0으로 실패한다', () => {
    const r = checkFile(resolved(), source(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8])))
    assert.equal(r.status, 'fail')
    assert.equal(r.findings[0]?.code, 'M0')
  })
})
