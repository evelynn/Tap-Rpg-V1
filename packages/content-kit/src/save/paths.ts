// 저장 폴더 구성(13 §8.4·§8.6). 경로 이름의 단일 출처.
import { join } from 'node:path'

export const SAVE_FILE = 'save.json'
export const TMP_FILE = 'save.json.tmp'
export const CORRUPT_DIR = 'corrupt'
export const LOG_DIR = 'logs'

export const backupFile = (n: number): string => `backup_${n}.json`
export const preMigrationFile = (v: number): string => `pre_migration_v${v}.json`

// 13 "이 문서가 새로 정한 값"
export const BACKUP_MIN_GAP_MS = 10 * 60 * 1000
export const CORRUPT_KEEP = 5
export const LOG_KEEP_DAYS = 7

export interface SaveDir {
  root: string // %APPDATA%\Tap\save 에 해당하는 폴더
  backups: number // 백업 개수(balance.offline.backups)
}

export const at = (dir: SaveDir, name: string): string => join(dir.root, name)
export const backupPaths = (dir: SaveDir): string[] =>
  Array.from({ length: dir.backups }, (_, i) => backupFile(i + 1))
