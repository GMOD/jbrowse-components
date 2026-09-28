import type { StoredLayer } from './markList.ts'
import type { ScoreSpan, VisibleEntry } from '@jbrowse/wiggle-core'

/** A layer as the autoscale folds it: the region it was fetched into, and its lanes. */
export interface RegionLayer {
  index: number
  layer: StoredLayer
}

// A link's extent on the region that drew it: both feet where the far one
// lies on this region too, the near foot alone where it lies elsewhere, so a
// curve rising to a mate left of the view or on another sequence still folds
// into the axis while its near foot is in view.
function linkFeet(
  layer: StoredLayer,
  index: number,
): [Uint32Array, Uint32Array] | undefined {
  const { x2Region, count } = layer
  if (!x2Region) {
    return undefined
  }
  const starts = new Uint32Array(count)
  const ends = new Uint32Array(count)
  for (let i = 0; i < count; i++) {
    const near = layer.x[i]!
    const far = x2Region[i] === index ? layer.x2[i]! : near
    starts[i] = Math.min(near, far)
    ends[i] = near === far ? near + 1 : Math.max(near, far)
  }
  return [starts, ends]
}

/**
 * Each folded layer as a `ScoreSpan`, so the shared autoscale walks the `y`
 * lane the same way it walks a wiggle source's scores: one value per instance,
 * clipped to the block the entry carries, a row the table hides left out.
 */
export function layerSpans(
  entries: VisibleEntry<RegionLayer>[],
  drawnKeys: Uint8Array | undefined,
): ScoreSpan[] {
  return entries.flatMap(({ data: { index, layer }, visStart, visEnd }) => {
    const { y } = layer
    if (!y) {
      return []
    }
    const [starts, ends] = linkFeet(layer, index) ?? [layer.x, layer.x2]
    return [
      {
        count: layer.count,
        starts,
        ends,
        stride: 1,
        endOffset: 0,
        low: y,
        high: y,
        visStart,
        visEnd,
        sortedBins: false,
        row: layer.row,
        drawnKeys,
      },
    ]
  })
}

/**
 * Whether a bar's baseline trains the axis, as ggplot2's does: only where the
 * scale can reach it, and a log axis has no 0.
 */
export function baselineReached(origin: number, scaleType: string) {
  return scaleType !== 'log' || origin > 0
}
