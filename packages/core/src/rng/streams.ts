// 난수 흐름(13 §8.3). 한 흐름의 소비량이 바뀌어도 다른 흐름의 결과가 흔들리지 않게 나눈다.
import { Pcg32 } from './pcg32'
import { sha256, utf8 } from './sha256'

export const RNG_STREAMS = ['combat', 'loot', 'event', 'life', 'world'] as const
export type RngStream = (typeof RNG_STREAMS)[number]

// SHA-256(UTF-8(family_seed + ":" + stream))의 앞 16바이트 → 앞 8바이트 initstate, 뒤 8바이트 initseq(빅엔디언)
export function streamSeed(familySeed: string, stream: RngStream): { initstate: bigint; initseq: bigint } {
  const h = sha256(utf8(`${familySeed}:${stream}`))
  return { initstate: readU64(h, 0), initseq: readU64(h, 8) }
}

export function createRngStreams(familySeed: string): Record<RngStream, Pcg32> {
  const entries = RNG_STREAMS.map((s) => {
    const { initstate, initseq } = streamSeed(familySeed, s)
    return [s, Pcg32.seed(initstate, initseq)] as const
  })
  return Object.fromEntries(entries) as Record<RngStream, Pcg32>
}

function readU64(bytes: Uint8Array, offset: number): bigint {
  let v = 0n
  for (let i = offset; i < offset + 8; i++) v = (v << 8n) | BigInt(bytes[i]!)
  return v
}
