// 정규 JSON·체크섬·스키마 버전과 이전(13 §8.2·§8.7, 16 §5.1).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  bodyChecksum, canonicalJson, hasMigrationPath, makeSaveRoot, migrateSaveBody, registerSaveMigration,
  SAVE_SCHEMA_VERSION, serializeSave, toHex,
} from '../../src/index'
import { makeGame } from '../offline/fixture'

const meta = {
  app_version: '0.1.0',
  saved_at_utc: 1_790_000_000_000,
  content_packs: [{ id: 'base', version: '0.1.0' }],
  content_hash: 'abc',
}

describe('정규 JSON(13 §8.2)', () => {
  it('키 순서가 달라도 같은 바이트가 나온다', () => {
    assert.equal(canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] }), '{"a":[2,{"c":4,"d":3}],"b":1}')
    assert.equal(canonicalJson({ a: [2, { c: 4, d: 3 }], b: 1 }), canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] }))
  })

  it('undefined 값은 JSON.stringify와 같게 다룬다(객체 키는 빼고 배열 자리는 null)', () => {
    assert.equal(canonicalJson({ a: undefined, b: 1 }), '{"b":1}')
    assert.equal(canonicalJson([undefined, 1]), '[null,1]')
  })

  it('저장 본문을 두 번 직렬화해도 같다', () => {
    const world = makeGame()
    world.advance(600)
    const body = world.snapshot()
    assert.equal(canonicalJson(body), canonicalJson(JSON.parse(canonicalJson(body))))
  })
})

describe('체크섬(13 §8.2)', () => {
  it('body의 정규 JSON SHA-256 16진 소문자이고 node:crypto와 같다', () => {
    const body = { z: 1, a: { y: 2, x: [3, 4] } }
    const expected = createHash('sha256').update(canonicalJson(body), 'utf8').digest('hex')
    assert.equal(bodyChecksum(body), expected)
    assert.match(bodyChecksum(body), /^[0-9a-f]{64}$/)
  })

  it('makeSaveRoot가 body만 대상으로 체크섬을 넣는다', () => {
    const world = makeGame()
    const body = world.snapshot()
    const root = makeSaveRoot(body, meta)
    assert.equal(root.header.schema_version, SAVE_SCHEMA_VERSION)
    assert.equal(root.header.encoding, 'json')
    assert.equal(root.header.checksum, bodyChecksum(body))
    // 머리가 바뀌어도 체크섬은 그대로다
    assert.equal(makeSaveRoot(body, { ...meta, saved_at_utc: 1 }).header.checksum, root.header.checksum)
    assert.equal(serializeSave(root), canonicalJson(root))
  })

  it('toHex는 16진 소문자다', () => {
    assert.equal(toHex(new Uint8Array([0, 15, 16, 255])), '000f10ff')
  })
})

describe('스키마 버전과 이전(13 §8.7)', () => {
  it('첫 검증판은 1이고 자기 자신으로 가는 길은 비어 있다', () => {
    assert.equal(SAVE_SCHEMA_VERSION, 1)
    assert.equal(hasMigrationPath(1), true)
    assert.equal(migrateSaveBody({ a: 1 }, 1).applied.length, 0)
  })

  it('등록하지 않은 칸이 있으면 길이 없다고 본다(K3)', () => {
    assert.equal(hasMigrationPath(0), false, '0은 정수 버전이 아니다')
    assert.equal(hasMigrationPath(1.5), false)
    assert.equal(hasMigrationPath(2, 1), false, '앱보다 높은 버전은 길이 아니다')
    assert.equal(hasMigrationPath(1, 3), false, '1 → 2 칸이 비어 있다')
  })

  it('v → v+1 함수를 차례로 적용한다', () => {
    // 첫 검증판 스키마 버전(1)보다 위쪽이라 loadSave의 길에는 끼어들지 않는다
    registerSaveMigration(7, (b) => ({ ...b, step7: true }))
    registerSaveMigration(8, (b) => ({ ...b, step8: true }))
    assert.equal(hasMigrationPath(7, 9), true)
    const moved = migrateSaveBody({ keep: 1 }, 7, 9)
    assert.deepEqual(moved.applied, [7, 8])
    assert.deepEqual(moved.body, { keep: 1, step7: true, step8: true })
    assert.throws(() => registerSaveMigration(7, (b) => b), /중복/)
  })
})
