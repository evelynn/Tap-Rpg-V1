// 저장 폴더 구성(13 §8.4·§8.6). 경로 이름의 단일 출처.
import { join } from 'node:path'

// 파일 이름·간격은 코어(save/pick)가 단일 출처다(데스크톱 창과 같은 규칙)
export { BACKUP_MIN_GAP_MS, CORRUPT_KEEP, SAVE_FILE, TMP_FILE, backupFile, preMigrationFile } from '../core'
import { backupFile } from '../core'
export const CORRUPT_DIR = 'corrupt'
export const LOG_DIR = 'logs'

// 13 "이 문서가 새로 정한 값"
export const LOG_KEEP_DAYS = 7

export interface SaveDir {
  root: string // %APPDATA%\Tap\save 에 해당하는 폴더
  backups: number // 백업 개수(balance.offline.backups)
}

export const at = (dir: SaveDir, name: string): string => join(dir.root, name)
export const backupPaths = (dir: SaveDir): string[] =>
  Array.from({ length: dir.backups }, (_, i) => backupFile(i + 1))
