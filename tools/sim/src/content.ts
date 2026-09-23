// 팩 경로 → 번들 → Content. 코어는 파일 시스템을 모르고 번들만 읽는다(ARCHITECTURE §2).
import { Content } from '@tap/core'
import { formatIssue, validateContent } from '@tap/content-kit'

export interface LoadedContent {
  content: Content
  contentHash: string // 번들 content_hash(같은 데이터면 같은 값)
  packs: string // "base@0.1.0" 형식 목록
}

// 팩 검증이 무거워 같은 경로 묶음은 한 번만 읽는다(CLI는 한 번, 테스트는 여러 번 부른다)
const cache = new Map<string, LoadedContent>()

export function loadContent(paths: readonly string[]): LoadedContent {
  const key = paths.join('\u0000')
  const hit = cache.get(key)
  if (hit) return hit
  const { bundle, issues } = validateContent(paths)
  if (!bundle) throw new Error(['콘텐츠 검증 실패:', ...issues.map(formatIssue)].join('\n'))
  const loaded: LoadedContent = {
    content: Content.fromBundle(bundle),
    contentHash: bundle.content_hash,
    packs: bundle.packs.map((p) => `${p.id}@${p.version}`).join(', '),
  }
  cache.set(key, loaded)
  return loaded
}
