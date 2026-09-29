// 저장·이어하기(13 §8, 03 §9). 파일은 데스크톱 창(Tauri 명령)이, 검사·고르기는 코어(pickSave·loadSave)가 한다.
// 브라우저 시제품은 같은 규칙을 localStorage로 흉내 낸다.
import {
  BACKUP_MIN_GAP_MS, SAVE_FILE, TMP_FILE, backupFile, loadGameWorld, makeSaveRoot, pickSave, runOffline, serializeSave,
  type Content, type ReturnSummary, type SaveFile, type SaveMeta, type World,
} from '@tap/core'

export interface SaveBackend {
  readAll(backups: number): Promise<SaveFile[]>
  write(text: string, backup: boolean, force: boolean, backups: number): Promise<void>
  extra(file: string, text: string): Promise<void>
  quarantine(files: string[], stamp: string): Promise<string[]>
  readSettings(): Promise<string | null>
  writeSettings(text: string): Promise<void>
  openFolder(): Promise<void>
}

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
export const tauriInvoke = (): Invoke | null =>
  (globalThis as { __TAURI__?: { core?: { invoke?: Invoke } } }).__TAURI__?.core?.invoke ?? null

export function tauriBackend(invoke: Invoke): SaveBackend {
  return {
    readAll: async (backups) => ((await invoke('save_read_all', { backups })) as [string, string][]).map(([file, text]) => ({ file, text })),
    write: async (text, backup, force, backups) => { await invoke('save_write', { text, backupDue: backup, forceBackup: force, backups }) },
    extra: async (file, text) => { await invoke('save_extra', { file, text }) },
    quarantine: async (files, stamp) => (await invoke('save_quarantine', { files, stamp })) as string[],
    readSettings: async () => ((await invoke('settings_read')) as string | null) ?? null,
    writeSettings: async (text) => { await invoke('settings_write', { text }) },
    openFolder: async () => { await invoke('save_open_folder') },
  }
}

// localStorage 흉내(키 tap.save/<파일>). 백업 순환·10분 간격 규칙은 데스크톱과 같다
export function localBackend(store: Storage | null = safeStorage()): SaveBackend {
  const k = (f: string) => `tap.save/${f}`
  const get = (f: string) => { try { return store?.getItem(k(f)) ?? null } catch { return null } }
  const set = (f: string, v: string | null) => {
    try {
      if (v === null) store?.removeItem(k(f))
      else store?.setItem(k(f), v)
    } catch { /* 저장소를 못 쓰면 이번 실행만 */ }
  }
  return {
    readAll: async (backups) => [SAVE_FILE, TMP_FILE, ...Array.from({ length: backups }, (_, i) => backupFile(i + 1))]
      .flatMap((file) => { const text = get(file); return text === null ? [] : [{ file, text }] }),
    write: async (text, backup, force, backups) => {
      const at = Number(get('backup_at') ?? 0)
      if (backup && backups > 0 && (force || Date.now() - at >= BACKUP_MIN_GAP_MS)) {
        for (let i = backups - 1; i > 0; i--) set(backupFile(i + 1), get(backupFile(i)))
        set(backupFile(1), get(SAVE_FILE))
        set('backup_at', String(Date.now()))
      }
      set(SAVE_FILE, text)
    },
    extra: async (file, text) => set(file, text),
    quarantine: async (files) => { for (const f of files) set(f, null); return files },
    readSettings: async () => { try { return store?.getItem('tap.settings') ?? null } catch { return null } },
    writeSettings: async (text) => { try { store?.setItem('tap.settings', text) } catch { /* 이번 실행만 */ } },
    openFolder: async () => {},
  }
}

function safeStorage(): Storage | null {
  try { return globalThis.localStorage ?? null } catch { return null }
}

export type Loaded =
  | { kind: 'none' } // 저장 없음 → 첫 실행
  | { kind: 'fail'; message: string } // 모두 읽을 수 없음(13 §8.5)
  | { kind: 'blocked'; message: string } // 더 새로운 버전의 기록인데 이 버전이 열지 못함: 새 가문도 만들지 않는다(덮어쓰지 않게, 13 §8.7)
  | { kind: 'ok'; world: World; savedAt: number; recovered: boolean; readOnly: boolean; summary: ReturnSummary | null; offlineFailed: boolean }

