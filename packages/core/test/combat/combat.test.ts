// 전투 절차(05 §7, 07 §2·§4). 고정 난수로 한 라운드씩 확인하고, 결정성과 등록부 계약을 본다.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { armorClass, damageProfile, enemySpecials, maxHp, weaponProfile } from '../../src/index'
import { ENEMY_SPECIAL_HANDLERS, applyCombat, resolveCombat, type CombatResult } from '../../src/combat/index'
import { baseContent, equipDef, fakeRng, fakeWorld, referenceWorld } from './base-content'

const plain = (level: number) => [{ id: 'ZZ_PLAIN', level }]
const charRounds = (r: CombatResult) => r.rounds.filter((x) => x.actor === 'char')

describe('전투 — 등록부 계약', () => {
  it('적 특수능력 핸들러가 등록부와 같다(ARCHITECTURE §3)', () => {
    assert.deepEqual(Object.keys(ENEMY_SPECIAL_HANDLERS).sort(), enemySpecials.list().map((e) => e.name).sort())
  })
})

describe('전투 — 라운드 절차', () => {
  it('자연 20은 자동 명중에 피해 ×2, 자연 1은 빗나가고 이번 라운드 적 명중 +2(05 §7.2)', () => {
    const w = referenceWorld(5)
    const d = damageProfile(w)
    // 1라운드: 인물 자연 20(피해 최대 ×2) · 적은 주사위 1 + 적 명중 3 = 4로 빗나감
    // 2라운드: 인물 자연 1(빗나감, 적 명중 +2) · 적 주사위 9 + 3 + 2 = 14 ≥ 방어 12 명중
    const r = resolveCombat(fakeWorld(w, fakeRng({ d20: [20, 1, 1, 9], int: [d.max, 99] })), {
      enemies: plain(5), regionLevel: 5, ambush: false, flee: false,
    })
    const c = charRounds(r)
    assert.equal(c[0]!.hit, true)
    assert.equal(c[0]!.damage, (d.max + d.bonus) * w.content.balance.combat.crit_mult)
    assert.equal(c[1]!.hit, false)
    const enemy2 = r.rounds.filter((x) => x.actor !== 'char')[1]!
    assert.equal(enemy2.total, 9 + 3 + w.content.balance.combat.fumble_enemy_bonus)
    assert.equal(enemy2.hit, true)
  })

  it('매복 실패는 적 선공 + 1라운드 적 명중 +2, 인물 공격 없음(05 §7.3)', () => {
    const w = referenceWorld(5)
    // 매복 대응 판정 주사위 1(대실패) → 적 선공
    const r = resolveCombat(fakeWorld(w, fakeRng({ d20: [1] })), { enemies: plain(5), regionLevel: 5, ambush: true, flee: false })
    assert.equal(r.initiative, 'enemy')
    assert.equal(r.rounds[0]!.actor, 'ZZ_PLAIN')
    assert.equal(r.rounds[0]!.total, 10 + 3 + 2)
    assert.equal(charRounds(r)[0]!.round, 2)
  })

  it('기습(밤 은밀 성공)은 1라운드 적 공격 없음(05 §7.3)', () => {
    const w = referenceWorld(5)
    const r = resolveCombat(fakeWorld(w, fakeRng({ d20: [20] })), { enemies: plain(5), regionLevel: 5, ambush: false, stealth: true, night: false, flee: false })
    assert.equal(r.initiative, 'surprise')
    assert.deepEqual(r.rounds.filter((x) => x.round === 1).map((x) => x.actor), ['char'])
  })

  it('2체 조우는 남은 체력이 낮은 적부터 친다(05 §7.4)', () => {
    const w = referenceWorld(8)
    const r = resolveCombat(fakeWorld(w, fakeRng({ d20: [15, 15, 1, 1, 15, 15, 1, 1, 15, 15, 1, 1] })), {
      enemies: [{ id: 'ZZ_PLAIN', level: 8 }, { id: 'ZZ_PLAIN', level: 8 }], regionLevel: 8, ambush: false, flee: false,
    })
    // 첫 라운드에 1번 적이 맞으면 그다음도 체력이 낮은 1번을 계속 친다 → 1번이 먼저 쓰러진다
    const hits = charRounds(r).filter((x) => x.hit)
    assert.ok(hits.length >= 2)
    assert.equal(r.rewards.filter((x) => x.result === 'defeated').length >= 1, true)
  })

  it('라운드 상한을 넘기면 이탈, 남은 적 경험치는 stalemate 비율(05 §7.6)', () => {
    const w = referenceWorld(1)
    // 인물은 늘 빗나가고(주사위 2) 적도 빗나간다(주사위 1)
    const r = resolveCombat(fakeWorld(w, fakeRng({ d20: Array(200).fill(2).map((v, i) => (i % 2 ? 1 : v)) })), {
      enemies: plain(1), regionLevel: 1, ambush: false, flee: false,
    })
    assert.equal(r.outcome, 'stalemate')
    assert.equal(r.round_count, w.content.balance.combat.max_rounds.normal)
    assert.equal(r.rewards[0]!.result, 'remained')
    assert.equal(r.rewards[0]!.coins, 0)
    assert.equal(r.rewards[0]!.xp, Math.floor(baseContent().get('enemy', 'ZZ_PLAIN').xp * w.content.balance.combat.stalemate_xp_ratio))
  })

  it('같은 시드·같은 상태면 rounds가 같다(13 §8.3)', () => {
    const a = referenceWorld(10)
    const b = referenceWorld(10)
    const spec = { enemies: plain(10), regionLevel: 10 } as const
    assert.deepEqual(resolveCombat(a, spec), resolveCombat(b, spec))
  })

  it('resolve는 상태를 바꾸지 않고 apply가 체력·회복약·숙련을 적용한다', () => {
    const w = referenceWorld(10)
    const ch = w.state.character!
    const hp0 = ch.hp
    const r = resolveCombat(w, { enemies: plain(10), regionLevel: 10, ambush: false })
    assert.equal(ch.hp, hp0)
    const uses0 = ch.skills.melee.uses
    applyCombat(w, r)
    assert.equal(ch.hp, r.hp_end)
    assert.equal(ch.skills.melee.uses, uses0 + w.content.balance.skills.use_counts.combat + r.natural_20s * w.content.balance.skills.use_counts.natural_20)
    assert.equal(ch.stat_use_points[weaponProfile(w).stat] > 0, true)
    if (r.outcome === 'win') assert.equal(ch.counters.wins, 1)
  })
})

