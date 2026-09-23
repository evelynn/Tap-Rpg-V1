// 화면 문자열 만들기. 입출력을 하지 않는 순수 함수라 단위 테스트로 검사한다(16 §6.9 태그표).
import { renderTemplate } from '@tap/core'

export const TAG_LABEL: Record<string, string> = {
  hunt: '사냥', adventure: '모험', dungeon: '던전', travel: '이동', rest: '휴식', town: '마을', gear: '장비',
  check: '판정', trait: '특성', growth: '성장', discovery: '발견', bond: '인연', injury: '부상',
  important: '중요', family: '가족', retire: '은퇴', death: '사망', succession: '계승', house: '가문',
}

export const SEASON_LABEL: Record<string, string> = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' }

export const STATE_LABEL: Record<string, string> = {
  town_idle: '마을', town_prep: '정비', travel: '이동', hunt: '사냥', adventure: '모험', dungeon: '던전',
  camp: '야영', return: '귀환', treatment: '치료', awaiting_choice: '선택 대기', awaiting_succession: '계승 대기', paused: '멈춤',
}

const END_LABEL: Record<string, string> = { died: '사망', retired: '은퇴', long_sleep: '긴 잠' }

const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

// 기록 한 줄에 필요한 것만 받는다(코어 JournalEntry가 그대로 들어맞는다)
export interface EntryView {
  age: number
  season: string
  tag: string
  importance: string
  line: string
  detail?: string
}

// `[24세 봄] [사냥] 문장` — 일상이 아닌 기록은 ★와 상세를 붙이고, color면 굵게 보여 준다
export function renderEntry(e: EntryView, color = false): string {
  const head = `[${e.age}세 ${SEASON_LABEL[e.season] ?? e.season}] [${TAG_LABEL[e.tag] ?? e.tag}]`
  const notable = e.importance !== 'daily'
  // 여러 줄 상세(정비 펼침·편지)는 이어지는 줄을 들여 써서 다음 기록과 구분한다
  const detail = e.detail?.split('\n').join('\n      ')
  const text = `${notable ? '★ ' : '  '}${head} ${e.line}${notable && detail ? ` — ${detail}` : ''}`
  return color && notable ? BOLD + text + RESET : text
}

export interface StatusView {
  gen: number
  name: string
  age: number
  season: string
  level: number
  hp: number
  maxHp: number
  coins: number
  place: string
  state: string
}

export function renderStatus(s: StatusView): string {
  const where = `${s.place}·${STATE_LABEL[s.state] ?? s.state}`
  return `${s.gen}대 ${s.name} | ${s.age}세 ${SEASON_LABEL[s.season] ?? s.season} | Lv${s.level} | 체력 ${s.hp}/${s.maxHp} | 동전 ${s.coins} | ${where}`
}

export interface ChoiceOptionView {
  id: string
  label: string
  benefit?: string
  cost?: string
}

export interface ChoiceView {
  kind: string // fate | branch
  title: string
  body: string
  note?: string
  options: ChoiceOptionView[]
}

// 선택 대기 화면: 운명은 [운명], 그 밖은 [선택]
export function renderChoice(v: ChoiceView): string {
  const out = [`[${v.kind === 'fate' ? '운명' : '선택'}] ${v.title}`, v.body]
  if (v.note) out.push(v.note)
  v.options.forEach((c, i) => {
    const hint = [c.benefit, c.cost].filter((t) => t).join(' / ')
    out.push(`  ${i + 1}) ${c.label}${hint ? ` — ${hint}` : ''}`)
  })
  return out.join('\n')
}

export interface LifeView {
  gen: number
  name: string
  epithet: string
  endAge: number
  endKind: string
  roleName: string | null // 은퇴 역할
  causeText: string | null // 사망 원인
  peakLevel: number
  summary: { sorties: number; encounters: number; defeats: number; serious_injuries: number; discoveries: number; coins_earned: number }
  relicNames: string[]
  majorLines: string[]
}

export function renderLife(v: LifeView): string {
  const end = END_LABEL[v.endKind] ?? v.endKind
  const tail = v.endKind === 'retired' ? `역할 ${v.roleName ?? '없음'}` : (v.causeText ?? '')
  const s = v.summary
  const out = [
    '',
    `── ${v.gen}대 ${v.name}의 생애 ──`,
    `${v.epithet} · ${v.endAge}세 ${end}${tail ? ` (${tail})` : ''} · 최고 Lv${v.peakLevel}`,
    `출정 ${s.sorties} · 조우 ${s.encounters} · 패배 ${s.defeats} · 중상 ${s.serious_injuries} · 발견 ${s.discoveries} · 번 동전 ${s.coins_earned}`,
  ]
  for (const line of v.majorLines) out.push(`  · ${line}`)
  out.push(`유품: ${v.relicNames.length ? v.relicNames.join(', ') : '없음'}`)
  return out.join('\n')
}

export interface HeirView {
  gen: number
  name: string
  relation: string
  parentCall: string | null
  traitNames: string[]
  relicNames: string[]
  coins: number
  capped: boolean
}

const RELATION_LABEL: Record<string, string> = { founder: '창시자', direct: '직계', collateral: '방계', adopted: '양자' }

export function renderHeir(v: HeirView): string {
  return [
    `── 계승 → ${v.gen}대 ${v.name} (${RELATION_LABEL[v.relation] ?? v.relation}${v.parentCall ? `, ${renderTemplate('부모를 {call:이라/라} 부른다', { call: v.parentCall })}` : ''}) ──`,
    `유전 특성: ${v.traitNames.length ? v.traitNames.join(', ') : '없음'}`,
    `물려받은 유품: ${v.relicNames.length ? v.relicNames.join(', ') : '없음'} · 이전 동전 ${v.coins}${v.capped ? ' (상한)' : ''}`,
    '',
  ].join('\n')
}
