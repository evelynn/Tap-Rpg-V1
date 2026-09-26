import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  candidateStats, createChildCandidate, createFallbackCandidates, defaultHeir, endLife, heirCandidates, makePartner,
  parentCall, readPartner, startHeir, suggestNames, usedNames, writePartner,
} from '../../src/succession/index'
import { lifeWorld, setAge, withFamily } from './fixture'

describe('가정과 자녀(12 §2)', () => {
  it('동반자는 이름·직업·선천 특성 1~2개를 갖고 가문에 남는다', () => {
    const w = lifeWorld()
    setAge(w, 28)
    const p = makePartner(w, w.rng.life)
    assert.ok(p.name.length > 0)
    assert.ok(p.job.length > 0)
    assert.ok(p.traits.length >= 1 && p.traits.length <= 2)
    for (const id of p.traits) assert.equal(w.content.get('trait', id).kind, 'innate')
    assert.deepEqual(readPartner(w.state.family, 1), p)
    assert.notEqual(p.name, w.state.character!.name)
  })

  it('자녀 후보는 최대 3명이고 첫째가 기본 후보다(12 §2.2·§4.2)', () => {
    const w = lifeWorld()
    withFamily(w, 3)
    const ch = w.state.character!
    assert.equal(ch.children.length, 3)
    const list = heirCandidates(w.state.family, ch)
    assert.equal(list.length, 3)
    assert.equal(defaultHeir(w.state.family, ch)!.uid, ch.children[0])
    // 생전 지정이 우선한다
    ch.heir_preferred = ch.children[2]!
    assert.equal(defaultHeir(w.state.family, ch)!.uid, ch.children[2])
  })

  it('후보의 능력치는 배경마다 다르지만 같은 배경이면 늘 같다(12 §2.2)', () => {
    const w = lifeWorld()
    withFamily(w, 1)
    const cand = w.state.family.candidates[w.state.character!.children[0]!]!
    const seed = w.state.family.family_seed
    const a = candidateStats(w.content, seed, cand, 'bg_river', ['str'])
    const b = candidateStats(w.content, seed, cand, 'bg_river', ['str'])
    const c = candidateStats(w.content, seed, cand, 'bg_miner', ['str'])
    assert.deepEqual(a, b)
    assert.notDeepEqual(a, c)
    assert.equal(c.wil >= 2, true) // 광부 집안은 의지 1점 고정
    const total = Object.values(a).reduce((s, v) => s + v, 0)
    assert.equal(total, w.content.balance.stats.birth_base * 6 + w.content.balance.stats.birth_points)
  })
})

describe('방계와 입양(12 §2.3·§3.1·§3.3)', () => {
  it('직계가 없으면 생애 종료 1단계에서 방계 또는 입양 후보를 만든다', () => {
    for (let i = 0; i < 10; i++) {
      const w = lifeWorld({ seed: `2222222222${i.toString(16).padStart(6, '0')}` })
      setAge(w, 68)
      const plan = endLife(w, { kind: 'retired', place: 'T00', roleId: 'letters' })
      assert.ok(plan.candidates.length >= 1, '후보가 없어서 진행이 끝나는 일은 없다')
      const rel = plan.candidates[0]!.relation
      assert.ok(rel === 'collateral' || rel === 'adopted')
      assert.ok(plan.candidates.every((c) => c.relation === rel), '후보는 한 층에서만 나온다')
      const heir = startHeir(w, plan)
      assert.equal(heir.family_role, rel)
    }
  })

  it('입양 후보는 유전분이 0이라 모든 특성이 신규다(12 §3.3)', () => {
    const w = lifeWorld()
    setAge(w, 68)
    // 형제자매 없음(10%)을 강제하려고 후보를 여러 시드로 만들어 입양 사례를 찾는다
    let adopted: ReturnType<typeof createFallbackCandidates>[number] | undefined
    for (let i = 0; i < 40 && !adopted; i++) {
      const w2 = lifeWorld({ seed: `3333333333${i.toString(16).padStart(6, '0')}` })
      setAge(w2, 68)
      adopted = createFallbackCandidates(w2, w2.rng.life).find((c) => c.relation === 'adopted')
    }
    assert.ok(adopted, '입양 후보가 나오는 시드가 있다')
    assert.ok(adopted!.traits.every((t) => t.from === 'new'))
  })

  it('가족 호칭은 방계·입양에서 바뀐다(12 §3.5)', () => {
    const w = lifeWorld()
    const calls = new Set<string>()
    for (let i = 0; i < 30; i++) calls.add(parentCall(w.content, w.rng.life, 'direct'))
    assert.deepEqual([...calls].sort(), ['부모님', '아버지', '어머니'])
    const collateral = new Set<string>()
    for (let i = 0; i < 30; i++) collateral.add(parentCall(w.content, w.rng.life, 'collateral'))
    for (const c of collateral) assert.ok(['이모', '삼촌', '큰 어른'].includes(c), c)
  })

  it('이름 추천은 3개이고 가문 안에서 겹치지 않는다(12 §3.6)', () => {
    const w = lifeWorld()
    withFamily(w, 2)
    const names = suggestNames(w, w.rng.life)
    assert.equal(names.length, 3)
    assert.equal(new Set(names).size, 3)
    assert.equal(names.includes(w.state.character!.name), false)
  })
})

