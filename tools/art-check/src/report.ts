// 사람이 읽는 표와 --json 출력.
import type { FileResult } from './checks'

export interface Summary {
  total: number
  pass: number
  fail: number
  missing: number
  errors: number
  warns: number
}

export function summarize(results: FileResult[]): Summary {
  let pass = 0
  let fail = 0
  let missing = 0
  let errors = 0
  let warns = 0
  for (const r of results) {
    if (r.status === 'pass') pass++
    else if (r.status === 'fail') fail++
    else missing++
    for (const f of r.findings) {
      if (f.severity === 'error') errors++
      else warns++
    }
  }
  return { total: results.length, pass, fail, missing, errors, warns }
}

// 터미널 폭 계산: 한글·기호는 두 칸으로 센다
function width(s: string): number {
  let w = 0
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    w += (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6) ? 2 : 1
  }
  return w
}

function pad(s: string, n: number, right = false): string {
  const fill = ' '.repeat(Math.max(0, n - width(s)))
  return right ? fill + s : s + fill
}

const LABEL: Record<FileResult['status'], string> = { pass: '통과', fail: '실패', missing: '미제작' }

export function renderTable(results: FileResult[]): string {
  const head = ['상태', '파일', '크기', '격자', '색', '지적']
  const rows = results.map((r) => {
    const size = r.facts === null ? '-' : `${r.facts.width}×${r.facts.height}`
    const grid = `${r.grid[0]}×${r.grid[1]}`
    const colors = r.facts === null ? '-' : String(r.facts.colors)
    const errs = r.findings.filter((f) => f.severity === 'error').length
    return [LABEL[r.status], `${r.path} [${r.card}]`, size, grid, colors, errs === 0 ? '-' : String(errs)]
  })
  const widths = head.map((h, i) => Math.max(width(h), ...rows.map((row) => width(row[i]!))))
  const line = (cells: string[]): string => cells.map((c, i) => pad(c, widths[i]!, i >= 2)).join('  ').trimEnd()
  return [line(head), widths.map((w) => '─'.repeat(w)).join('  '), ...rows.map(line)].join('\n')
}

export function renderFindings(results: FileResult[]): string {
  const out: string[] = []
  for (const r of results) {
    if (r.findings.length === 0) continue
    out.push(`· ${r.path} [${r.card}]`)
    for (const f of r.findings) out.push(`    ${f.code} ${f.severity === 'error' ? '오류' : '경고'} — ${f.message}`)
  }
  return out.join('\n')
}

export function renderSummary(s: Summary): string {
  return `합계 ${s.total}파일 · 통과 ${s.pass} · 실패 ${s.fail} · 미제작 ${s.missing} · 오류 ${s.errors} · 경고 ${s.warns}`
}
