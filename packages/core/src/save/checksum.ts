// 체크섬(13 §8.2): body의 SHA-256을 16진 소문자로. 코어의 순수 TS SHA-256을 쓴다(I05).
import { sha256, utf8 } from '../rng/index'
import { canonicalJson } from './canonical'

export function toHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

// header.checksum의 단일 출처. 대상은 body뿐이다(16 §5.1)
export function bodyChecksum(body: unknown): string {
  return toHex(sha256(utf8(canonicalJson(body))))
}
