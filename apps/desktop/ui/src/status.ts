// 이름·상태 줄(03 §2.4)과 상태 아이콘 4칸(03 §4.2). 아이콘 그림이 없어 단계·색·글자만 정하고 모양은 자리 도형으로 그린다.
import { ageAt, maxHp, type World } from '@tap/core'

// 03 §4.1 행동 상태 글자
export const STATE_LABEL: Record<string, string> = {
  town_idle: '마을', town_prep: '정비', travel: '이동', hunt: '사냥', adventure: '모험', dungeon: '던전',
  camp: '야영', return: '귀환', treatment: '치료', awaiting_choice: '선택 대기', awaiting_succession: '계승', paused: '멈춤',
}

export interface StatusView {
  name: string
  age: number
  state: string
  hpRatio: number // 0~1
  fatigue: number // 0~100
  light: number // 경상 개수
  serious: boolean
  choice: boolean // 선택 대기
  vampire: boolean
}

export interface Icon {
  slot: 'hp' | 'fatigue' | 'injury' | 'special'
  level: number // 칸 안 단계(0 = 가장 좋음/없음)
  color: string | null // null = 빈 칸
  label: string
}

export function statusViewOf(world: World): StatusView | null {
  const ch = world.state.character
  if (!ch) return null
  const max = maxHp(world)
  return {
    name: ch.name,
    age: ageAt(ch.eff_min, world.content.balance.time),
    state: world.state.current_activity.state,
    hpRatio: max > 0 ? Math.max(0, ch.hp) / max : 0,
    fatigue: ch.fatigue,
    light: ch.injuries.filter((i) => i.grade === 'light').length,
    serious: ch.injuries.some((i) => i.grade === 'serious'),
    choice: world.state.pending_choice !== null,
    vampire: ch.mutation !== null,
  }
}

// 조건어 우선순위: 선택 대기 > 중상 > 체력 위험 > 탈진 > 체력 낮음 > 경상 > 피곤
export function conditionWord(v: StatusView): string | null {
  if (v.choice) return '선택 대기'
  if (v.serious) return '중상'
  if (v.hpRatio < 0.2) return '체력 위험'
  if (v.fatigue >= 100) return '탈진'
  if (v.hpRatio < 0.4) return '체력 낮음'
  if (v.light > 0) return '경상'
  if (v.fatigue >= 40) return '피곤'
  return null
}

// `{이름} {나이}세 · {행동 상태}` + 조건어 최대 1개(행동 상태와 같은 글자면 붙이지 않는다)
export function statusLine(v: StatusView): string {
  const state = STATE_LABEL[v.state] ?? v.state
  const cond = conditionWord(v)
  return `${v.name} ${v.age}세 · ${state}${cond && cond !== state ? ` · ${cond}` : ''}`
}

export function icons(v: StatusView): Icon[] {
  const hp: Icon = v.hpRatio >= 0.7 ? { slot: 'hp', level: 0, color: '#5DA85D', label: '체력 좋음' }
    : v.hpRatio >= 0.4 ? { slot: 'hp', level: 1, color: '#D8B04A', label: '체력 보통' }
      : v.hpRatio >= 0.2 ? { slot: 'hp', level: 2, color: '#E0823A', label: '체력 낮음' }
        : { slot: 'hp', level: 3, color: '#D9534F', label: '체력 위험' }
  const fatigue: Icon = v.fatigue >= 100 ? { slot: 'fatigue', level: 3, color: '#D9534F', label: '탈진' }
    : v.fatigue >= 80 ? { slot: 'fatigue', level: 2, color: '#D9822B', label: '지침' }
      : v.fatigue >= 40 ? { slot: 'fatigue', level: 1, color: '#C9A34A', label: '피곤' }
        : { slot: 'fatigue', level: 0, color: '#9AA5B1', label: '개운' }
  const injury: Icon = v.serious ? { slot: 'injury', level: 3, color: '#C8453C', label: '중상' }
    : v.light > 0 ? { slot: 'injury', level: v.light, color: '#D9A441', label: '경상' }
      : { slot: 'injury', level: 0, color: null, label: '' }
  // 특수: 일시정지 > 정산 중 > 흡혈귀 > 저주. 정산 중·저주는 아직 잇지 않았다(TODO)
  const special: Icon = v.state === 'paused' ? { slot: 'special', level: 1, color: '#6C7A89', label: '일시정지' }
    : v.vampire ? { slot: 'special', level: 2, color: '#A3243A', label: '달의 갈증' }
      : { slot: 'special', level: 0, color: null, label: '' }
  return [hp, fatigue, injury, special]
}
