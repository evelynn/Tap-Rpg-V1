// 저장 파일 고르기(13 §8.5 복구 절차). 파일 입출력 없이 이름·글만 받아 어느 파일로 이어 갈지 정한다.
// 파일을 읽고 쓰는 쪽(content-kit save/store, 데스크톱 창)이 같은 규칙을 쓰도록 여기에 둔다.
import type { Content } from '../content/index'
import { loadSave, type FatalCode, type LoadOk } from './load'

export const SAVE_FILE = 'save.json'
export const TMP_FILE = 'save.json.tmp'
export const backupFile = (n: number): string => `backup_${n}.json`
export const preMigrationFile = (v: number): string => `pre_migration_v${v}.json`
export const BACKUP_MIN_GAP_MS = 10 * 60 * 1000 // 백업 순환 최소 간격(13 §8.1)
export const CORRUPT_KEEP = 5 // corrupt\에 남기는 손상 파일 수(13 §8.4)

export interface SaveFile { file: string; text: string }
export interface SaveFailure { file: string; code: FatalCode; message: string }

export interface PickOk {
  ok: true
  file: string // 실제로 쓴 파일
  recovered: boolean // 백업으로 복구했는가(복귀 요약 머리에 알린다, 13 §8.5)
  result: LoadOk
  failed: SaveFailure[]
  preMigration: { file: string; text: string }[] // 이전을 적용했으면 남길 원본 사본(13 §8.7)
}
export interface PickFail { ok: false; failed: SaveFailure[]; files: string[] } // files: 손상으로 옮길 파일
export type PickResult = PickOk | PickFail

// files: 있는 파일만(순서 무관). 이름은 SAVE_FILE·TMP_FILE·backup_n
export function pickSave(files: readonly SaveFile[], content: Content): PickResult {
  const order = (f: string): number => (f === SAVE_FILE ? 0 : f === TMP_FILE ? 1 : 2 + Number(f.replace(/\D/g, '') || 99))
  const cands = [...files].sort((a, b) => order(a.file) - order(b.file)).map((f) => {
    const r = loadSave(f.text, content)
    return r.ok ? { ...f, ok: r, fail: null } : { ...f, ok: null, fail: { file: f.file, code: r.code, message: r.message } }
  })
  const failed = cands.flatMap((c) => (c.fail ? [c.fail] : []))
  const save = cands.find((c) => c.file === SAVE_FILE)
  const tmp = cands.find((c) => c.file === TMP_FILE)
  // 교체 직전에 꺼진 경우: tmp가 정상이고 save.json보다 늦으면 tmp를 쓴다
  const tmpWins = tmp?.ok && (!save?.ok || tmp.ok.root.header.saved_at_utc > save.ok.root.header.saved_at_utc)
  const chosen = tmpWins ? tmp : save?.ok ? save : cands.find((c) => c.ok !== null)
  if (!chosen?.ok) return { ok: false, failed, files: cands.map((c) => c.file) }
  // 백업으로 복구한 뒤에도 같은 구간을 두 번 정산하지 않게, 읽을 수 있었던 파일 중 가장 늦은 high_water를 쓴다
  const hw = Math.max(...cands.filter((c) => c.ok).map((c) => c.ok!.root.body.offline_state.high_water_utc))
  if (hw > chosen.ok.root.body.offline_state.high_water_utc) chosen.ok.root.body.offline_state.high_water_utc = hw
  return {
    ok: true, file: chosen.file, recovered: chosen.file.startsWith('backup_'), result: chosen.ok, failed,
    preMigration: chosen.ok.migrated.map((v) => ({ file: preMigrationFile(v), text: chosen.text })),
  }
}
