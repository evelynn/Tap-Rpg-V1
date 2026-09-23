// 저장·불러오기(13 §8, 16 §5.1·§7.1): 정규 JSON·체크섬·스키마 버전과 이전·로드 검사.
// 파일 입출력(원자적 쓰기·백업·복구)은 Node 어댑터(@tap/content-kit save)가 한다.
export { canonicalJson } from './canonical'
export { bodyChecksum, toHex } from './checksum'
export {
  SAVE_SCHEMA_VERSION, type SaveMigration, registerSaveMigration, hasMigrationPath, migrateSaveBody,
} from './migrate'
export { type SaveMeta, makeSaveRoot, serializeSave } from './serialize'
export { REPAIR_CODES, type RepairCode, type SaveDiagnostic, repairSave } from './repair'
export { FATAL_CODES, type FatalCode, type LoadOk, type LoadFail, type LoadResult, loadSave } from './load'
