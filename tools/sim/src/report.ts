// 보고 만들기: 생애별 CSV 1행과 요약 표(17 §5.1 출력, §5.3 형식).
import type { Content } from '@tap/core'
import { buildAlerts, type Alert } from './alerts'
import type { LifeRow } from './life'
import { aggregate, IN_RANGE_MIN, METRICS, quantile, type MetricStat, type Range } from './metrics'

// 생애별 CSV 열(17 §5.2 항목 + 관찰 지표). 지도 값(fate_by_event·consumables)은 요약에만 넣는다
export const CSV_COLUMNS = [
  'attitude', 'seed', 'gen', 'end_kind', 'end_age', 'minutes', 'peak_level',
  'combat_rounds', 'combat_hp_loss', 'sortie_minutes', 'level10_age', 'level20_age', 'retire_level',
  'share_hunt', 'share_adventure', 'share_dungeon', 'normal_defeats', 'fate_offers', 'expense_ratio',
  'first5_level2', 'first5_equip', 'first10_check', 'first10_return', 'first10_rest',
  'income', 'spend', 'coins_end', 'death_cause', 'sorties', 'discoveries', 'event_repeat_max',
  'bankruptcies', 'choice_waits', 'level30', 'guild_rank',
  'deep_dungeon_age', 'deep_route_age', 'vampire', 'thirst_end', 'thirst_max', 'thirst_high_ratio',
] as const

export function toCsv(rows: readonly LifeRow[]): string {
  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
  }
  const lines = [CSV_COLUMNS.join(',')]
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => cell((r as unknown as Record<string, unknown>)[c])).join(','))
  return lines.join('\n') + '\n'
}

export interface MetricReport {
  key: string
  label: string
  unit: string
  by_attitude: Record<string, MetricStat>
  pass: boolean
}

export interface ObservedRow {
  label: string
  values: Record<string, string>
}

export interface SimReport {
  rules: string // 규칙 커밋 해시(인자로 받는다)
  content_hash: string
  packs: string
  attitudes: string[]
  seeds: Range
  lives: number
  minutes: number
  life_count: number
  elapsed_sec: number
  metrics: MetricReport[]
  failed: string[]
  alerts: Alert[]
  observed: ObservedRow[]
}

export interface ReportInput {
  rows: readonly LifeRow[]
  content: Content
  contentHash: string
  packs: string
  attitudes: readonly string[]
  seeds: Range
  lives: number
  minutes: number
  rules: string
  lethalAllowed: boolean
  elapsedSec: number
}

const med = (values: readonly (number | null)[]): number | null => quantile(values.filter((v): v is number => v !== null), 0.5)
const num = (v: number | null, unit = ''): string => (v === null ? '-' : `${Math.round(v * 100) / 100}${unit}`)
const pct = (n: number, d: number): string => (d ? `${Math.round((1000 * n) / d) / 10}%` : '-')

function observedRows(byAttitude: ReadonlyMap<string, LifeRow[]>, content: Content): ObservedRow[] {
  const atts = [...byAttitude.keys()]
  const row = (label: string, f: (rows: LifeRow[]) => string): ObservedRow => ({
    label,
    values: Object.fromEntries(atts.map((a) => [a, f(byAttitude.get(a) ?? [])])),
  })
  const all = [...byAttitude.values()].flat()

  const out: ObservedRow[] = [
    row('사망 비율', (rs) => pct(rs.filter((r) => r.end_kind === 'died').length, rs.length)),
    row('사망 원인 분포', (rs) => {
      const by = new Map<string, number>()
      for (const r of rs.filter((x) => x.end_kind === 'died')) {
        const k = r.death_cause ?? '미기록'
        by.set(k, (by.get(k) ?? 0) + 1)
      }
      return by.size ? [...by].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ') : '없음'
    }),
    row('은퇴 시 소지금 중앙값', (rs) => num(med(rs.filter((r) => r.end_kind === 'retired').map((r) => r.coins_end)), '동전')),
    row('분당 수입 중앙값', (rs) => num(med(rs.map((r) => (r.minutes > 0 ? r.income / r.minutes : null))), '동전/분')),
    row('수입 대비 지출 p90', (rs) => num(quantile(rs.map((r) => r.expense_ratio).filter((v): v is number => v !== null), 0.9), '%')),
    row('생활 사건 최대 반복 중앙값', (rs) => num(med(rs.map((r) => r.event_repeat_max)), '회')),
    row('생애당 파산 중앙값', (rs) => num(med(rs.map((r) => r.bankruptcies)), '회')),
    row('생애당 선택 대기 중앙값', (rs) => num(med(rs.map((r) => r.choice_waits)), '회')),
    row('레벨 30 도달 비율', (rs) => pct(rs.filter((r) => r.level30 === 1).length, rs.length)),
    row('최심 던전 첫 진입', (rs) => `${pct(rs.filter((r) => r.deep_dungeon_age !== null).length, rs.length)} · 중앙값 ${num(med(rs.map((r) => r.deep_dungeon_age)), '세')}`),
    row('최심 경로 첫 진입', (rs) => `${pct(rs.filter((r) => r.deep_route_age !== null).length, rs.length)} · 중앙값 ${num(med(rs.map((r) => r.deep_route_age)), '세')}`),
    row('흡혈귀 생애 비율', (rs) => pct(rs.filter((r) => r.vampire === 1).length, rs.length)),
    row('흡혈귀 갈증 최대 중앙값', (rs) => num(med(rs.filter((r) => r.vampire === 1).map((r) => r.thirst_max)))),
    row('흡혈귀 갈증 70 이상 체류 중앙값', (rs) => num(med(rs.filter((r) => r.vampire === 1).map((r) => r.thirst_high_ratio)), '%')),
  ]

  for (const rank of [...content.list('guild_rank')].sort((a, b) => a.order - b.order)) {
    if (rank.order === 0) continue
    out.push(row(`길드 ${rank.name} 이상 도달`, (rs) => {
      const orderOf = (id: string): number => content.has('guild_rank', id) ? content.get('guild_rank', id).order : -1
      return pct(rs.filter((r) => orderOf(r.guild_rank) >= rank.order).length, rs.length)
    }))
  }

  const fateIds = [...new Set(all.flatMap((r) => Object.keys(r.fate_by_event)))].sort()
  for (const id of fateIds) {
    out.push(row(`운명 사건 ${id} 제시율`, (rs) => pct(rs.filter((r) => (r.fate_by_event[id] ?? 0) > 0).length, rs.length)))
  }

  const consumableIds = [...new Set(all.flatMap((r) => Object.keys(r.consumables)))].sort()
  for (const id of consumableIds) {
    out.push(row(`소모품 ${id} 생애당 소비 중앙값`, (rs) => num(med(rs.map((r) => r.consumables[id] ?? 0)))))
  }
  return out
}

