// 지표 목표 범위와 집계(01 §17, 17 §5.2).
//
// 목표 범위는 규칙 수치가 아니라 "검증 목표"라 콘텐츠 팩이 아니라 여기 둔다(소유 문서는 01 §17·17 §5.2).
// 태도별 활동 비중만은 가중치가 콘텐츠에 있으므로 attitude 정의에서 읽는다(04 §7.1 ±10%p).
import type { Content } from '@tap/core'
import type { LifeRow } from './life'

export type Range = readonly [number, number]

// 값이 없는 생애(도달 못 함·해당 없음)를 어떻게 셀지: scope 안이면 범위 밖으로 센다
export type Scope = 'all' | 'retired' | 'first_gen'

export interface Metric {
  key: string
  label: string
  unit: string
  scope: Scope
  value: (row: LifeRow) => number | null
  range: (attitude: string, content: Content) => Range | null
}

// 태도별 목표(01 §17). 태도 id가 표에 없으면 그 지표는 재지 않는다
const BY_ATTITUDE = (table: Record<string, Range>) => (attitude: string): Range | null => table[attitude] ?? null
const FIXED = (lo: number, hi: number) => (): Range => [lo, hi]

// 활동 비중: 태도 정의의 activity_weights ± 10%p(01 §17, 04 §7.1)
const SHARE_TOLERANCE = 10
const shareRange = (kind: 'hunt' | 'adventure' | 'dungeon') => (attitude: string, content: Content): Range | null => {
  if (!content.has('attitude', attitude)) return null
  const w = content.get('attitude', attitude).activity_weights[kind]
  return [w - SHARE_TOLERANCE, w + SHARE_TOLERANCE]
}

export const METRICS: readonly Metric[] = [
  { key: 'combat_rounds', label: '적정 적 1체 전투 라운드', unit: '라운드', scope: 'all', value: (r) => r.combat_rounds, range: FIXED(3, 5) },
  { key: 'combat_hp_loss', label: '적정 전투 1회 체력 손실', unit: '%', scope: 'all', value: (r) => r.combat_hp_loss, range: FIXED(8, 14) },
  { key: 'sortie_minutes', label: '출정 길이', unit: '분', scope: 'all', value: (r) => r.sortie_minutes, range: FIXED(5, 15) },
  { key: 'level10_age', label: '레벨 10 도달 나이', unit: '세', scope: 'all', value: (r) => r.level10_age, range: FIXED(26, 31) },
  { key: 'level20_age', label: '레벨 20 도달 나이', unit: '세', scope: 'all', value: (r) => r.level20_age, range: FIXED(46, 53) },
  {
    key: 'retire_level', label: '68세 은퇴 시 레벨', unit: '레벨', scope: 'retired', value: (r) => r.retire_level,
    range: BY_ATTITUDE({ stable: [25, 27], adventurous: [26, 28], challenging: [27, 29] }),
  },
  { key: 'share_hunt', label: '활동 비중 사냥', unit: '%', scope: 'all', value: (r) => r.share_hunt, range: shareRange('hunt') },
  { key: 'share_adventure', label: '활동 비중 모험', unit: '%', scope: 'all', value: (r) => r.share_adventure, range: shareRange('adventure') },
  { key: 'share_dungeon', label: '활동 비중 던전', unit: '%', scope: 'all', value: (r) => r.share_dungeon, range: shareRange('dungeon') },
  {
    key: 'normal_defeats', label: '생애당 일반 패배', unit: '회', scope: 'all', value: (r) => r.normal_defeats,
    range: BY_ATTITUDE({ stable: [0, 3], adventurous: [2, 6], challenging: [5, 12] }),
  },
  { key: 'fate_offers', label: '생애당 운명 사건 제시', unit: '회', scope: 'all', value: (r) => r.fate_offers, range: FIXED(1, 3) },
  { key: 'expense_ratio', label: '수입 대비 지출', unit: '%', scope: 'all', value: (r) => r.expense_ratio, range: FIXED(60, 75) },
  { key: 'first5_level2', label: '첫 5분 레벨 2', unit: '', scope: 'first_gen', value: (r) => r.first5_level2, range: FIXED(1, 1) },
  { key: 'first5_equip', label: '첫 5분 첫 장비 교체', unit: '', scope: 'first_gen', value: (r) => r.first5_equip, range: FIXED(1, 1) },
  { key: 'first10_check', label: '첫 10분 판정 기록', unit: '', scope: 'first_gen', value: (r) => r.first10_check, range: FIXED(1, 1) },
  { key: 'first10_return', label: '첫 10분 첫 귀환', unit: '', scope: 'first_gen', value: (r) => r.first10_return, range: FIXED(1, 1) },
  { key: 'first10_rest', label: '첫 10분 첫 휴식', unit: '', scope: 'first_gen', value: (r) => r.first10_rest, range: FIXED(1, 1) },
]

// 생애의 80% 이상이 목표 범위 안이어야 한다(17 §5.2)
export const IN_RANGE_MIN = 0.8

export function inScope(metric: Metric, row: LifeRow): boolean {
  if (metric.scope === 'retired') return row.end_kind === 'retired'
  if (metric.scope === 'first_gen') return row.gen === 1
  return true
}

// 선형 보간 분위수. 값이 없으면 null
export function quantile(values: readonly number[], q: number): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const i = (s.length - 1) * q
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return s[lo]! + (s[hi]! - s[lo]!) * (i - lo)
}

export interface MetricStat {
  key: string
  label: string
  unit: string
  target: Range | null
  lives: number // scope에 드는 생애 수
  measured: number // 값이 있는 생애 수
  median: number | null
  p10: number | null
  p90: number | null
  in_range: number
  in_range_ratio: number
  pass: boolean
}

// 한 태도의 생애 묶음을 지표 하나로 집계한다.
// 합격 = 중앙값이 목표 범위 안 + 범위 안 생애 비율 ≥ 80%(17 §5.2). 값이 없는 생애는 범위 밖으로 센다
export function aggregate(metric: Metric, attitude: string, content: Content, rows: readonly LifeRow[]): MetricStat {
  const target = metric.range(attitude, content)
  const scoped = rows.filter((r) => inScope(metric, r))
  const values = scoped.map(metric.value).filter((v): v is number => v !== null)
  const inRange = target === null ? 0 : values.filter((v) => v >= target[0] && v <= target[1]).length
  const ratio = scoped.length ? inRange / scoped.length : 0
  const median = quantile(values, 0.5)
  const ok = target !== null && median !== null && median >= target[0] && median <= target[1] && ratio >= IN_RANGE_MIN
  return {
    key: metric.key,
    label: metric.label,
    unit: metric.unit,
    target,
    lives: scoped.length,
    measured: values.length,
    median: round3(median),
    p10: round3(quantile(values, 0.1)),
    p90: round3(quantile(values, 0.9)),
    in_range: inRange,
    in_range_ratio: round3(ratio) ?? 0,
    pass: ok,
  }
}

function round3(v: number | null): number | null {
  return v === null ? null : Math.round(v * 1000) / 1000
}
