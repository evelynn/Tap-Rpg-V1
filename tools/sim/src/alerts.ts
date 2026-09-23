// 17 §8 기획 위험 조기 경보 중 시뮬레이터로 잴 수 있는 것.
//
// R5·R6·R7은 플레이 관찰·에셋 제작량이라 여기서 재지 않는다. R2는 "치명 꺼짐 사망 수"만 본다.
import type { Content } from '@tap/core'
import type { LifeRow } from './life'
import { quantile } from './metrics'

// 17 §8이 이름으로 부르는 콘텐츠 ID. 코어가 아니라 도구라 ID를 그대로 쓴다.
// 없는 팩에서는 그 경보를 "해당 없음"으로 둔다
const R9_FATE_EVENT = 'F03'
const R11_GOLD_RANK = 'gold'
const ADVENTUROUS = 'adventurous'
const STABLE = 'stable'

export interface Alert {
  id: string
  risk: string
  threshold: string
  observed: string
  fired: boolean | null // null = 잴 수 없음
}

const pct = (n: number, d: number): string => (d ? `${Math.round((1000 * n) / d) / 10}%` : '해당 없음')
const med = (values: readonly (number | null)[]): number | null => quantile(values.filter((v): v is number => v !== null), 0.5)
const fmt = (v: number | null, unit = ''): string => (v === null ? '없음' : `${Math.round(v * 100) / 100}${unit}`)

// 태도 비교용 4지표(R1)
function attitudeScores(rows: readonly LifeRow[]): { income: number; discoveries: number; retireLevel: number; survival: number } {
  const retired = rows.filter((r) => r.end_kind === 'retired')
  return {
    income: med(rows.map((r) => (r.minutes > 0 ? r.income / r.minutes : null))) ?? 0,
    discoveries: med(rows.map((r) => r.discoveries)) ?? 0,
    retireLevel: med(retired.map((r) => r.retire_level)) ?? 0,
    survival: rows.length ? rows.filter((r) => r.end_kind !== 'died').length / rows.length : 0,
  }
}

