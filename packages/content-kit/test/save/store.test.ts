// 저장 파일 어댑터(13 §8.2·§8.4·§8.5·§8.6): 원자적 교체, 백업 순환, 손상 감지와 복구 순서, 진단 로그.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeSaveRoot, type SaveBody, type SaveRoot } from '@tap/core'
import {
  appendDiagnostics, at, backupFile, BACKUP_MIN_GAP_MS, pruneDiagnostics, readSave, SAVE_FILE, TMP_FILE, writeSave,
  type SaveDir,
} from '../../src/save/index'
import { baseContent, newSaveBody } from './fixture'

const NOW = Date.now()
const meta = (savedAt: number) => ({
  app_version: '0.1.0',
  saved_at_utc: savedAt,
  content_packs: [{ id: 'base', version: '0.1.0' }],
  content_hash: 'abc',
})

function tempDir(): SaveDir {
  const root = mkdtempSync(join(tmpdir(), 'tap-save-'))
  return { root, backups: 3 }
}

// 체크섬은 body에서 나오므로 본문은 makeSaveRoot 전에 고친다
const rootOf = (savedAt: number, familyName?: string, edit?: (b: SaveBody) => void): SaveRoot => {
  const body = newSaveBody()
  if (familyName) body.family.name = familyName
  edit?.(body)
  return makeSaveRoot(body, meta(savedAt))
}

describe('원자적 쓰기와 백업 순환(13 §8.2)', () => {
  it('임시 파일을 남기지 않고 save.json을 만든다', () => {
    const dir = tempDir()
    try {
      writeSave(dir, rootOf(NOW), { now: NOW })
      assert.ok(existsSync(at(dir, SAVE_FILE)))
      assert.equal(existsSync(at(dir, TMP_FILE)), false)
      assert.equal(existsSync(at(dir, backupFile(1))), false, '백업 시점이 아니면 백업하지 않는다')
    } finally {
      rmSync(dir.root, { recursive: true, force: true })
    }
  })

  it('백업 시점에만, 직전 백업 후 10분이 지났을 때만 순환한다', () => {
    const dir = tempDir()
    try {
      writeSave(dir, rootOf(NOW, '일대'), { now: NOW })
      // 첫 백업: 아직 백업이 없으므로 바로 순환한다
      writeSave(dir, rootOf(NOW + 1, '이대'), { now: NOW + 1, backup: true })
      assert.ok(existsSync(at(dir, backupFile(1))))
      assert.match(readFileSync(at(dir, backupFile(1)), 'utf8'), /일대/)

      // 10분이 지나지 않았으면 순환하지 않는다
      writeSave(dir, rootOf(NOW + 2, '삼대'), { now: NOW + 2, backup: true })
      assert.match(readFileSync(at(dir, backupFile(1)), 'utf8'), /일대/)
      assert.equal(existsSync(at(dir, backupFile(2))), false)

      // 생애 종료·계승은 10분 조건 없이 항상 백업한다
      writeSave(dir, rootOf(NOW + 3, '사대'), { now: NOW + 3, backup: true, force_backup: true })
      assert.match(readFileSync(at(dir, backupFile(1)), 'utf8'), /삼대/)
      assert.match(readFileSync(at(dir, backupFile(2)), 'utf8'), /일대/)

      // 10분이 지나면 다시 순환하고 백업은 3개까지만 남는다.
      // 간격은 백업 파일의 mtime(실제 시계)과 재므로 시험 시간이 흐른 만큼 여유를 둔다
      writeSave(dir, rootOf(NOW + 4, '오대'), { now: Date.now() + BACKUP_MIN_GAP_MS + 1000, backup: true })
      assert.match(readFileSync(at(dir, backupFile(1)), 'utf8'), /사대/)
      assert.match(readFileSync(at(dir, backupFile(3)), 'utf8'), /일대/)
      assert.equal(existsSync(at(dir, backupFile(4))), false)
    } finally {
      rmSync(dir.root, { recursive: true, force: true })
    }
  })
})

