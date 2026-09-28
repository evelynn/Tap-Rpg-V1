// 복귀 요약 문장(13 §6.1 순서, 14 §9 문형). 화면(03 §9)은 이 결과를 그대로 늘어놓는다.
// 멈춘 까닭 문장은 데이터(summary.stop.*)이고, 항목 줄은 명사형 요약이라 여기서 잇는다.
import { renderTemplate } from '../text/index'
import { registerTextSlot } from '../schema/index'
import type { World } from '../sim/world'
import { STOP_REASONS, type StopReason } from './stop'
import type { ReturnSummary } from './summary'

export const SUMMARY_STOP_TEXT = Object.fromEntries(STOP_REASONS.map((c) => [c, `summary.stop.${c}`])) as Record<StopReason, string>
for (const id of Object.values(SUMMARY_STOP_TEXT)) registerTextSlot(id, '복귀 요약 멈춘 까닭(13 §6.2, 14 §9)')

export interface SummaryView {
  head: string // 약 1시간 12분 활동 · 24세 → 30세
  stop: string | null // 멈춘 까닭 한 문장(상한 도달은 실제로 버린 시간이 있을 때만)
  lines: string[] // 활동·성장·장비·부상·가호·재산(보일 것만)
  story: string[] // 주요 기록 한 줄(최대 5)
  awaiting: ReturnSummary['awaiting']
  lifeEnded: boolean
}

export function durationText(sec: number): string {
  const m = Math.max(1, Math.round(sec / 60))
  const h = Math.floor(m / 60)
  return h ? `${h}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`
}

export function summaryView(world: World, s: ReturnSummary): SummaryView {
  const { content, state } = world
  const byId = new Map(state.journal.map((e) => [e.id, e]))
  const ch = state.character
  const last = state.family.chronicle.at(-1)
  const placeName = (id: string | undefined): string => (id && content.has('region', id) ? content.get('region', id).name : '알 수 없는 곳')
  const lifeEnded = s.stop_reason.startsWith('life_end')
  const who = lifeEnded ? (last?.name ?? ch?.name ?? '') : (ch?.name ?? '')
  const vars = {
    name: who, age: s.to_age, heir: ch?.name ?? who,
    place: placeName(s.stop_reason === 'life_end_died' ? last?.cause?.location : ch?.location),
  }
  const stop = s.stop_reason === 'cap_reached' && s.discarded_sec <= 0
    ? null
    : renderTemplate(content.get('text', SUMMARY_STOP_TEXT[s.stop_reason]).variants[0]!, vars)

  const lines: string[] = []
  const act = [s.sorties ? `출정 ${s.sorties}회` : '', s.gate_wins ? `던전 관문 ${s.gate_wins}회 돌파` : '', s.returns ? `귀환 ${s.returns}회` : ''].filter(Boolean)
  if (act.length) lines.push(act.join(' · '))
  const grow = [
    s.level_to > s.level_from ? `레벨 ${s.level_from} → ${s.level_to}` : '',
    s.rank_ups ? `숙련 ${s.rank_ups}단계 상승` : '',
    s.new_traits.length ? `새 특성 ${s.new_traits.map((t) => (content.has('trait', t) ? content.get('trait', t).name : t)).join(', ')}` : '',
  ].filter(Boolean)
  if (grow.length) lines.push(grow.join(' · '))
  const rare = s.notable_gear.map((id) => byId.get(id)?.line).filter((l): l is string => !!l)
  if (s.gear_changes || rare.length) lines.push([s.gear_changes ? `장비 교체 ${s.gear_changes}회` : '', ...rare.slice(0, 2)].filter(Boolean).join(' · '))
  if (s.defeats || s.injuries) lines.push([s.defeats ? `패배 ${s.defeats}회` : '', s.injuries ? `지금 부상 ${s.injuries}` : ''].filter(Boolean).join(' · '))
  // 6-1 이상한 행운(D78): 이 구간에 발동한 가호 기록
  const luck = s.journal_ids.filter((id) => byId.get(id)?.sub === 'blessing').length
  if (luck) lines.push(`이상한 행운 ${luck}번`)
  lines.push(`동전 ${s.coins_from.toLocaleString('ko-KR')} → ${s.coins_to.toLocaleString('ko-KR')}`)
  return {
    head: `약 ${durationText(s.settled_sec)} 활동 · ${s.from_age}세 → ${s.to_age}세`,
    stop, lines,
    story: s.story.map((id) => byId.get(id)?.line).filter((l): l is string => !!l),
    awaiting: s.awaiting, lifeEnded,
  }
}