describe('전투 — 적 특수능력(07 §4)', () => {
  it('녹슨 투구(피해 감소)는 계열 추가 피해 앞에 적용한다(EN10)', () => {
    const w = referenceWorld(26)
    equipDef(w, 'W05') // 코볼트 대상 피해 +2(T2 무기)
    const d = damageProfile(w)
    const sp = baseContent().get('enemy', 'EN10').specials[0] as unknown as { value: number }
    const r = resolveCombat(fakeWorld(w, fakeRng({ d20: [18, 1], int: [d.max] })), {
      enemies: [{ id: 'EN10' }], regionLevel: 25, ambush: false, flee: false,
    })
    assert.equal(charRounds(r)[0]!.damage, d.max + d.bonus - sp.value + 2)
  })

  it('겁먹음은 체력이 낮으면 달아나고 경험치만 비율로 준다(EN01)', () => {
    const w = referenceWorld(5)
    const r = resolveCombat(fakeWorld(w, fakeRng({ d20: [20], chance: [true] })), {
      enemies: [{ id: 'EN01' }], regionLevel: 2, ambush: false, flee: false,
    })
    const rew = r.rewards[0]!
    assert.equal(rew.result, 'fled')
    assert.equal(rew.coins, 0)
    assert.ok(rew.xp > 0)
  })

  it('호루라기는 체력 절반에서 동료를 부르고 그 라운드에 공격하지 않는다(EB01)', () => {
    const w = referenceWorld(13)
    const r = resolveCombat(fakeWorld(w, fakeRng({ d20: Array(80).fill(20) })), {
      enemies: [{ id: 'EB01' }], regionLevel: 9, kind: 'elite_gate', ambush: false, flee: false,
    })
    assert.equal(r.rewards.length, 2)
    assert.equal(r.rewards[1]!.enemy_id, 'EN08')
  })

  it('EB03 2단계는 라운드마다 2회 공격하고 3단계는 방어가 내려간다(07 §4.4)', () => {
    const w = referenceWorld(28, { dex: 4 })
    w.state.inventory.consumables = {}
    const r = resolveCombat(fakeWorld(w, fakeRng({ d20: Array(400).fill(15) })), {
      enemies: [{ id: 'EB03' }], regionLevel: 25, kind: 'boss_gate', ambush: false, stealth: false, flee: false,
    })
    const boss = r.rounds.filter((x) => x.actor === 'EB03')
    const perRound = new Map<number, number>()
    for (const x of boss) perRound.set(x.round, (perRound.get(x.round) ?? 0) + 1)
    assert.ok([...perRound.values()].includes(2), '2단계 파편 비는 라운드 2회 공격')
    const acs = charRounds(r).map((x) => x.target_ac)
    assert.ok(Math.min(...acs) === Math.max(...acs) - 2, '3단계 방어 −2')
  })

  it('공포 면역(W10)이면 EB03 공포 판정을 굴리지 않는다', () => {
    const w = referenceWorld(28, { dex: 4 })
    equipDef(w, 'W10', 'rare')
    const r = resolveCombat(fakeWorld(w, fakeRng({ d20: Array(400).fill(15) })), {
      enemies: [{ id: 'EB03' }], regionLevel: 25, kind: 'boss_gate', ambush: false, stealth: false, flee: false,
    })
    assert.deepEqual(r.checks.filter((c) => c.kind === 'fear'), [])
  })

  it('관문 전투는 체력 30% 이하에서 회복약 1회(05 §7.7)', () => {
    const w = referenceWorld(24, { dex: 4 })
    w.state.inventory.consumables = { CP05: 2 }
    const r = resolveCombat(w, { enemies: [{ id: 'EB03' }], regionLevel: 25, kind: 'boss_gate', ambush: false, stealth: false, flee: false })
    assert.ok(r.potions.length <= w.content.balance.combat.gate_potion.uses)
    if (r.potions.length) assert.deepEqual(r.potions, ['CP05'])
    // 급히 한 모금(D55): 마신 라운드에도 공격하므로 인물 공격이 매 라운드 1회다
    assert.ok(r.potions.length)
    assert.equal(r.rounds.filter((x) => x.actor === 'char').length, r.round_count)
  })
})

