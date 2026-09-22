// 밸런스 검산(01 §17·부록 A, 07 §4.4). 기준 인물(01 §2.4)로 몬테카를로를 돌려 목표 범위를 본다.
// 부록 A의 수치는 라운드·손실을 기대값으로 어림한 값이라 라운드 절차(05 §7.2)를 그대로 돌린 결과와 조금 다르다.
// 아래 범위는 그 차이를 적은 것이고, 어긋남은 최종 보고의 문서 모호점에 남겼다.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveCombat } from '../../src/combat/index'
import { referenceWorld } from './base-content'

const N = 2000
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

interface Sample { rounds: number; loss: number; win: number }

function sample(level: number, n = N): Sample {
  const w = referenceWorld(level)
  let rounds = 0
  let loss = 0
  let win = 0
  for (let i = 0; i < n; i++) {
    const r = resolveCombat(w, { enemies: [{ id: 'ZZ_PLAIN', level }], regionLevel: level, ambush: false, night: false })
    rounds += r.round_count
    loss += (r.hp_start - r.hp_end) / r.max_hp
    if (r.outcome === 'win') win++
  }
  return { rounds: rounds / n, loss: loss / n, win: win / n }
}

describe('밸런스 — 동급 적 1체(01 §17, 부록 A)', () => {
  const levels = [1, 5, 10, 15, 20, 25, 30]
  const all = levels.map((l) => sample(l))

  it(`레벨마다 ${N}회: 평균 라운드 3~5.5`, () => {
    for (const [i, s] of all.entries()) {
      assert.ok(s.rounds >= 3 && s.rounds <= 5.5, `레벨 ${levels[i]} 라운드 ${s.rounds.toFixed(2)}`)
    }
  })

  it(`레벨마다 ${N}회: 체력 손실 6~14%`, () => {
    for (const [i, s] of all.entries()) {
      assert.ok(s.loss >= 0.06 && s.loss <= 0.14, `레벨 ${levels[i]} 손실 ${(s.loss * 100).toFixed(1)}%`)
    }
  })

  it('레벨 전체 평균은 목표 범위 안(라운드 3~5, 손실 8~14%)', () => {
    const rounds = avg(all.map((s) => s.rounds))
    const loss = avg(all.map((s) => s.loss))
    assert.ok(rounds >= 3 && rounds <= 5, `평균 라운드 ${rounds.toFixed(2)}`)
    assert.ok(loss >= 0.08 && loss <= 0.14, `평균 손실 ${(loss * 100).toFixed(1)}%`)
  })

  it('동급 적에게는 거의 이긴다(생애당 패배 목표, 01 §17)', () => {
    for (const s of all) assert.ok(s.win >= 0.98, `승률 ${(s.win * 100).toFixed(1)}%`)
  })
})

describe('밸런스 — EB03 관문(07 §4.4)', () => {
  // 가정: 관문 앞 체력 100%, 회복약 T5 1병, 의지 4, 행운 2, 민첩 4, 공포 보정 없음, 도주 없음
  const rows: { level: number; grade: 'common' | 'good' | 'rare'; win: number; rounds: number }[] = [
    { level: 24, grade: 'common', win: 0.41, rounds: 22 },
    { level: 27, grade: 'common', win: 0.63, rounds: 22 },
    { level: 27, grade: 'good', win: 0.93, rounds: 19 },
    { level: 28, grade: 'common', win: 0.83, rounds: 20 },
    { level: 28, grade: 'good', win: 0.98, rounds: 17 },
    { level: 28, grade: 'rare', win: 1.0, rounds: 15 },
  ]

  for (const row of rows) {
    it(`레벨 ${row.level} T5 ${row.grade}: 승률 ${(row.win * 100).toFixed(0)}% · ${row.rounds}라운드`, () => {
      const w = referenceWorld(row.level, { grade: row.grade, dex: 4 })
      const ch = w.state.character!
      ch.stats.wil = 4
      ch.stats.luk = 2
      w.state.inventory.consumables = { CP05: 1 }
      let win = 0
      let rounds = 0
      for (let i = 0; i < N; i++) {
        const r = resolveCombat(w, {
          enemies: [{ id: 'EB03' }], regionLevel: 25, kind: 'boss_gate', ambush: false, stealth: false, flee: false, night: false,
        })
        if (r.outcome === 'win') win++
        rounds += r.round_count
      }
      const p = win / N
      // 07 §4.4 표는 회복약을 마신 라운드에도 인물이 공격한다고 본 검산이다. 05 §7.7(공격 생략)을 지키면
      // 일반 등급에서 승률이 6~9%p 낮게 나온다(같은 회복약 처리를 쓰면 표와 ±3%p 안에서 맞는다).
      assert.ok(p >= row.win - 0.1 && p <= row.win + 0.05, `승률 ${(p * 100).toFixed(1)}% (문서 ${(row.win * 100).toFixed(0)}%)`)
      assert.ok(Math.abs(rounds / N - row.rounds) <= 2, `평균 라운드 ${(rounds / N).toFixed(1)} (문서 ${row.rounds})`)
    })
  }

  it('승률은 레벨·등급이 오를수록 높아진다', () => {
    const pick = (level: number, grade: 'common' | 'good') => {
      const w = referenceWorld(level, { grade, dex: 4 })
      w.state.character!.stats.wil = 4
      w.state.inventory.consumables = { CP05: 1 }
      let win = 0
      for (let i = 0; i < 500; i++) {
        const r = resolveCombat(w, { enemies: [{ id: 'EB03' }], regionLevel: 25, kind: 'boss_gate', ambush: false, stealth: false, flee: false, night: false })
        if (r.outcome === 'win') win++
      }
      return win / 500
    }
    assert.ok(pick(27, 'common') < pick(28, 'common'))
    assert.ok(pick(28, 'common') < pick(28, 'good'))
  })
})
