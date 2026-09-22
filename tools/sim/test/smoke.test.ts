import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ENGINE_VERSION } from '@tap/core'

describe('sim', () => {
  it('워크스페이스 패키지 @tap/core 를 불러온다', () => {
    assert.equal(typeof ENGINE_VERSION, 'string')
  })
})
