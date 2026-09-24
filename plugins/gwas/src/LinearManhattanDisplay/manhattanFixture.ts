import { hitIndexOf } from '@jbrowse/core/util/markEncoding'

import type { ManhattanChannels } from './manhattanLayer.ts'
import type { EncodedChannels } from '@jbrowse/core/util/markEncoding'

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
} & Partial<Pick<EncodedChannels, 'scale' | 'shapeScale'>>): ManhattanChannels {
  const count = x.length
  let yMin = Infinity
  let yMax = -Infinity
  for (const v of y) {
    yMin = v < yMin ? v : yMin
    yMax = v > yMax ? v : yMax
  }
  const xs = Uint32Array.from(x)
  const x2s = Uint32Array.from(x2)
  const ys = Float32Array.from(y)
  return {
    count,
    skipped: 0,
    x: xs,
    x2: x2s,
    y: ys,
    color: Uint32Array.from(color),
    glyph: Uint8Array.from(glyph),
    featureIndex: Uint32Array.from(x.map((_, i) => i)),
    yMin,
    yMax,
    flatbushData:
      flatbush && count > 0 ? hitIndexOf(xs, x2s, ys).data : undefined,
    ...rest,
  }
}
