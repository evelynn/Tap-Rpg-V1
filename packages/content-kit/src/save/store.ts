// 저장 파일 입출력(13 §8.2·§8.4·§8.5). 원자적 교체, 백업 3개 순환, 손상 파일 보관, 복구 순서.
// 코어는 파일을 모르므로 직렬화·검사는 코어가 하고 이 파일은 바이트만 다룬다.
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import { loadSave, serializeSave, type Content, type FatalCode, type LoadOk, type SaveRoot } from '../core'
import {
  at, backupFile, BACKUP_MIN_GAP_MS, backupPaths, CORRUPT_DIR, CORRUPT_KEEP, preMigrationFile, SAVE_FILE, TMP_FILE,
  type SaveDir,
} from './paths'

// ── 쓰기 ──

function writeSynced(path: string, text: string): void {
  const fd = openSync(path, 'w')
  try {
    writeSync(fd, text)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
}

const mtimeOf = (path: string): number => (existsSync(path) ? statSync(path).mtimeMs : 0)

// 백업 순환(13 §8.2 4): backup_2 → backup_3, backup_1 → backup_2, save.json → backup_1
function rotate(dir: SaveDir): void {
  const names = backupPaths(dir)
  for (let i = names.length - 1; i > 0; i--) {
    const from = at(dir, names[i - 1]!)
    if (existsSync(from)) renameSync(from, at(dir, names[i]!))
  }
  const save = at(dir, SAVE_FILE)
  if (names.length > 0 && existsSync(save)) renameSync(save, at(dir, names[0]!))
}

export interface WriteOptions {
  now: number // 현재 실제 시각(UTC 밀리초)
  backup?: boolean // 13 §8.1의 `예` 시점인가
  force_backup?: boolean // 생애 종료·계승은 10분 조건 없이 항상 백업한다
}

// 13 §8.2 순서 그대로: 직렬화 → 임시 파일 쓰기·플러시 → (백업 순환) → 원자적 교체
export function writeSave(dir: SaveDir, root: SaveRoot, opts: WriteOptions): void {
  mkdirSync(dir.root, { recursive: true })
  const tmp = at(dir, TMP_FILE)
  writeSynced(tmp, serializeSave(root))
  if (opts.backup && (opts.force_backup || opts.now - mtimeOf(at(dir, backupFile(1))) >= BACKUP_MIN_GAP_MS)) rotate(dir)
  // Windows에서 rename은 MoveFileEx(MOVEFILE_REPLACE_EXISTING)라 원자적으로 덮어쓴다. 실패하면 save.json은 그대로 남는다
  renameSync(tmp, at(dir, SAVE_FILE))
}

// ── 읽기 ──

interface Candidate {
  file: string
  text: string
  ok: LoadOk | null
  code: FatalCode | null
  message: string
}

function tryRead(dir: SaveDir, file: string, content: Content): Candidate | null {
  const path = at(dir, file)
  if (!existsSync(path)) return null
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (e) {
    return { file, text: '', ok: null, code: 'K1', message: `읽을 수 없다: ${(e as Error).message}` }
  }
  const r = loadSave(text, content)
  return r.ok
    ? { file, text, ok: r, code: null, message: '' }
    : { file, text, ok: null, code: r.code, message: r.message }
}

export interface ReadOk {
  ok: true
  file: string // 실제로 쓴 파일
  recovered: boolean // 백업으로 복구했는가(복귀 요약 머리에 알린다, 13 §8.5)
  result: LoadOk
  failed: { file: string; code: FatalCode; message: string }[]
}

export interface ReadFail {
  ok: false
  failed: { file: string; code: FatalCode; message: string }[]
  quarantined: string[] // corrupt\로 옮긴 파일
}

export type ReadResult = ReadOk | ReadFail

// 13 §8.5 복구 절차. 모두 실패하면 손상 파일을 corrupt\로 옮긴다
export function readSave(dir: SaveDir, content: Content, now: number): ReadResult {
  const names = [SAVE_FILE, TMP_FILE, ...backupPaths(dir)]
  const cands = names.map((n) => tryRead(dir, n, content)).filter((c): c is Candidate => c !== null)
  const failed = cands.filter((c) => c.code !== null).map((c) => ({ file: c.file, code: c.code!, message: c.message }))

  const save = cands.find((c) => c.file === SAVE_FILE)
  const tmp = cands.find((c) => c.file === TMP_FILE)
  // 2. 교체 직전에 종료된 경우: tmp가 정상이고 save.json보다 늦으면 tmp를 쓴다
  const tmpWins = tmp?.ok && (!save?.ok || tmp.ok.root.header.saved_at_utc > save.ok.root.header.saved_at_utc)
  const chosen = tmpWins ? tmp : (save?.ok ? save : cands.find((c) => c.ok !== null))

  if (!chosen?.ok) {
    return { ok: false, failed, quarantined: quarantine(dir, cands.map((c) => c.file), now) }
  }

  // 백업으로 복구한 뒤에도 같은 구간을 두 번 정산하지 않게, 읽을 수 있었던 파일 중 가장 늦은 high_water를 쓴다
  const hw = Math.max(...cands.filter((c) => c.ok).map((c) => c.ok!.root.body.offline_state.high_water_utc))
  if (hw > chosen.ok.root.body.offline_state.high_water_utc) chosen.ok.root.body.offline_state.high_water_utc = hw

  // 이전을 적용했으면 원본 사본을 남긴다(13 §8.7). 아직 아무것도 덮어쓰지 않은 시점이다
  for (const v of chosen.ok.migrated) writeSynced(at(dir, preMigrationFile(v)), chosen.text)

  return { ok: true, file: chosen.file, recovered: chosen.file.startsWith('backup_'), result: chosen.ok, failed }
}

// 손상 파일을 corrupt\{UTC시각}_{원래이름}으로 옮기고 최대 5개만 남긴다(13 §8.4)
export function quarantine(dir: SaveDir, files: readonly string[], now: number): string[] {
  if (files.length === 0) return []
  const box = at(dir, CORRUPT_DIR)
  mkdirSync(box, { recursive: true })
  const stamp = new Date(now).toISOString().replace(/[:.]/g, '')
  const moved: string[] = []
  for (const f of files) {
    const from = at(dir, f)
    if (!existsSync(from)) continue
    const name = `${stamp}_${f}`
    renameSync(from, join(box, name))
    moved.push(name)
  }
  const kept = readdirSync(box).sort()
  for (const old of kept.slice(0, Math.max(0, kept.length - CORRUPT_KEEP))) rmSync(join(box, old), { force: true })
  return moved
}
