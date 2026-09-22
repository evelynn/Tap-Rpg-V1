// 콘텐츠 조회기: 검증된 번들(CONTENT_SCHEMA §2.4)의 defs를 종류·ID로 찾는다. 코어 규칙은 모두 이것으로 콘텐츠를 읽는다.
// 번들 defs는 기본값을 채우지 않은 원본(I11)이라, 만들 때 종류 스키마로 한 번 파싱해 기본값을 채운다.
import type { z } from 'zod'
import {
  achievementSchema, attitudeSchema, backgroundSchema, balanceSchema, chainSchema, consumableSchema,
  descendantReactionSchema, enemyFamilySchema, enemySchema, epithetSchema, eventSchema, flagDefSchema,
  guildRankSchema, itemEffectSchema, itemSchema, materialSchema, namePoolSchema, npcSchema, propSchema,
  regionSchema, retireRoleSchema, textSchema, trapSchema, traitSchema,
  CONTENT_KIND_NAMES, type ContentKind,
} from '../schema/index'

// 코어가 읽을 수 있는 번들 형식 번호. content-kit BUNDLE_FORMAT이 이 값을 쓴다. 번들 모양을 호환되지 않게 바꿀 때만 올린다
export const CONTENT_BUNDLE_FORMAT = 1

export const CONTENT_SCHEMAS = {
  balance: balanceSchema,
  attitude: attitudeSchema,
  region: regionSchema,
  enemy_family: enemyFamilySchema,
  enemy: enemySchema,
  material: materialSchema,
  trap: trapSchema,
  guild_rank: guildRankSchema,
  item: itemSchema,
  item_effect: itemEffectSchema,
  consumable: consumableSchema,
  trait: traitSchema,
  npc: npcSchema,
  name_pool: namePoolSchema,
  background: backgroundSchema,
  achievement: achievementSchema,
  epithet: epithetSchema,
  retire_role: retireRoleSchema,
  descendant_reaction: descendantReactionSchema,
  prop: propSchema,
  flag: flagDefSchema,
  chain: chainSchema,
  event: eventSchema,
  text: textSchema,
} satisfies Record<ContentKind, z.ZodType>

export type ContentDef<K extends ContentKind> = z.output<(typeof CONTENT_SCHEMAS)[K]>
export type RawDefs = Partial<Record<ContentKind, Record<string, unknown>>>

export class Content {
  private readonly defs = new Map<ContentKind, Map<string, unknown>>()

  // defs: 번들의 defs(종류 → id → 정의). 스키마 위반이면 예외(검증기를 거친 번들이면 일어나지 않는다)
  constructor(defs: RawDefs) {
    for (const kind of CONTENT_KIND_NAMES) {
      const byId = new Map<string, unknown>()
      for (const [id, raw] of Object.entries(defs[kind] ?? {})) {
        const r = CONTENT_SCHEMAS[kind].safeParse(raw)
        if (!r.success) throw new Error(`콘텐츠 ${kind} '${id}' 스키마 위반: ${r.error.message}`)
        byId.set(id, r.data)
      }
      this.defs.set(kind, byId)
    }
  }

  static fromBundle(bundle: { format: number; defs: RawDefs }): Content {
    if (bundle.format !== CONTENT_BUNDLE_FORMAT) throw new Error(`번들 형식 ${bundle.format}을 읽을 수 없다(코어 ${CONTENT_BUNDLE_FORMAT})`)
    return new Content(bundle.defs)
  }

  // 없으면 예외
  get<K extends ContentKind>(kind: K, id: string): ContentDef<K> {
    const d = this.defs.get(kind)!.get(id)
    if (d === undefined) throw new Error(`콘텐츠 ${kind} '${id}'가 없다`)
    return d as ContentDef<K>
  }

  has(kind: ContentKind, id: string): boolean {
    return this.defs.get(kind)!.has(id)
  }

  // 번들 순서(팩 로드 순서)
  list<K extends ContentKind>(kind: K): ContentDef<K>[] {
    return [...this.defs.get(kind)!.values()] as ContentDef<K>[]
  }

  get balance(): ContentDef<'balance'> {
    return this.get('balance', 'balance')
  }
}
