// 전투 모듈 공용 타입. 저장 가능한 결과(CombatResult)는 JSON 값만 담는다.
import type { Rng } from '../rules/random'
import type { RuleContext } from '../rules/context'
import type { CheckRoll } from '../rules/check'
import type { ModSource } from '../rules/modifiers'
import type { ENEMY_RANKS } from '../schema/index'
import type { CheckResult } from '../state/journal'

export type { Condition, Modifier } from '../schema/index'
export type { EnemySpecial } from '../schema/world/specials'
export type SavedEffectLike = { type: string; [key: string]: unknown }

export type EnemyRank = (typeof ENEMY_RANKS)[number]
export type CombatKind = 'normal' | 'elite_gate' | 'boss_gate'
export type CombatOutcome = 'win' | 'defeat' | 'stalemate' | 'fled'
export type Initiative = 'char' | 'enemy' | 'surprise'

// 전투에서 규칙이 이름으로 부르는 판정 종류(05 §6.1 표의 키, balance.check_kinds)
export const COMBAT_CHECKS = {
  fear: 'fear',
  flee: 'flee',
  ambush: 'ambush',
  stealth: 'stealth',
  injury: 'injury',
  final: 'final',
} as const

// 라운드 기록 1줄(공격 1회). round 0 = 전투 전 공격(돌 던지기)
export interface RoundRecord {
  round: number
  actor: string // 'char' 또는 적 정의 id
  dice: number
  total: number
  target_ac: number
  hit: boolean
  damage: number
}

export interface CombatReward {
  enemy_id: string
  level: number
  rank: EnemyRank
  result: 'defeated' | 'fled' | 'remained'
  xp: number // 활동 계수·과소 난도 감쇠·도주·이탈 비율 반영, 소수 버림
  coins: number // 쓰러뜨린 적만. 동전 배수 반영, 소수 버림
}

export interface CombatResult {
  kind: CombatKind
  outcome: CombatOutcome
  initiative: Initiative
  rounds: RoundRecord[]
  round_count: number
  hp_start: number
  hp_end: number
  max_hp: number
  rewards: CombatReward[]
  checks: CheckRoll[] // 전투 중 판정(매복 대응·은밀·공포·도주·특수능력). 성장 누적은 applyCombat
  // 판정 종류의 실패·부분 성공 기본 결과(05 §6.1). 효과 실행기는 전투 밖이라 부르는 쪽이 적용한다
  check_effects: SavedEffectLike[]
  potions: string[] // 전투 중 마신 회복약 id
  charges: { uid: string; target: string }[] // 쓴 충전(매복 무효)
  fatigue: number // 전투 뒤 추가 피로(쇳소리)
  enemy_misses: number
  natural_20s: number // 인물 공격의 자연 20
}

// 전투 중 적 1체
export interface Foe {
  id: string
  family: string
  level: number
  rank: EnemyRank
  maxHp: number
  hp: number
  ac: number
  hit: number
  dmg: [number, number]
  xp: number // 적 경험치(등급 배수 포함)
  coins: number
  specials: { kind: string; [key: string]: unknown }[]
  status: 'alive' | 'defeated' | 'fled'
  xpRatio: number // 달아난 적의 경험치 비율
  struck: number // 인물이 이 적을 공격한 횟수
  uses: Record<string, number> // 특수능력 사용 횟수
}

// 특수능력 핸들러가 보는 전투 상태
export interface Battle {
  ctx: RuleContext
  rng: Rng
  kind: CombatKind
  round: number
  initiative: Initiative
  foes: Foe[]
  hp: number
  maxHp: number
  sources: ModSource[]
  acAdd: number // 인물 방어 가감(갉아먹기)
  hitMods: { value: number; until: number }[] // 인물 명중 가감(라운드 until까지)
  fatigue: number
  check(kind: string, dcOffset: number): CheckResult
  addFoe(id: string, level?: number): Foe
  enemyAttack(foe: Foe, opts?: { damage?: [number, number]; hitCheck?: boolean }): void
  applyEffects(effects: readonly SavedEffectLike[]): void
}

export type { Rng }
