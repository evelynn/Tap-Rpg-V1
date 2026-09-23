// 저장 파일 어댑터(Node). 직렬화·검사는 코어(@tap/core save)가 하고 여기서는 파일만 다룬다.
export {
  SAVE_FILE, TMP_FILE, CORRUPT_DIR, LOG_DIR, BACKUP_MIN_GAP_MS, CORRUPT_KEEP, LOG_KEEP_DAYS,
  backupFile, backupPaths, preMigrationFile, at, type SaveDir,
} from './paths'
export { type WriteOptions, type ReadOk, type ReadFail, type ReadResult, writeSave, readSave, quarantine } from './store'
export { appendDiagnostics, pruneDiagnostics } from './log'
