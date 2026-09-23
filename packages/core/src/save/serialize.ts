// 저장 루트 만들기와 직렬화(13 §8.2, 16 §5.1). 파일 쓰기는 tools 쪽 어댑터가 한다.
import type { SaveBody, SaveRoot } from '../state/save'
import { canonicalJson } from './canonical'
import { bodyChecksum } from './checksum'
import { SAVE_SCHEMA_VERSION } from './migrate'

// 저장 시각·앱 버전·콘텐츠 머리(C1)는 밖에서 받는다. 코어는 시계를 읽지 않는다(I19)
export interface SaveMeta {
  app_version: string
  saved_at_utc: number
  content_packs: { id: string; version: string }[]
  content_hash: string
}

export function makeSaveRoot(body: SaveBody, meta: SaveMeta): SaveRoot {
  return {
    header: {
      schema_version: SAVE_SCHEMA_VERSION,
      app_version: meta.app_version,
      saved_at_utc: meta.saved_at_utc,
      checksum: bodyChecksum(body),
      encoding: 'json',
      content_packs: meta.content_packs,
      content_hash: meta.content_hash,
    },
    body,
  }
}

// 같은 상태면 항상 같은 바이트다
export function serializeSave(root: SaveRoot): string {
  return canonicalJson(root)
}
