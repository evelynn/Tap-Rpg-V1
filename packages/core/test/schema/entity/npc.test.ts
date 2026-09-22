import { assertIssue, assertValid, edit } from './setup'
import { describe, it } from 'node:test'
import { namePoolSchema, npcSchema } from '../../../src/schema/entity/index'

// 16 §2.8 N05 예시: facility null 생략, note → _note(DS-03), descendant_reactions 뺌(DS-10)
const N05 = {
  id: 'N05', name: '세나', role: '실종 광부 도한의 딸', home: 'T00',
  portrait_id: 'npc_sena',
  speech: { style: '해요체, 짧게 끊어 말한다', samples: ['아버지 지도예요. 끝이 찢겼어요.', '다리가 무너진 곳까지는 갔대요.'] },
  events: ['C01-2', 'C01-3'],
  successors: [{ from_generation: 3, name: '도윤', _note: '2대에는 세나와 도윤이 함께 등장(12 §7.6)' }],
  relation_default: 0,
}

describe('npc', () => {
  it('N05 통과, 시설 담당 NPC 통과', () => {
    assertValid(npcSchema, N05)
    assertValid(npcSchema, edit(N05, { id: 'N01', facility: 'smithy', successors: undefined }))
  })
  it('descendant_reactions는 종류로 옮겼으므로 실패', () => {
    assertIssue(npcSchema, edit(N05, { descendant_reactions: [] }), '')
  })
  it('successors의 note는 _note로(DS-03)', () => {
    assertIssue(npcSchema, edit(N05, { successors: [{ from_generation: 3, name: '도윤', note: 'x' }] }), 'successors.0')
  })
  it('relation_default는 −100~100 정수', () => {
    assertIssue(npcSchema, edit(N05, { relation_default: 150 }), 'relation_default')
    assertIssue(npcSchema, edit(N05, { relation_default: 0.5 }), 'relation_default')
  })
  it('home·events는 ID 형식', () => {
    assertIssue(npcSchema, edit(N05, { home: '도토리 여울' }), 'home')
    assertIssue(npcSchema, edit(N05, { events: ['C01 2'] }), 'events.0')
  })
})

describe('name_pool', () => {
  const pool = { id: 'base_names', given_names: ['모라', '리아', '아린'], family_names: ['조약돌', '여울빛'] }
  it('통과, partner_jobs 선택', () => {
    assertValid(namePoolSchema, pool)
    assertValid(namePoolSchema, edit(pool, { partner_jobs: ['약초꾼', '뱃사공'] }))
  })
  it('family_names 누락·옛 name_rules는 실패', () => {
    assertIssue(namePoolSchema, edit(pool, { family_names: undefined }), 'family_names')
    assertIssue(namePoolSchema, edit(pool, { name_rules: {} }), '')
  })
})
