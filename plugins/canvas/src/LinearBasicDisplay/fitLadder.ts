import { createContentHeightProbe, maxBottom } from './layout.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { LayoutInputs } from './layout.ts'

// Fit-mode name-decimation solve (see `solveLabelRoomFactor`). The whitespace
// factor keepFeatureLabel demands is searched in [0, MAX], where 0 keeps every
// name (tallest) and MAX keeps only the most isolated (plus pinned) — beyond ~8x
// almost nothing but pinned survives, so it caps the search. ITERS bisections
// give ~MAX/2^ITERS factor resolution, enough to land the stack within one label
// row of the track height without an over-long probe loop.
const FIT_MAX_ROOM_FACTOR = 8
const FIT_SOLVE_ITERS = 8

/**
 * The smallest `labelRoomFactor` whose packed stack fits `trackHeight`, or
 * undefined when even the most aggressive decimation overflows.
 *
 * Smallest = most names kept, because the set of kept names shrinks
 * monotonically as the factor rises (see keepFeatureLabel), so stack height is
 * monotone non-increasing in the factor and a bisection is valid.
 *
 * Factor 0 (every name kept) is probed first rather than assumed to overflow:
 * the `labels` rung that sent the ladder here is packed through the incremental
 * memo, whose prior-row seeding can make it taller than an unseeded pack of the
 * same label set, so "labels overflowed" does not actually establish "factor 0
 * overflows". Probing it costs one height and turns the bisection's lower bound
 * from an assumption into a measurement — and when it fits, the solve returns
 * immediately with every name intact.
 *
 * The cap is then probed for the mirror-image reason: it is what makes the
 * bisection's upper bound a measurement too, so both ends of the searched
 * interval are known rather than assumed, and the whole bisection is skipped when
 * nothing fits.
 *
 * `baseInputs` is typed without `labelRoomFactor` so the preparation the probe
 * shares across trials provably can't depend on it.
 */
export function solveLabelRoomFactor(
  rpcDataMap: Parameters<typeof createContentHeightProbe>[0],
  baseInputs: Omit<LayoutInputs, 'labelRoomFactor'>,
  trackHeight: number,
  // Features the stack height is measured over — the on-screen ones (see
  // `maxBottom`). The same set the ladder measures its rungs with, so the factor
  // this solves for is the factor that rung is then kept or rejected on.
  measureIds?: ReadonlySet<string>,
) {
  // One preparation shared by every probe below — the label widths and
  // neighbor-room measurements don't vary with the factor.
  const heightAt = createContentHeightProbe(
    rpcDataMap,
    baseInputs,
    undefined,
    measureIds,
  )
  const fits = (labelRoomFactor: number) =>
    heightAt(labelRoomFactor) <= trackHeight
  if (fits(0)) {
    return 0
  }
  // The cap is the most aggressive decimation on offer, so if even it overflows,
  // no factor below it can fit — say so after one probe instead of bisecting
  // eight times toward a bound nothing measured. That is also the common case:
  // the ladder only reaches this rung because `labels` overflowed, and a track
  // dense enough for that often overflows at every factor.
  //
  // Probing it is what makes `hi` below a factor MEASURED to fit, so the loop can
  // return it directly. Left unmeasured, the search was really over the OPEN
  // interval (0, MAX) and a stack that fits only at the cap fell through to
  // `bodies` — every name hidden — with a fitting decimation available.
  if (!fits(FIT_MAX_ROOM_FACTOR)) {
    return undefined
  }
  // Bisect (0, FIT_MAX_ROOM_FACTOR]: `lo` is known to overflow, `hi` is the
  // smallest factor measured to fit so far.
  let lo = 0
  let hi = FIT_MAX_ROOM_FACTOR
  for (let i = 0; i < FIT_SOLVE_ITERS; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) {
      hi = mid
    } else {
      lo = mid
    }
  }
  return hi
}

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
  // Features every rung's height is measured over: fit mode passes the on-screen
  // ones, so a stack the fetch buffer made tall off screen neither strips labels
  // nor squeezes the boxes the user is actually looking at (see
  // `fitMeasureFeatureIds` and `maxBottom`).
  measureIds?: ReadonlySet<string>,
): FitStage {
  // LOAD-BEARING: every kept rung's height is measured HERE, off the stack it is
  // about to return. The `decimated` rung arrives from a bisection that assumes
  // stack height is monotone in its whitespace factor, which greedy first-fit and
  // pitchY quantization do not actually guarantee. This re-measure is what makes a
  // non-monotone solve self-correcting — an overflowing `decimated` stack simply
  // descends to `bodies`. Do not replace it with a height the rung reports about
  // itself.
  //
  // Rungs coincide often — a rung whose reduction is already in effect hands back
  // the previous rung's map by reference (names off makes `labels`, `decimated`
  // and `bodies` all the same stack). Reusing the height for a reference-identical
  // map is safe (same stack, same height) and keeps the guarantee above.
  let lastLayout: Map<number, FeatureDataResult> | undefined
  let lastHeight = 0
  for (const [i, rung] of rungs.entries()) {
    const layout = rung.layout()
    const contentHeight =
      layout === lastLayout ? lastHeight : maxBottom(layout, measureIds)
    lastLayout = layout
    lastHeight = contentHeight
    if (contentHeight <= trackHeight || i === rungs.length - 1) {
      return {
        level: rung.level,
        layout,
        contentHeight,
        // An empty stack has nothing to fill the track with, so it stays at 1
        // rather than dividing by zero.
        scale:
          contentHeight > 0
            ? fitScaleToFill(contentHeight, trackHeight, minScale, maxScale)
            : 1,
      }
    }
  }
  // Unreachable: the tuple type guarantees a rung, and the last one always
  // returns. Present so the function is total without a non-null assertion.
  throw new Error('resolveFitLadder called with no rungs')
}
