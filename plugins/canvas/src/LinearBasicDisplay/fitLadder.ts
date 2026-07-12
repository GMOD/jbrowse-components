import { maxBottom } from './yMorph.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

// The fit-to-height escalation ladder's reservation levels, least to most
// reduced: `full` reserves names + descriptions, `labels` drops descriptions
// (names kept), `decimated` keeps names only on features wide enough to host
// them (plus pinned/highlighted) and drops the rest, `bodies` drops all names
// and packs boxes edge-to-edge. See `resolveFitLadder`.
export type FitLevel = 'full' | 'labels' | 'decimated' | 'bodies'

// One rung: a reservation level and a thunk producing its laid-out stack. Lazy so
// a rung tighter than the one that fits is never laid out — in the common
// non-overflowing case only `full` is materialized.
export interface FitRung {
  level: FitLevel
  layout: () => Map<number, FeatureDataResult>
}

// The resolved fit outcome, bundled so its parts can't disagree: which rung's
// `layout` won, its `level`, the uniform vertical `scale`, and the kept rung's
// `contentHeight` (unscaled `maxBottom` of `layout`). `scale` is two-directional:
// > 1 grows a stack that fits with room to spare so bodies fill the track (capped
// at `maxScale`), < 1 squeezes the last rung when even it overflows (floored at
// `minScale`), and 1 when it lands exactly. `contentHeight` lets callers derive
// the fitted height as `contentHeight * scale` — exactly `maxBottom` of the
// scaled `laidOutDataMap` — without re-walking the scaled map (see `maxY`).
export interface FitStage {
  level: FitLevel
  layout: Map<number, FeatureDataResult>
  scale: number
  contentHeight: number
}

// Uniform vertical scale that makes a `contentHeight` stack fill exactly
// `trackHeight`, clamped to [minScale, maxScale]. `maxScale` (>= 1) lets a sparse
// stack grow so bodies fill the available space instead of leaving whitespace;
// `minScale` (<= 1) stops a squeeze before a body shrinks below the min-box floor
// (past that the surplus scrolls). Callers guard `contentHeight > 0`, so there is
// no divide-by-zero.
export function fitScaleToFill(
  contentHeight: number,
  trackHeight: number,
  minScale: number,
  maxScale: number,
) {
  return Math.max(minScale, Math.min(maxScale, trackHeight / contentHeight))
}

// The content height fit mode should report, snapping away a float-epsilon
// overflow. Scaling a rung by `height / contentHeight` (squeezing down or growing
// up to fill) should land `rawContentHeight` exactly on `trackHeight`, but the
// multiply-then-measure round-trip lands a hair above it in ~5% of cases — enough
// to spuriously mark the track as overflowing and open a sub-pixel scrollbar. So
// when scaling (`scaling`, i.e. fitScale !== 1) and the overflow is below one
// pixel, clamp it to the track. A larger overflow is the min-box floor
// (fitMinScale) stopping a squeeze short of fitting — real, and kept so it
// scrolls; a grow capped by the max-box floor lands below the track (whitespace),
// where the clamp is a no-op. Not scaling (scale 1: an exact fit, or non-fit mode)
// always reports the raw height.
export function snapFittedContentHeight(
  rawContentHeight: number,
  trackHeight: number,
  scaling: boolean,
) {
  return scaling && rawContentHeight - trackHeight < 1
    ? Math.min(rawContentHeight, trackHeight)
    : rawContentHeight
}

// Resolve the escalation ladder: keep the least-reduced rung whose unscaled stack
// fits `trackHeight`, then scale it to fill. A fitting rung grows to fill the
// track (capped at `maxScale`, so a sparse stack's bodies get taller instead of
// leaving whitespace); a rung that overflows descends to the next; the last rung
// has no next, so it is squeezed to fit (floored at `minScale`) and scrolls if
// even that overflows. An empty rung (contentHeight 0) stays at scale 1. Rungs are
// laid out lazily in order, so rungs tighter than the kept one are never computed.
export function resolveFitLadder(
  // Non-empty by construction: the walk always keeps the last rung, so callers
  // must pass at least one. The tuple type rejects `[]` at compile time rather
  // than crashing on `rungs[0]`.
  rungs: [FitRung, ...FitRung[]],
  trackHeight: number,
  minScale: number,
  maxScale: number,
): FitStage {
  const walk = (i: number): FitStage => {
    const { level, layout: getLayout } = rungs[i]!
    const layout = getLayout()
    const contentHeight = maxBottom(layout)
    return contentHeight <= trackHeight || i === rungs.length - 1
      ? {
          level,
          layout,
          contentHeight,
          scale:
            contentHeight > 0
              ? fitScaleToFill(contentHeight, trackHeight, minScale, maxScale)
              : 1,
        }
      : walk(i + 1)
  }
  return walk(0)
}
