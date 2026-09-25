// 행동 상태·확정 결과 → 풍경 연출(03 §15, 15 §4·§8.2). 세계에서 필요한 것만 뽑은 ActView를 받아 순수하게 정한다.
import type { World } from '@tap/core'
import type { EnemyMotion, Motion } from './sprites'

export interface ActView {
  state: string // 행동 상태(ACTIVITY_STATES)
  seq: number // 확정 결과 번호(적 재생기를 조우마다 새로 만든다)
  kind: string | null // 적용 전 확정 결과의 행동 종류
  part: string | null // 결과 조각 종류(encounter·combat·gate·discovery·path·forage·trap·treasure·rest·event)
  progress: number // 행동 진행 0~1
  outcome: string | null
  enemyFamily: string | null // 적 정의의 sprite_family. 전투가 아니면 null
  endKind: string | null // 계승 대기 중 끝난 생애 종류(retired·died·long_sleep)
}

export interface Stage {
  hero: Motion | null
  flip: boolean // 왼쪽을 봄(귀환)
  enemy: { family: string; motion: EnemyMotion; key: number } | null
  scroll: -1 | 0 | 1 // 1 = 배경이 오른쪽→왼쪽으로 흐름(이동), -1 = 반대(귀환)
}

interface PartLike {
  kind?: string
  type?: string
  spec?: { enemies?: { id: string }[] }
}

export function actViewOf(world: World): ActView {
  const ca = world.state.current_activity
  const a = ca.resolved_action && !ca.resolved_action.applied ? ca.resolved_action : null
  const part = a?.effects[0] as PartLike | undefined
  const enemyId = part?.spec?.enemies?.[0]?.id
  const effMin = world.state.character?.eff_min ?? 0
  const progress = a ? (a.duration_sec > 0 ? Math.min(1, Math.max(0, ((effMin - a.started_eff_min) * 60) / a.duration_sec)) : 1) : 0
  return {
    state: ca.state,
    seq: a?.seq ?? 0,
    kind: a?.kind ?? null,
    part: part?.kind ?? part?.type ?? null,
    progress,
    outcome: a?.outcome ?? null,
    enemyFamily: enemyId && world.content.has('enemy', enemyId) ? world.content.get('enemy', enemyId).sprite_family : null,
    endKind: ca.life_loop.succession?.record.end_kind ?? null,
  }
}

// 전투 한 박자(실시간): 주인공 공격 → 적 피격, 적 공격 → 주인공 피격
export const COMBAT_BEAT_MS = 2400
const ENTER_UNTIL = 0.1 // 이 진행까지 적이 걸어 들어온다
const FIGHT_UNTIL = 0.85 // 이 진행부터 결말(퇴장·전리품·쓰러짐)
const TOWN_LOOK_MS = 12000 // 마을 대기 중 가끔 게시판 보기(발견)

const still = (hero: Motion | null, flip = false): Stage => ({ hero, flip, enemy: null, scroll: 0 })

function combat(v: ActView, family: string, t: number, flip: boolean): Stage {
  const enemy = (motion: EnemyMotion) => ({ family, motion, key: v.seq })
  if (v.progress < ENTER_UNTIL) return { hero: 'idle', flip, enemy: enemy('move'), scroll: 0 }
  if (v.progress >= FIGHT_UNTIL) {
    if (v.outcome === 'win') return { hero: v.part === 'gate' ? 'cheer' : 'interact', flip, enemy: enemy('exit'), scroll: 0 }
    if (v.outcome === 'defeat') return { hero: 'collapse', flip, enemy: enemy('idle'), scroll: 0 }
    if (v.outcome === 'fled') return { hero: 'walk', flip: true, enemy: enemy('idle'), scroll: -1 }
    return { hero: 'idle', flip, enemy: enemy('idle'), scroll: 0 }
  }
  const b = t % COMBAT_BEAT_MS
  const hero: Motion = b < 1200 ? 'attack' : b < 1400 ? 'idle' : 'hit'
  const foe: EnemyMotion = b < 300 ? 'idle' : b < 1200 ? 'hit' : 'attack'
  return { hero, flip, enemy: enemy(foe), scroll: 0 }
}

export function direct(v: ActView, t: number): Stage {
  switch (v.state) {
    case 'awaiting_choice':
      return still('wait_book')
    case 'awaiting_succession':
      return still(v.endKind === 'died' ? null : 'sit_eat') // 사망이면 캐릭터 없음(03 §15)
    case 'treatment':
      return still('sleep')
    case 'camp':
      return still(v.progress < 0.5 ? 'sit_eat' : 'sleep')
    case 'town_prep':
      return still(v.kind === 'inn' ? 'sleep' : 'interact')
    case 'town_idle':
      if (v.kind === 'inn') return still('sleep')
      if (v.kind === 'travel') return { hero: 'walk', flip: false, enemy: null, scroll: 1 }
      return still(t % TOWN_LOOK_MS < 1200 ? 'discover' : 'idle')
    case 'travel':
      return { hero: 'walk', flip: false, enemy: null, scroll: 1 }
  }
  // 사냥·모험·던전·귀환: 조각 종류로 정한다
  const back = v.state === 'return'
  if (v.enemyFamily) return combat(v, v.enemyFamily, t, back)
  if (v.kind === 'travel' || v.part === 'path' || (back && v.kind === null)) {
    return { hero: 'walk', flip: back, enemy: null, scroll: back ? -1 : 1 }
  }
  switch (v.part) {
    case 'discovery':
    case 'event':
      return still('discover', back)
    case 'forage':
    case 'trap':
    case 'treasure':
      return still('interact', back)
    case 'rest':
      return still('sit_eat', back)
  }
  return still('idle', back)
}