// 시작: 파일 고르기 → 세계 → 부재 정산(13 §2). 정산 중 예외면 같은 저장으로 다시 읽어 정산 없이 시작한다(13 §2.3)
export async function loadGame(backend: SaveBackend, content: Content, now: number): Promise<Loaded> {
  const backups = content.balance.offline.backups
  const files = await backend.readAll(backups)
  if (!files.length) return { kind: 'none' }
  const r = pickSave(files, content)
  if (!r.ok) {
    await backend.quarantine(r.files, new Date(now).toISOString().replace(/[:.]/g, ''))
    return { kind: 'fail', message: '저장 기록을 읽을 수 없습니다. 손상된 파일은 따로 옮겨 두었습니다.' }
  }
  for (const m of r.preMigration) await backend.extra(m.file, m.text)
  const body = r.result.root.body
  const savedAt = r.result.root.header.saved_at_utc
  const pristine = JSON.stringify(body)
  let world: World
  try {
    world = loadGameWorld(content, body)
  } catch (e) {
    console.error('[텝] 저장으로 세계를 만들지 못했다', e)
    if (r.result.read_only) return { kind: 'blocked', message: '더 새로운 버전에서 만든 기록이라 이 버전에서는 열 수 없습니다. 기록은 그대로 두었습니다. 새 버전으로 실행해 주세요.' }
    await backend.quarantine(files.map((f) => f.file), new Date(now).toISOString().replace(/[:.]/g, ''))
    return { kind: 'fail', message: '저장 기록을 열 수 없습니다. 손상된 파일은 따로 옮겨 두었습니다.' }
  }
  let summary: ReturnSummary | null = null
  let offlineFailed = false
  if (!r.result.read_only) {
    try {
      summary = runOffline(world, { now_utc: now, saved_at_utc: savedAt }).summary
    } catch (e) {
      console.error('[텝] 부재 정산 실패 — 정산 없이 시작한다', e)
      world = loadGameWorld(content, JSON.parse(pristine))
      offlineFailed = true
    }
  }
  return { kind: 'ok', world, savedAt, recovered: r.recovered, readOnly: r.result.read_only, summary, offlineFailed }
}

// 저장 요청 줄(13 §8.2): 한 번에 한 쓰기, 쓰는 동안 들어온 요청은 가장 새 것 하나만 남긴다
export class Saver {
  private busy = false
  private next: { backup: boolean; force: boolean } | null = null
  private lastWrite = 0
  readOnly = false

  constructor(private readonly backend: SaveBackend, private readonly world: () => World | null, private readonly meta: () => SaveMeta) {}

  // backup: 13 §8.1 `예` 시점, force: 생애 종료·계승(10분 조건 없이)
  request(opts: { backup?: boolean; force?: boolean } = {}): Promise<void> {
    const want = { backup: !!opts.backup || !!this.next?.backup, force: !!opts.force || !!this.next?.force }
    this.next = want
    return this.pump()
  }

  // 잦은 행동 적용 저장은 2초에 한 번까지(백업 시점은 바로). 마지막 쓰기와 같은 벽시계로 잰다
  requestThrottled(now: number = Date.now()): void {
    if (now - this.lastWrite >= 2000) void this.request()
  }

  private async pump(): Promise<void> {
    if (this.busy || this.readOnly) return
    const w = this.world()
    if (!w || !this.next) return
    this.busy = true
    const job = this.next
    this.next = null
    try {
      const root = makeSaveRoot(w.snapshot(), this.meta())
      await this.backend.write(serializeSave(root), job.backup, job.force, w.content.balance.offline.backups)
      this.lastWrite = Date.now()
    } catch (e) {
      console.error('[텝] 저장 실패', e)
    } finally {
      this.busy = false
    }
    if (this.next) await this.pump()
  }

  // 종료 전: 쓰는 중이면 끝날 때까지 기다리고 마지막으로 한 번 더 쓴다
  async flush(): Promise<void> {
    while (this.busy) await new Promise((r) => setTimeout(r, 20))
    await this.request()
    while (this.busy) await new Promise((r) => setTimeout(r, 20))
  }
}
