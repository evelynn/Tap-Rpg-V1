// 진단 로그(13 §8.6): logs\diagnostic_{날짜}.log, 7일 보관. 로드 보정(B1~B15)과 시계 이상이 여기 남는다.
import { appendFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { LOG_KEEP_DAYS } from './paths'

const dayOf = (utcMs: number): string => new Date(utcMs).toISOString().slice(0, 10)

export function appendDiagnostics(logDir: string, lines: readonly string[], now: number): void {
  if (lines.length === 0) return
  mkdirSync(logDir, { recursive: true })
  const stamp = new Date(now).toISOString()
  appendFileSync(join(logDir, `diagnostic_${dayOf(now)}.log`), lines.map((l) => `${stamp} ${l}\n`).join(''), 'utf8')
  pruneDiagnostics(logDir, now)
}

export function pruneDiagnostics(logDir: string, now: number): void {
  if (!existsSync(logDir)) return
  const oldest = dayOf(now - LOG_KEEP_DAYS * 24 * 60 * 60 * 1000)
  for (const f of readdirSync(logDir)) {
    const day = /^diagnostic_(\d{4}-\d{2}-\d{2})\.log$/.exec(f)?.[1]
    if (day && day < oldest) rmSync(join(logDir, f), { force: true })
  }
}
