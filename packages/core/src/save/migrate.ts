// 스키마 버전과 이전(13 §8.7). 앱은 v → v+1 이전 함수를 차례로 적용한다.
// 첫 검증판은 1이라 등록부는 비어 있다. 확장이 registerSaveMigration으로 더한다(골격만 둔다).
export const SAVE_SCHEMA_VERSION = 1

export type SaveMigration = (body: Record<string, unknown>) => Record<string, unknown>

const MIGRATIONS = new Map<number, SaveMigration>()

// from → from+1 한 칸을 등록한다
export function registerSaveMigration(from: number, fn: SaveMigration): void {
  if (MIGRATIONS.has(from)) throw new Error(`이전 함수 중복: v${from}`)
  MIGRATIONS.set(from, fn)
}

// from에서 to까지 한 칸도 빠지지 않는가(K3)
export function hasMigrationPath(from: number, to: number = SAVE_SCHEMA_VERSION): boolean {
  if (!Number.isInteger(from) || from < 1 || from > to) return false
  for (let v = from; v < to; v++) if (!MIGRATIONS.has(v)) return false
  return true
}

// 이전 직전 사본(pre_migration_v{N}.json)은 파일을 아는 쪽이 남긴다(13 §8.7)
export function migrateSaveBody(
  body: Record<string, unknown>,
  from: number,
  to: number = SAVE_SCHEMA_VERSION,
): { body: Record<string, unknown>; applied: number[] } {
  let cur = body
  const applied: number[] = []
  for (let v = from; v < to; v++) {
    const fn = MIGRATIONS.get(v)
    if (!fn) throw new Error(`이전 함수가 없다: v${v} → v${v + 1}`)
    cur = fn(cur)
    applied.push(v)
  }
  return { body: cur, applied }
}
