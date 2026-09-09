import Flatbush from '@jbrowse/core/util/flatbush'

import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'

/**
 * A worker payload for tests, from parallel lists: the encoder's dense
 * channels, the score extremes and a Flatbush over (bp, score), the way
 * `encodeFeatures` ships them.
 */
export function manhattanFixture({
  x,
  y,
  x2 = x.map(p => p + 1),
  color = x.map(() => 0xff_00_00_ff),
  glyph = x.map(() => 0),
  flatbush = true,
  ...rest
}: {
  x: number[]
  y: number[]
  x2?: number[]
  color?: number[]
  glyph?: number[]
  flatbush?: boolean
} & Partial<
  Pick<ManhattanRpcResult, 'r2s' | 'indexFound' | 'scale'>
>): ManhattanRpcResult {
  const count = x.length
  let yMin = Infinity
  let yMax = -Infinity
  for (const v of y) {
    yMin = v < yMin ? v : yMin
    yMax = v > yMax ? v : yMax
  }
  let flatbushData: ArrayBuffer | undefined
  if (flatbush && count > 0) {
    const fb = new Flatbush(count, undefined, Float64Array)
    for (let i = 0; i < count; i++) {
      fb.add(x[i]!, y[i]!, x2[i], y[i])
    }
    fb.finish()
    flatbushData = fb.data
  }
  return {
    count,
    x: Uint32Array.from(x),
    x2: Uint32Array.from(x2),
    y: Float32Array.from(y),
    color: Uint32Array.from(color),
    glyph: Uint8Array.from(glyph),
    featureIndex: Uint32Array.from(x.map((_, i) => i)),
    yMin,
    yMax,
    flatbushData,
    scale: undefined,
    glyphScale: undefined,
    ...rest,
  }
}