describe('전투 — 밤·방 순번 레벨(01 §1.2, §5.2)', () => {
  it('밤은 적 레벨 +1, 던전 방 순번은 +⌊순번/2⌋', () => {
    const w = referenceWorld(10)
    const night = resolveCombat(fakeWorld(w, fakeRng()), { enemies: [{ id: 'EN08' }], regionLevel: 9, night: true, ambush: false, stealth: false, flee: false })
    assert.equal(night.rewards[0]!.level, 11)
    const room = resolveCombat(fakeWorld(w, fakeRng()), { enemies: [{ id: 'EN08' }], regionLevel: 9, roomIndex: 5, night: false, ambush: false, flee: false })
    assert.equal(room.rewards[0]!.level, 12)
  })

  it('적 방어·최대 HP는 바뀐 레벨을 기준식으로 다시 계산한다(01 §5.1)', () => {
    const w = referenceWorld(10)
    const r = resolveCombat(fakeWorld(w, fakeRng({ d20: [20, 1] })), {
      enemies: [{ id: 'EN08', level: 12 }], regionLevel: 9, night: false, ambush: false, flee: false,
    })
    assert.equal(charRounds(r)[0]!.target_ac, 10 + Math.floor(12 / 3))
    assert.equal(maxHp(w) > 0 && armorClass(w) > 0, true)
  })
})

