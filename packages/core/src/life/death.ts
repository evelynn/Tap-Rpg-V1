// 사망 처리(09 §5). 최후 판정은 T5(combat/defeat)가 굴리고, 이 파일은 그 결과(DeathRecord)를 받아
// 원인 기록 세 줄(09 §5.4)과 다음 세대 방침 확인 데이터(09 §5.5)를 만든다.
import type { DeathRecord } from '../combat/defeat'
import type { RuleContext } from '../rules/context'
import { STAT_LABELS } from '../rules/labels'
import type { ACTIVITY_RISKS } from '../schema/index'
import type { JournalDraft } from '../state/journal'
import { INJURY_GRADES } from '../schema/index'

const RISK_LABELS: Record<(typeof ACTIVITY_RISKS)[number], string> = {
  very_low: '매우 낮음', low: '낮음', normal: '보통', high: '높음', reckless: '무모함',
}

const INJURY_LABELS: Record<(typeof INJURY_GRADES)[number], string> = { light: '경상', serious: '중상' }

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`)

export interface CauseLines {
  risk_line: string
  injury_line: string
  final_check_line: string
}

// 09 §5.4 "운이 나빴다로만 표시하지 않는다": 진입 위험 / 누적 부상 / 결정적 순간
export function causeLines(ctx: RuleContext, d: DeathRecord): CauseLines {
  const { content } = ctx
  const grade = RISK_LABELS[d.risk.grade as (typeof ACTIVITY_RISKS)[number]] ?? d.risk.grade
  const lethal = content.has('enemy', d.lethal_source) ? content.get('enemy', d.lethal_source).name : d.lethal_source
  const allowed = d.policy.lethal_allowed ? '켬' : '끔'
  const risk_line = `치명(${lethal}), 위험 차 ${signed(d.risk.diff)}(${grade}), 치명 위험 허용 ${allowed}`

  const counts = INJURY_GRADES.map((g) => {
    const list = d.start.injuries.filter((i) => i.grade === g)
    return list.length ? `${INJURY_LABELS[g]} ${list.length}(${list.map((i) => `${STAT_LABELS[i.stat]} −1`).join(', ')})` : null
  }).filter((x): x is string => x !== null)
  const hp = `진입 시 체력 ${Math.round(d.start.hp_ratio * 100)}%`
  const serious = d.serious_total > 0 ? `중상 누적 ${d.serious_total}회` : null
  const injury_line = [...counts, hp, `회복약 ${d.start.potions}개`, serious].filter((x) => x !== null).join(', ')

  const c = d.final_check
  const parts = c.parts.map((p) => `${p.label} ${signed(p.value)}`).join(' ')
  const final_check_line = `최후 판정 주사위 ${c.dice}${parts ? ` ${parts}` : ''} = ${c.total} / 난이도 ${c.dc}`
  return { risk_line, injury_line, final_check_line }
}

// 기본 창 한 줄(09 §5.2)과 원인 기록. 사건(S04)이 상세를 채우므로 여기서는 요약만 남긴다
export function deathNotice(d: DeathRecord, lines: CauseLines): JournalDraft {
  return {
    tag: 'death',
    importance: 'family',
    line: `${d.name}의 등불이 꺼졌다`,
    detail: [`진입 위험 : ${lines.risk_line}`, `누적 부상 : ${lines.injury_line}`, `결정적 순간 : ${lines.final_check_line}`].join('\n'),
    refs: { location_id: d.location },
  }
}

export interface PolicyRow {
  key: 'attitude' | 'risk_cap' | 'lethal_allowed' | 'destination'
  value: string
  highlight: boolean // 사망에 직접 관여한 방침(09 §5.5)
}

// 09 §5.5 다음 세대 방침 확인 화면의 데이터. 계승 3단계 전에 한 번 보여 준다
export function nextGenPolicies(ctx: RuleContext): PolicyRow[] {
  const { content, state } = ctx
  const p = state.policies
  const attitude = content.has('attitude', p.attitude) ? content.get('attitude', p.attitude).name : p.attitude
  const fixed = p.destination !== 'auto'
  return [
    { key: 'attitude', value: attitude, highlight: false },
    { key: 'risk_cap', value: p.risk_cap, highlight: true },
    { key: 'lethal_allowed', value: p.lethal_allowed ? '켬' : '끔', highlight: p.lethal_allowed },
    { key: 'destination', value: fixed ? p.destination : '자동', highlight: fixed },
  ]
}