export function buildAlerts(byAttitude: ReadonlyMap<string, LifeRow[]>, content: Content, lethalAllowed: boolean): Alert[] {
  const all = [...byAttitude.values()].flat()
  const out: Alert[] = []

  // R1 태도가 보상 배율 차이만 되는 문제
  const scores = [...byAttitude].map(([id, rows]) => ({ id, ...attitudeScores(rows) }))
  const best = (key: 'income' | 'discoveries' | 'retireLevel' | 'survival'): string =>
    scores.reduce((a, b) => (b[key] > a[key] ? b : a), scores[0]!).id
  const winners = scores.length >= 2 ? ['income', 'discoveries', 'retireLevel', 'survival'].map((k) => best(k as 'income')) : []
  const sweep = winners.length > 0 && winners.every((w) => w === winners[0])
  const levels = scores.map((s) => s.retireLevel)
  const gap = levels.length >= 2 ? Math.max(...levels) - Math.min(...levels) : 0
  out.push({
    id: 'R1',
    risk: '태도가 보상 배율 차이만 된다',
    threshold: '한 태도가 4지표 모두 1위, 또는 은퇴 레벨 중앙값 차 > 3',
    observed: scores.length >= 2
      ? `1위 ${winners.join('/')} · 은퇴 레벨 ${levels.map((l) => fmt(l)).join('/')} (차 ${fmt(gap)})`
      : '태도가 하나뿐',
    fired: scores.length >= 2 ? sweep || gap > 3 : null,
  })

  // R2 치명 꺼짐 사망(귀여운 관찰과 상실감 충돌의 일부 지표)
  const deaths = all.filter((r) => r.end_kind === 'died').length
  out.push({
    id: 'R2',
    risk: '치명 위험이 꺼져 있는데 사망한다',
    threshold: '치명 꺼짐 사망 > 0',
    observed: lethalAllowed ? `치명 허용 켬(해당 없음) · 사망 ${deaths}건` : `사망 ${deaths}건`,
    fired: lethalAllowed ? null : deaths > 0,
  })

  // R3 계승이 초반 성장을 지운다(2대 이상을 돌렸을 때만)
  const gen1 = all.filter((r) => r.gen === 1)
  const later = all.filter((r) => r.gen >= 2)
  const a1 = med(gen1.map((r) => r.level10_age))
  const a2 = med(later.map((r) => r.level10_age))
  const faster = a1 !== null && a2 !== null && a1 > 18 ? (a1 - a2) / (a1 - 18) : null
  out.push({
    id: 'R3',
    risk: '계승이 초반 성장을 지워버린다',
    threshold: '2대가 1대보다 레벨 10에 25% 이상 빨리 도달',
    observed: later.length ? `1대 ${fmt(a1, '세')} → 2대 이후 ${fmt(a2, '세')} (${fmt(faster === null ? null : faster * 100, '%')})` : '2대 이후 생애 없음',
    fired: faster === null ? null : faster >= 0.25,
  })

  // R4 중요한 선택이 진행을 너무 자주 막는다
  const waits = med(all.map((r) => r.choice_waits))
  out.push({
    id: 'R4',
    risk: '선택 대기가 진행을 자주 막는다',
    threshold: '생애당 선택 대기 > 4회',
    observed: `중앙값 ${fmt(waits, '회')}`,
    fired: waits === null ? null : waits > 4,
  })

  // R8 흡혈귀 갈증이 운영과 무관하게 한계에 닿는다
  const vamp = all.filter((r) => r.vampire === 1)
  const limit = vamp.filter((r) => r.thirst_max >= 100).length
  const high = vamp.filter((r) => r.thirst_high_ratio > 30).length
  out.push({
    id: 'R8',
    risk: '흡혈귀 갈증이 한계에 닿는다',
    threshold: '갈증 100 도달 > 20%, 또는 갈증 70 이상 체류 > 30%',
    observed: vamp.length ? `흡혈귀 ${vamp.length}생애 · 100 도달 ${pct(limit, vamp.length)} · 70 이상 체류 초과 ${pct(high, vamp.length)}` : '흡혈귀 생애 없음',
    fired: vamp.length ? limit / vamp.length > 0.2 || high / vamp.length > 0.3 : null,
  })

  // R9 F03 기회 구간이 너무 짧다
  const adv = byAttitude.get(ADVENTUROUS) ?? []
  const routeAge = med(adv.map((r) => r.deep_route_age))
  const f03 = adv.filter((r) => (r.fate_by_event[R9_FATE_EVENT] ?? 0) > 0).length
  out.push({
    id: 'R9',
    risk: 'F03 기회 구간이 짧다',
    threshold: `모험적 최심 경로 첫 진입 중앙값 > 62세, 또는 ${R9_FATE_EVENT} 제시율 < 30%`,
    observed: adv.length ? `첫 진입 ${fmt(routeAge, '세')} · ${R9_FATE_EVENT} 제시율 ${pct(f03, adv.length)}` : '모험적 생애 없음',
    fired: adv.length ? (routeAge !== null && routeAge > 62) || f03 / adv.length < 0.3 : null,
  })

  // R10 후반 장비 구매가 경제 목표를 넘는다
  const spendP90 = quantile(all.map((r) => r.expense_ratio).filter((v): v is number => v !== null), 0.9)
  out.push({
    id: 'R10',
    risk: '후반 장비 구매가 경제 목표를 넘는다',
    threshold: '수입 대비 지출 p90 > 85%',
    observed: `p90 ${fmt(spendP90, '%')}`,
    fired: spendP90 === null ? null : spendP90 > 85,
  })

  // R11 안정적 태도가 후반 콘텐츠에 닿지 못한다
  const stable = byAttitude.get(STABLE) ?? []
  const ranks = content.list('guild_rank').sort((a, b) => a.order - b.order)
  const goldOrder = ranks.find((r) => r.id === R11_GOLD_RANK)?.order ?? null
  const orderOf = (id: string): number => ranks.find((r) => r.id === id)?.order ?? -1
  const gold = goldOrder === null ? 0 : stable.filter((r) => orderOf(r.guild_rank) >= goldOrder).length
  const deep = stable.filter((r) => r.deep_dungeon_age !== null).length
  out.push({
    id: 'R11',
    risk: '안정적 태도가 후반 콘텐츠에 닿지 못한다',
    threshold: `${R11_GOLD_RANK} 도달 < 60%, 또는 최심 던전 첫 진입 < 50%`,
    observed: stable.length ? `${R11_GOLD_RANK} 도달 ${pct(gold, stable.length)} · 최심 던전 진입 ${pct(deep, stable.length)}` : '안정적 생애 없음',
    fired: stable.length && goldOrder !== null ? gold / stable.length < 0.6 || deep / stable.length < 0.5 : null,
  })

  return out
}