describe('전투 — 판정 종류 기본 결과(05 §6.1)', () => {
  it('공포 판정 실패는 fear.fail_effects(퇴각 기준 +10%p)를 결과에 담는다', () => {
    const w = referenceWorld(12)
    const fail = w.content.balance.check_kinds.fear!.fail_effects
    assert.ok(fail?.length, '기반 팩 fear에 fail_effects가 있다')
    // EN04 울부짖음: 1라운드 시작에 공포 판정. 주사위 1 = 대실패
    const r = resolveCombat(fakeWorld(w, fakeRng({ d20: [1] })), {
      enemies: [{ id: 'EN04' }], regionLevel: 12, ambush: false, stealth: false, flee: false,
    })
    assert.ok(r.checks.some((c) => c.kind === 'fear'))
    assert.deepEqual(r.check_effects, fail as unknown[])
  })

  it('공포 판정에 성공하면 기본 결과가 붙지 않는다', () => {
    const w = referenceWorld(12)
    const r = resolveCombat(fakeWorld(w, fakeRng({ d20: [20] })), {
      enemies: [{ id: 'EN04' }], regionLevel: 12, ambush: false, stealth: false, flee: false,
    })
    assert.deepEqual(r.check_effects, [])
  })
})

describe('전투 — 매복 실패 가산 범위(05 §7.3)', () => {
  it('전투 전 원거리 공격(EN08 돌 던지기, round 0)에는 +2가 걸리지 않고 1라운드에만 걸린다', () => {
    const w = referenceWorld(12)
    const hit = 5 // EN08 등록 명중
    const add = w.content.balance.combat.ambush.fail_enemy_hit_add
    // 매복 대응 판정 1(실패) → 돌 던지기 주사위 7 → 1라운드 적 공격 주사위 7
    const r = resolveCombat(fakeWorld(w, fakeRng({ d20: [1, 7, 7] })), {
      enemies: [{ id: 'EN08' }], regionLevel: 12, ambush: true, flee: false,
    })
    const stone = r.rounds.find((x) => x.round === 0)!
    assert.equal(stone.total, 7 + hit)
    const first = r.rounds.find((x) => x.round === 1 && x.actor === 'EN08')!
    assert.equal(first.total, 7 + hit + add)
  })
})

describe('전투 — 결과별 성장 누적(05 §7.8)', () => {
  it('관문 숙련 가산과 무기 능력치 사용 점수는 승리에만 붙는다', () => {
    const uses = (outcome: 'win' | 'defeat') => {
      const w = referenceWorld(28, { dex: 4 })
      const ch = w.state.character!
      w.state.inventory.consumables = {}
      const before = { melee: ch.skills.melee.uses, str: ch.stat_use_points.str }
      applyCombat(w, {
        kind: 'boss_gate', outcome, initiative: 'char', rounds: [], round_count: 1,
        hp_start: 10, hp_end: outcome === 'win' ? 10 : 0, max_hp: 10, rewards: [], checks: [], check_effects: [],
        potions: [], charges: [], fatigue: 0, enemy_misses: 0, natural_20s: 0,
      })
      return { melee: ch.skills.melee.uses - before.melee, str: ch.stat_use_points.str - before.str }
    }
    const uc = baseContent().balance.skills.use_counts
    assert.equal(uses('win').melee, uc.boss_combat)
    assert.equal(uses('defeat').melee, uc.combat)
    assert.ok(uses('win').str > 0)
    assert.equal(uses('defeat').str, 0)
  })
})
