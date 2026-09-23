// 복귀 요약 데이터(13 §6.1). 담을 항목과 순서만 정하고 문장·레이아웃은 14·03 문서가 만든다.
import { SKILLS } from '../schema/index'
import type { Character } from '../state/character'
import type { SaveBody } from '../state/save'
import type { StopReason } from './stop'

// 요약을 만들려고 정산 앞뒤로 떠 두는 값
export interface LifeSnapshot {
  uid: string
  age: number
  level: number
  coins: number
  ranks: number
  traits: string[]
  specialization: string
  injuries: number
}

export function lifeSnapshot(ch: Character, age: number): LifeSnapshot {
  return {
    uid: ch.uid,
    age,
    level: ch.level,
    coins: ch.coins,
    ranks: SKILLS.reduce((n, s) => n + (ch.skills[s]?.rank ?? 0), 0),
    traits: ch.traits.filter((t) => !t.inactive).map((t) => t.id),
    specialization: ch.specialization,
    injuries: ch.injuries.length,
  }
}

// 정산 중에 적용한 행동을 센 값
export interface ActionTally {
  sorties: number
  gate_wins: number
  returns: number
  defeats: number
}

export interface ReturnSummary {
  // 1 머리말
  settled_sec: number
  settled_min: number // 유효 진행 분
  discarded_sec: number // 버린 시간(13 §3.2)
  from_age: number
  to_age: number
  // 2 멈춘 이유
  stop_reason: StopReason
  // 3 활동 횟수
  sorties: number
  gate_wins: number
  returns: number
  // 4 성장
  level_from: number
  level_to: number
  rank_ups: number
  new_traits: string[]
  specialization: string | null // 이번 정산에서 정해졌으면
  // 5 장비
  gear_changes: number
  notable_gear: number[] // 희귀 이상 [장비] 기록 id
  // 6 부상과 패배
  defeats: number
  injuries: number
  // 7 이야기
  story: number[] // 주요 기록 id, 최대 5개
  // 8 재산
  coins_from: number
  coins_to: number
  // 9 기다리는 선택
  awaiting: 'fate' | 'branch' | 'succession' | null
  // 10 일지 바로가기
  journal_ids: number[] // 이 정산 구간의 기록 id
}

const STORY_MAX = 5

export function buildSummary(
  state: SaveBody,
  args: {
    before: LifeSnapshot
    after: LifeSnapshot
    tally: ActionTally
    stop_reason: StopReason
    settled_sec: number
    discarded_sec: number
    journal_from: number // 이 id보다 큰 기록이 이번 정산 구간이다
  },
): ReturnSummary {
  const { before, after, tally } = args
  const fresh = state.journal.filter((e) => e.id > args.journal_from)
  const gear = fresh.filter((e) => e.tag === 'gear')
  const story = fresh.filter((e) => e.importance === 'major' || e.importance === 'family')
  return {
    settled_sec: args.settled_sec,
    settled_min: args.settled_sec / 60,
    discarded_sec: args.discarded_sec,
    from_age: before.age,
    to_age: after.age,
    stop_reason: args.stop_reason,
    sorties: tally.sorties,
    gate_wins: tally.gate_wins,
    returns: tally.returns,
    level_from: before.level,
    level_to: after.level,
    rank_ups: Math.max(0, after.ranks - before.ranks),
    new_traits: after.traits.filter((id) => !before.traits.includes(id)),
    specialization: after.specialization !== before.specialization ? after.specialization : null,
    gear_changes: gear.length,
    notable_gear: gear.filter((e) => e.importance !== 'daily').map((e) => e.id),
    defeats: tally.defeats,
    injuries: after.injuries,
    story: story.slice(0, STORY_MAX).map((e) => e.id),
    coins_from: before.coins,
    coins_to: after.coins,
    awaiting: awaitingOf(state),
    journal_ids: fresh.map((e) => e.id),
  }
}

// 9 기다리는 선택: 정지 지점 1~3일 때만 바로가기를 둔다(13 §6.1)
function awaitingOf(state: SaveBody): ReturnSummary['awaiting'] {
  const p = state.pending_choice
  if (p) return p.kind === 'fate' ? 'fate' : 'branch'
  return state.current_activity.state === 'awaiting_succession' ? 'succession' : null
}