describe('복구 순서(13 §8.5)', () => {
  it('1. save.json이 정상이면 그대로 쓴다', () => {
    const dir = tempDir()
    try {
      writeSave(dir, rootOf(NOW, '조약돌'), { now: NOW })
      const r = readSave(dir, baseContent(), NOW)
      assert.ok(r.ok)
      assert.equal(r.file, SAVE_FILE)
      assert.equal(r.recovered, false)
      assert.equal(r.result.root.body.family.name, '조약돌')
    } finally {
      rmSync(dir.root, { recursive: true, force: true })
    }
  })

  it('2. 교체 직전에 종료된 경우: tmp가 정상이고 더 늦으면 tmp를 쓴다', () => {
    const dir = tempDir()
    try {
      writeSave(dir, rootOf(NOW, '옛기록'), { now: NOW })
      writeFileSync(at(dir, TMP_FILE), JSON.stringify(rootOf(NOW + 5000, '새기록')), 'utf8')
      const r = readSave(dir, baseContent(), NOW)
      assert.ok(r.ok)
      assert.equal(r.file, TMP_FILE)
      assert.equal(r.result.root.body.family.name, '새기록')
    } finally {
      rmSync(dir.root, { recursive: true, force: true })
    }
  })

  it('3. save.json이 손상되면 backup_1로 복구한다', () => {
    const dir = tempDir()
    try {
      writeSave(dir, rootOf(NOW, '일대'), { now: NOW })
      writeSave(dir, rootOf(NOW + 1, '이대'), { now: NOW + 1, backup: true })
      writeFileSync(at(dir, SAVE_FILE), '{ 깨진 파일', 'utf8')
      const r = readSave(dir, baseContent(), NOW)
      assert.ok(r.ok)
      assert.equal(r.file, backupFile(1))
      assert.equal(r.recovered, true)
      assert.equal(r.result.root.body.family.name, '일대')
      assert.equal(r.failed[0]?.code, 'K1')
    } finally {
      rmSync(dir.root, { recursive: true, force: true })
    }
  })

  it('백업으로 복구해도 최고 관측 시각은 읽을 수 있었던 파일 중 가장 늦은 값을 쓴다', () => {
    const dir = tempDir()
    try {
      const old = rootOf(NOW, '일대', (b) => {
        b.offline_state.high_water_utc = NOW + 9_000_000
      })
      writeSave(dir, old, { now: NOW })
      writeSave(dir, rootOf(NOW + 1, '이대'), { now: NOW + 1, backup: true }) // 일대가 backup_1로
      const r = readSave(dir, baseContent(), NOW)
      assert.ok(r.ok)
      assert.equal(r.file, SAVE_FILE)
      assert.equal(r.result.root.body.offline_state.high_water_utc, NOW + 9_000_000)
    } finally {
      rmSync(dir.root, { recursive: true, force: true })
    }
  })

  it('4. 모두 실패하면 손상 파일을 corrupt\\로 옮긴다', () => {
    const dir = tempDir()
    try {
      writeSave(dir, rootOf(NOW), { now: NOW })
      writeSave(dir, rootOf(NOW + 1), { now: NOW + 1, backup: true })
      writeFileSync(at(dir, SAVE_FILE), '{ 깨짐', 'utf8')
      writeFileSync(at(dir, backupFile(1)), '{ 깨짐', 'utf8')
      const r = readSave(dir, baseContent(), NOW)
      assert.equal(r.ok, false)
      assert.ok(!r.ok && r.quarantined.length === 2)
      assert.equal(existsSync(at(dir, SAVE_FILE)), false)
      assert.equal(readdirSync(join(dir.root, 'corrupt')).length, 2)

      // 보관은 최대 5개
      for (let i = 0; i < 3; i++) {
        writeFileSync(at(dir, SAVE_FILE), '{ 깨짐', 'utf8')
        readSave(dir, baseContent(), NOW + i + 1)
      }
      assert.ok(readdirSync(join(dir.root, 'corrupt')).length <= 5)
    } finally {
      rmSync(dir.root, { recursive: true, force: true })
    }
  })

  it('체크섬이 어긋난 파일은 손상으로 본다(K2)', () => {
    const dir = tempDir()
    try {
      const root = rootOf(NOW)
      root.header.checksum = '0'.repeat(64)
      writeFileSync(at(dir, SAVE_FILE), JSON.stringify(root), 'utf8')
      const r = readSave(dir, baseContent(), NOW)
      assert.equal(r.ok, false)
      assert.ok(!r.ok && r.failed[0]?.code === 'K2')
    } finally {
      rmSync(dir.root, { recursive: true, force: true })
    }
  })
})

describe('진단 로그(13 §8.6)', () => {
  it('날짜별 파일에 덧붙이고 7일이 지난 파일을 지운다', () => {
    const dir = tempDir()
    try {
      const logs = join(dir.root, 'logs')
      appendDiagnostics(logs, ['B13 시험 기록'], NOW)
      const today = new Date(NOW).toISOString().slice(0, 10)
      assert.match(readFileSync(join(logs, `diagnostic_${today}.log`), 'utf8'), /B13 시험 기록/)

      writeFileSync(join(logs, 'diagnostic_2000-01-01.log'), 'old', 'utf8')
      pruneDiagnostics(logs, NOW)
      assert.equal(existsSync(join(logs, 'diagnostic_2000-01-01.log')), false)
      assert.ok(existsSync(join(logs, `diagnostic_${today}.log`)))
    } finally {
      rmSync(dir.root, { recursive: true, force: true })
    }
  })
})
