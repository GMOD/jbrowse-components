import { hitIndexOf, withHitIndex } from '@jbrowse/core/util/markEncoding'

import type {
  EncodedChannels,
  HitIndexed,
} from '@jbrowse/core/util/markEncoding'

type Lane = Uint32Array | Float32Array | Uint8Array

function compact<T extends Lane>(
  lane: T,
  keep: Uint8Array,
  count: number,
  kept: number,
): T {
  const out = new (lane.constructor as new (n: number) => T)(kept)
  let j = 0
  for (let i = 0; i < count; i++) {
    if (keep[i]) {
      out[j++] = lane[i]!
    }
  }
  return out
}

/**
 * `layer` less the instances `keep` leaves 0, every lane compacted alike:
 * `featureIndex` still names each one's feature, `y`'s extremes are the kept
 * instances', and a hit index is rebuilt over them. `layer` itself where
 * every instance is kept.
 */
export function keptInstances<L extends EncodedChannels>(
  layer: L,
  keep: Uint8Array,
): L {
  const { count } = layer
  let kept = 0
  for (let i = 0; i < count; i++) {
    kept += keep[i]!
  }
  if (kept === count) {
    return layer
  }
  const lane = <T extends Lane>(values: T | undefined) =>
    values && compact(values, keep, count, kept)
  const featureIndex =
    layer.featureIndex ?? Uint32Array.from({ length: count }, (_, i) => i)
  const y = lane(layer.y)
  let yMin = Infinity
  let yMax = -Infinity
  for (const v of y ?? []) {
    yMin = Math.min(yMin, v)
    yMax = Math.max(yMax, v)
  }
  const x = compact(layer.x, keep, count, kept)
  const x2 = compact(layer.x2, keep, count, kept)
  const { color, text } = layer
  const compacted: L = {
    ...layer,
    count: kept,
    x,
    x2,
    featureIndex: compact(featureIndex, keep, count, kept),
    root: lane(layer.root),
    y,
    ...(y ? { yMin, yMax } : {}),
    color: typeof color === 'object' ? lane(color) : color,
    // the y lane itself where the color reads the plotted field
    colorValue:
      layer.colorValue && layer.colorValue === layer.y
        ? y
        : lane(layer.colorValue),
    colorKey: lane(layer.colorKey),
    glyph: lane(layer.glyph),
    row: lane(layer.row),
    series: lane(layer.series),
    text: text?.filter((_, i) => keep[i]),
    size: lane(layer.size),
    x2Ref: lane(layer.x2Ref),
    feet: lane(layer.feet),
    flatbushData: undefined,
    flatbush: undefined,
  }
  const indexed = (layer as HitIndexed<L>).flatbush || layer.flatbushData
  return indexed
    ? withHitIndex({
        ...compacted,
        flatbushData: kept > 0 ? hitIndexOf(x, x2, y, kept).data : undefined,
      })
    : compacted
}
