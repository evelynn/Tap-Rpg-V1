// 검증 이슈 형식(CONTENT_SCHEMA §7.1). 한 줄: {severity} {code} {pack}/{file}#{json_pointer}: {message}
import type { z } from 'zod'

// P = 팩 단계, S01 = 스키마, V = 참조·의미 규칙
export type IssueCode = 'P01' | 'P03' | 'P04' | 'P05' | 'P06' | 'P07' | 'P08' | 'P09' | 'S01' | `V${number}`
export type Severity = 'error' | 'warn'

export interface ContentIssue {
  severity: Severity
  code: IssueCode
  pack: string
  file: string
  pointer: string
  message: string
}

export interface IssueAt {
  pack: string
  file: string
  pointer?: string
}

export function issue(code: IssueCode, at: IssueAt, message: string, severity: Severity = 'error'): ContentIssue {
  return { severity, code, pack: at.pack, file: at.file, pointer: at.pointer ?? '', message }
}

export function hasError(issues: readonly ContentIssue[]): boolean {
  return issues.some((i) => i.severity === 'error')
}

// JSON Pointer(RFC 6901)
export function toPointer(path: readonly PropertyKey[]): string {
  return path.map((p) => '/' + String(p).replace(/~/g, '~0').replace(/\//g, '~1')).join('')
}

export function formatIssue(i: ContentIssue): string {
  const where = [i.pack, i.file].filter(Boolean).join('/') + (i.pointer ? `#${i.pointer}` : '')
  return `${i.severity.padEnd(5)} ${i.code} ${where}: ${i.message}`
}

// 패치를 받은 정의의 이슈 메시지 꼬리. 어느 패치가 기반 정의를 바꿨는지 보이게 한다
export function patchNote(d: { patches?: readonly IssueAt[] }): string {
  if (!d.patches?.length) return ''
  return ` (패치: ${d.patches.map((p) => `${p.pack}/${p.file}#${p.pointer ?? ''}`).join(', ')})`
}

// zod 이슈 → ContentIssue. 이슈 params.rule(V3 등)이 있으면 그 번호, 없으면 S01
export function zodToIssues(issues: readonly z.core.$ZodIssue[], at: IssueAt): ContentIssue[] {
  return issues.map((iss) => {
    const rule = (iss as { params?: { rule?: string } }).params?.rule
    return issue((rule ?? 'S01') as IssueCode, { ...at, pointer: (at.pointer ?? '') + toPointer(iss.path) }, iss.message)
  })
}
