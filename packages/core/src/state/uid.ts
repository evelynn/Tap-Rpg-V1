// uid 발급기: family.next_uid의 종류별 일련번호를 쓰고 1 올린다(16 §5.3). 자릿수는 16 예시를 따른다.
import type { Family } from './family'

const FORMATS = { ch: ['ch', 4], it: ['it', 6], sortie: ['so', 5] } as const
export type UidKind = keyof typeof FORMATS

export function issueUid(family: Family, kind: UidKind): string {
  const [prefix, width] = FORMATS[kind]
  const n = family.next_uid[kind]
  family.next_uid[kind] = n + 1
  return `${prefix}_${String(n).padStart(width, '0')}`
}

// 일지 id는 가문 전체 정수 일련번호
export function issueJournalId(family: Family): number {
  return family.next_uid.jr++
}
