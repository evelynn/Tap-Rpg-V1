import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ENGINE_VERSION } from '../src/index'

describe('core', () => {
  it('엔진 버전을 내보낸다', () => {
    assert.match(ENGINE_VERSION, /^\d+\.\d+\.\d+$/)
  })
})
