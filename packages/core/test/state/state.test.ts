import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SEASONS, World, issueJournalId, issueUid, maxHp, saveBodySchema, saveRootSchema } from '../../src/index'
import { APPEARANCE, SEED, makeContent, makeWorld } from '../fixture'

describe('저장 상태 스키마', () => {
  it('새 가문 상태가 스키마를 통과하고 왕복해도 같다', () => {
    const snap = makeWorld().snapshot()
    const parsed = saveBodySchema.parse(snap)
    assert.deepEqual(parsed, snap)
  })

  it('header(C1)를 포함한 저장 루트', () => {
    const body = makeWorld().snapshot()
    const root = {
      header: {
        schema_version: 1, app_version: '0.1.0', saved_at_utc: 1790000000000, checksum: 'abc', encoding: 'json',
        content_packs: [{ id: 'base', version: '0.1.0' }], content_hash: 'ff',
      },
      body,
    }
    assert.ok(saveRootSchema.safeParse(root).success)
  })

  it('모르는 필드·형식 오류는 실패(strict)', () => {
    const snap = makeWorld().snapshot() as unknown as Record<string, Record<string, unknown>>
    assert.equal(saveBodySchema.safeParse({ ...snap, family: { ...snap.family, family_seed: 'XYZ' } }).success, false)
    assert.equal(saveBodySchema.safeParse({ ...snap, character: { ...snap.character, deep_returns: 1 } }).success, false)
    assert.equal(saveBodySchema.safeParse({ ...snap, pending_choice: undefined }).success, false)
  })

  it('플래그는 범위별 저장 위치만 받는다(16 §5.2: life. 인물, fam. 가문)', () => {
    const snap = makeWorld().snapshot() as unknown as Record<string, Record<string, unknown>>
    const withFlags = (who: 'character' | 'family', key: string) =>
      saveBodySchema.safeParse({ ...snap, [who]: { ...snap[who], flags: { [key]: true } } }).success
    assert.equal(withFlags('character', 'life.l08_repaired_D1'), true)
    assert.equal(withFlags('character', 'fam.f03_refused'), false)
    assert.equal(withFlags('family', 'fam.f03_refused'), true)
    assert.equal(withFlags('family', 'trip.fear'), false)
  })
})

describe('첫 인물 생성(05 §2, 01 §9.7, 12 §8.1)', () => {
  it('시작 소지품: 동전 30, CP01·CP06 2개, W01·A01 장착, 체력 가득', () => {
    const w = makeWorld()
    const s = w.state
    const ch = s.character!
    assert.equal(ch.coins, 30)
    assert.deepEqual(s.inventory.consumables, { CP01: 2, CP06: 2 })
    assert.equal(s.item_instances[s.inventory.equipped.weapon!]!.def_id, 'W01')
    assert.equal(s.item_instances[s.inventory.equipped.armor!]!.def_id, 'A01')
    assert.equal(ch.hp, maxHp(w))
    assert.equal(ch.level, 1)
    assert.equal(ch.location, 'T00') // 첫 마을
    assert.equal(ch.guild_rank, 'apprentice') // order가 가장 작은 등급
    assert.deepEqual(ch.attitude_log, [{ eff_min: 0, attitude: 'adventurous' }]) // balance.policy_defaults
  })

  it('출생 능력치 합 11, 출생 상한 4, 선천 특성 1~3개', () => {
    for (const seed of ['0000000000000001', '00000000000000a2', 'ffffffffffffffff', '9e3779b97f4a7c15']) {
      const ch = makeWorld(makeContent(), {}, seed).state.character!
      const vals = Object.values(ch.birth_stats)
      assert.equal(vals.reduce((a, b) => a + b, 0), 11, seed)
      assert.ok(vals.every((v) => v >= 1 && v <= 4))
      assert.ok(ch.traits.length >= 1 && ch.traits.length <= 3)
    }
  })

  it('출신 배경: 시작 숙련 1단계(사용 15), 해금 안 된 배경은 거부', () => {
    const ch = makeWorld(makeContent(), {}, undefined, 'bg_guild').state.character!
    assert.deepEqual(ch.skills.search, { uses: 15, rank: 1 })
    assert.ok(ch.birth_stats.kno >= 2)
    assert.throws(() => makeWorld(makeContent(), {}, undefined, 'bg_miner'), /해금되지 않았다/)
  })

  it('같은 시드면 같은 인물', () => {
    assert.deepEqual(makeWorld().snapshot(), makeWorld().snapshot())
  })

  it('출발 계절을 주지 않으면 life 흐름으로 뽑는다(01 §1.1)', () => {
    const make = (seed: string) => World.create(makeContent(), {
      familyName: '조약돌', familySeed: seed, foundedUtc: 1789500000000,
      character: { name: '모라', background: 'bg_river', appearance: APPEARANCE },
    }).state.character!.birth_season
    const seeds = ['0000000000000001', '00000000000000a2', 'ffffffffffffffff', SEED, '0123456789abcdef', 'fedcba9876543210']
    const got = seeds.map(make)
    assert.deepEqual(seeds.map(make), got) // 같은 시드면 같은 계절
    assert.ok(got.every((s) => SEASONS.includes(s)))
    assert.ok(new Set(got).size > 1)
  })
})

describe('uid 발급기', () => {
  it('종류별 일련번호와 자릿수(16 예시)', () => {
    const f = makeWorld().state.family
    f.next_uid = { ch: 2, it: 212, jr: 10452, sortie: 318 }
    assert.equal(issueUid(f, 'ch'), 'ch_0002')
    assert.equal(issueUid(f, 'it'), 'it_000212')
    assert.equal(issueUid(f, 'it'), 'it_000213')
    assert.equal(issueUid(f, 'sortie'), 'so_00318')
    assert.equal(issueJournalId(f), 10452)
    assert.equal(issueJournalId(f), 10453)
    assert.deepEqual(f.next_uid, { ch: 3, it: 214, jr: 10454, sortie: 319 })
  })
})
