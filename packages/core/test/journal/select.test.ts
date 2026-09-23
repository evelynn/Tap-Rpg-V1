// 연대기 주요 기록 선별(12 §7.1 후보, 18 §2.3 제외, 18 §4.1 점수·동률)
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { chronicleMajor, type ChronicleEntry } from '../../src/index'

let id = 0
const e = (tag: ChronicleEntry['tag'], over: Partial<ChronicleEntry> = {}): ChronicleEntry => {
  id += 1
  return { id, eff_min: id, char_uid: 'c1', importance: 'major', tag, ...over }
}
const opts = { relicUids: ['it_9'], eventCategory: (ev: string) => (ev.startsWith('F') ? 'fate' : ev.startsWith('C') ? 'chain' : 'life'), clamp: [4, 6] as const, scoreGte: 5 }
const ids = (list: readonly ChronicleEntry[]) => list.map((x) => x.id)

describe('연대기 주요 기록(12 §7.1)', () => {
  it('안내([중요]인데 사건이 아님)·결과가 뒤따르는 제시 기록·일상 태그는 후보가 아니다', () => {
    const notice = e('important')
    const hold = e('important', { refs: { event_id: 'L05' } })
    const result = e('town', { refs: { event_id: 'L05' }, importance: 'daily' })
    const travel = e('travel')
    const policy = e('important', { refs: { event_id: 'L07' } }) // 결과가 따로 없는 사전 방침 처리
    const got = chronicleMajor([notice, hold, result, travel, policy], 'c1', opts)
    assert.deepEqual(ids(got), [policy.id])
  })

  it('운명 사건 결과·유품 획득·특성 획득·[발견] 첫 기록은 후보이고, 묶음·[가문]·[은퇴]는 아니다', () => {
    const fate = e('check', { refs: { event_id: 'F02' } })
    const relic = e('gear', { refs: { item_uid: 'it_9' } })
    const gear = e('gear', { refs: { item_uid: 'it_1' } })
    const trait = e('trait', { sub: 'trait_gain' })
    const disc1 = e('discovery')
    const disc2 = e('discovery')
    const bundle = e('hunt', { bundle_count: 10 })
    const house = e('house', { importance: 'family' })
    const retire = e('retire', { importance: 'family' })
    const got = chronicleMajor([fate, relic, gear, trait, disc1, disc2, bundle, house, retire], 'c1', opts)
    assert.deepEqual(ids(got), [fate.id, relic.id, trait.id, disc1.id])
  })

  it('점수 5 이상이 6개를 넘으면 6개에서 자르고, 동률은 이른 기록이 앞선다(18 §4.1)', () => {
    const bonds = Array.from({ length: 8 }, () => e('bond'))
    const got = chronicleMajor(bonds, 'c1', opts)
    assert.deepEqual(ids(got), ids(bonds.slice(0, 6)))
  })

  it('큰따옴표 인용(+2)·첫 기록(+3)이 점수를 올린다', () => {
    const plain = Array.from({ length: 5 }, (_, i) => e('important', { refs: { event_id: `L1${i}` } }))
    const quoted = e('important', { refs: { event_id: 'L20' }, detail: '세나가 말했다. "고마워요."' })
    const got = chronicleMajor([...plain, quoted], 'c1', opts)
    // 점수: 첫 [중요] 4, 인용 3, 나머지 1 → 5 이상 0개라 4개를 고른다
    assert.deepEqual(ids(got), [plain[0]!.id, plain[1]!.id, plain[2]!.id, quoted.id])
  })
})