describe('자녀 후보는 다시 뽑히지 않는다(12 §10)', () => {
  it('계승 화면을 다시 열어도 후보와 특성이 그대로다', () => {
    const w = lifeWorld()
    withFamily(w, 2)
    setAge(w, 68)
    const before = JSON.parse(JSON.stringify(w.state.family.candidates)) as unknown
    const plan = endLife(w, { kind: 'retired', place: 'T00', roleId: 'letters' })
    assert.deepEqual(w.state.family.candidates, before)
    assert.equal(plan.candidates.length, 2)
  })

  it('S02 자녀 후보는 만들 때 값을 모두 확정한다', () => {
    const w = lifeWorld()
    setAge(w, 29)
    makePartner(w, w.rng.life)
    const cand = createChildCandidate(w, w.rng.life)
    assert.equal(cand.relation, 'direct')
    assert.equal(cand.created_at_parent_age, 29)
    assert.ok(cand.traits.length >= 1)
    assert.ok(cand.episodes.length >= 1)
    assert.ok(cand.appearance.hair.length > 0)
  })
})

describe('이름 다시 쓰기(02 §9.1 5대 안 중복 금지, 12 §3.6, B1)', () => {
  // 30대째 가문: 연대기 29명이 풀 56개 가운데 29개를, 동반자 29명이 또 다른 이름을 모두 썼다(이전 구현은 여기서 멈췄다)
  function oldFamily() {
    const w = lifeWorld()
    const pool = w.content.list('name_pool').flatMap((p) => p.given_names)
    const base = w.state.family.chronicle[0] ?? null
    const G = 30
    w.state.family.generation = G
    w.state.character!.generation = G
    w.state.character!.name = pool[55]!
    w.state.family.chronicle = Array.from({ length: G - 1 }, (_, i) => ({ ...(base ?? {}), gen: i + 1, name: pool[i]! }) as (typeof w.state.family.chronicle)[number])
    for (let g = 1; g <= G; g++) writePartner(w.state.family, { gen: g, name: pool[(29 + g - 1) % 55]!, job: '', traits: [], hair_color: '' })
    return { w, pool, G }
  }

  it('최근 4대 연대기·지금 인물·최근 두 세대 동반자 이름만 뺀다', () => {
    const { w, pool, G } = oldFamily()
    const used = usedNames(w.state)
    assert.ok(used.has(pool[55]!), '지금 인물')
    for (let g = G - 4; g <= G - 1; g++) assert.ok(used.has(pool[g - 1]!), `연대기 ${g}대`)
    assert.ok(!used.has(pool[G - 6]!), '5대 밖(25대) 이름은 다시 쓸 수 있다')
    assert.ok(used.has(pool[(29 + G - 1) % 55]!) && used.has(pool[(29 + G - 2) % 55]!), '최근 두 세대 동반자')
    assert.ok(!used.has(pool[(29 + G - 3) % 55]!), '세 세대 전 동반자는 다시 쓸 수 있다')
  })

  it('풀을 다 써 본 30대째 가문에서도 이름 추천 3개가 나온다', () => {
    const { w } = oldFamily()
    const names = suggestNames(w, w.rng.life)
    assert.equal(new Set(names).size, 3)
  })
})