export function buildReport(input: ReportInput): SimReport {
  const byAttitude = new Map<string, LifeRow[]>()
  for (const a of input.attitudes) byAttitude.set(a, input.rows.filter((r) => r.attitude === a))

  const metrics: MetricReport[] = METRICS.map((m) => {
    const by: Record<string, MetricStat> = {}
    for (const [a, rows] of byAttitude) by[a] = aggregate(m, a, input.content, rows)
    return { key: m.key, label: m.label, unit: m.unit, by_attitude: by, pass: Object.values(by).every((s) => s.pass) }
  })

  return {
    rules: input.rules,
    content_hash: input.contentHash,
    packs: input.packs,
    attitudes: [...input.attitudes],
    seeds: input.seeds,
    lives: input.lives,
    minutes: input.minutes,
    life_count: input.rows.length,
    elapsed_sec: input.elapsedSec,
    metrics,
    failed: metrics.filter((m) => !m.pass).map((m) => m.label),
    alerts: buildAlerts(byAttitude, input.content, input.lethalAllowed),
    observed: observedRows(byAttitude, input.content),
  }
}

function targetText(stats: readonly MetricStat[]): string {
  const texts = stats.map((s) => (s.target ? `${s.target[0]}~${s.target[1]}` : '-'))
  return [...new Set(texts)].length === 1 ? texts[0] ?? '-' : texts.join(' / ')
}

function cellText(s: MetricStat): string {
  if (s.median === null) return `- (측정 ${s.measured}/${s.lives})`
  return `${num(s.median)} (${num(s.p10)}~${num(s.p90)}) ${Math.round(s.in_range_ratio * 1000) / 10}%`
}

function duration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec - m * 60)
  return `${m}분 ${s}초`
}

export function toMarkdown(r: SimReport): string {
  const head = `시뮬레이션 보고 · 규칙 버전 ${r.rules} · 콘텐츠 ${r.content_hash.slice(0, 12)}(${r.packs})`
    + ` · 시드 ${r.seeds[0]}~${r.seeds[1]} · ${r.life_count}생애 · 생애당 상한 ${r.minutes}분 · 소요 ${duration(r.elapsed_sec)}`
  const cols = r.attitudes
  const lines = [
    '# 시뮬레이션 보고',
    '',
    head,
    '',
    `칸은 \`중앙값 (p10~p90) 범위 내 비율\`. 합격 = 중앙값이 목표 안 + 범위 내 비율 ≥ ${Math.round(IN_RANGE_MIN * 100)}%(17 §5.2).`,
    '',
    `| 지표 | ${cols.join(' | ')} | 목표 | 판정 |`,
    `| --- | ${cols.map(() => '---').join(' | ')} | --- | --- |`,
  ]
  for (const m of r.metrics) {
    const stats = cols.map((a) => m.by_attitude[a]!)
    const bad = cols.filter((a) => !m.by_attitude[a]!.pass)
    const verdict = bad.length === 0 ? '합격' : `불합격(${bad.join(', ')})`
    const unit = m.unit ? ` [${m.unit}]` : ''
    lines.push(`| ${m.label}${unit} | ${stats.map(cellText).join(' | ')} | ${targetText(stats)} | ${verdict} |`)
  }
  lines.push('', `불합격 지표: ${r.failed.length ? r.failed.join(', ') : '없음'}`, '')

  lines.push('## 경보(17 §8)', '', '| 번호 | 위험 | 임계 | 관측 | 발동 |', '| --- | --- | --- | --- | --- |')
  for (const a of r.alerts) {
    lines.push(`| ${a.id} | ${a.risk} | ${a.threshold} | ${a.observed} | ${a.fired === null ? '잴 수 없음' : a.fired ? '발동' : '없음'} |`)
  }
  lines.push('', `발동한 경보: ${r.alerts.filter((a) => a.fired).map((a) => a.id).join(', ') || '없음'}`, '')

  lines.push('## 관찰 지표(합격 기준 없음, 17 §5.2)', '', `| 항목 | ${cols.join(' | ')} |`, `| --- | ${cols.map(() => '---').join(' | ')} |`)
  for (const o of r.observed) lines.push(`| ${o.label} | ${cols.map((a) => o.values[a] ?? '-').join(' | ')} |`)
  lines.push('')
  return lines.join('\n')
}
