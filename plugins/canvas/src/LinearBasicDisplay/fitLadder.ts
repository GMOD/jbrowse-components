import { maxBottom } from './layout.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

// Fit-mode name-decimation solve (see `solveLabelRoomFactor`). The whitespace
// factor keepFeatureLabel demands is searched in [0, MAX], where 0 keeps every
// name (tallest) and MAX keeps only the most isolated (plus pinned) — beyond ~8x
// almost nothing but pinned survives, so it caps the search. ITERS bisections
// give ~MAX/2^ITERS factor resolution, enough to land the stack within one label
// row of the track height without an over-long probe loop.
const FIT_MAX_ROOM_FACTOR = 8
const FIT_SOLVE_ITERS = 8

/**
 * The smallest x in `(lo, hi]` with `fits(x)`, by bisection.
 *
 * Two preconditions, and they are the whole reason this is its own function
 * rather than four lines inline: `fits` must be monotone (false below some
 * threshold, true at and above it), and the caller must have ALREADY measured
 * `fits(hi) === true` and `fits(lo) === false`. Given those, the loop only ever
 * narrows a bracket whose ends are both known, so returning `hi` returns a value
 * something actually measured — where a loop handed an unmeasured `hi` returns a
 * bound that may not fit at all. Spelling the contract here is what stops the
 * next caller from "simplifying" the two probes above it away, which is exactly
 * the bug that once hid every label on a track a fitting decimation existed for.
 *
 * `iterations` bisections give `(hi - lo) / 2^iterations` resolution.
 */
export function bisectSmallestFitting(
  fits: (x: number) => boolean,
  lo: number,
  hi: number,
  iterations: number,
) {
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) {
      hi = mid
    } else {
      lo = mid
    }
  }
  return hi
}

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
 * Takes the probe rather than building one (see `createContentHeightProbe`): its
 * preparation — label widths, neighbor-room sorts — depends on the data and the
 * layout inputs but NOT on the track height, so a caller that re-solves as the
 * height moves (a drag-resize frame) can hold one probe across every solve. The
 * type also says the only thing this searches over is the factor.
 */
export function solveLabelRoomFactor(
  heightAt: (labelRoomFactor: number) => number,
  trackHeight: number,
) {
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
  // Both ends are now measured — 0 overflows, the cap fits — which is exactly
  // `bisectSmallestFitting`'s precondition.
  return bisectSmallestFitting(fits, 0, FIT_MAX_ROOM_FACTOR, FIT_SOLVE_ITERS)
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

// Floor for the fit squeeze, as a scale in (0, 1]: the deepest reduction that
// still leaves the shortest body in the stack `minBoxPx` tall. Below that the
// squeeze stops and the surplus scrolls rather than shrinking boxes to
// invisibility.
//
// The two degenerate inputs both answer 1 — "no squeeze available" — through the
// same comparison rather than through separate guards: a stack whose shortest
// body is already at or under the minimum has nothing left to give, and a stack
// with no body at all (`shortestBodyPx` 0, an empty layout) has nothing to
// measure. That is what lets the caller pass a raw `minBodyHeight` straight in,
// with no zero check and no `Math.min(1, …)` clamp of its own — the two places
// the old spelling could have disagreed with each other.
export function squeezeFloorScale(shortestBodyPx: number, minBoxPx: number) {
  return shortestBodyPx > minBoxPx ? minBoxPx / shortestBodyPx : 1
}

// A fitted stack lands within this many px of the track height and still counts
// as fitting exactly. See snapFittedContentHeight — it is a float-epsilon
// allowance, not a layout tolerance, so it is well under one row.
const FIT_SNAP_EPSILON_PX = 1

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
  return scaling && rawContentHeight - trackHeight < FIT_SNAP_EPSILON_PX
    ? Math.min(rawContentHeight, trackHeight)
    : rawContentHeight
}

// Measures a rung's stack height, reusing the previous answer when handed the
// very same map object again.
//
// That happens constantly and is not an optimization detail: a rung whose
// reduction is already in effect returns the PREVIOUS rung's map by reference
// (names off makes `labels`, `decimated` and `bodies` literally one stack), so
// without this the ladder walks the same map up to four times. The reuse is sound
// for the narrowest possible reason — reference equality, same object, therefore
// same height — and specifically NOT because a rung told us its height.
//
// That distinction is the whole point of measuring here. The `decimated` rung
// arrives from a bisection that assumes stack height is monotone in its whitespace
// factor, and greedy first-fit plus pitchY quantization do not actually guarantee
// that. Measuring every kept rung off the stack it is about to return is what
// makes a non-monotone solve self-correcting: an overflowing `decimated` stack
// simply descends to `bodies`. A rung-reported height would forfeit that, which is
// why this takes layouts and not numbers.
function rungHeightMeasurer(measureIds?: ReadonlySet<string>) {
  let lastLayout: Map<number, FeatureDataResult> | undefined
  let lastHeight = 0
  return (layout: Map<number, FeatureDataResult>) => {
    if (layout !== lastLayout) {
      lastLayout = layout
      lastHeight = maxBottom(layout, measureIds)
    }
    return lastHeight
  }
}

// The scale that fills the track with a kept rung. Split out so the empty-stack
// case is answered once, in the place that knows why: a stack of height 0 has
// nothing to fill the track with, so it stays at 1 instead of dividing by zero.
function keptRungScale(
  contentHeight: number,
  trackHeight: number,
  minScale: number,
  maxScale: number,
) {
  return contentHeight > 0
    ? fitScaleToFill(contentHeight, trackHeight, minScale, maxScale)
    : 1
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
  const heightOf = rungHeightMeasurer(measureIds)
  for (const [i, rung] of rungs.entries()) {
    const layout = rung.layout()
    const contentHeight = heightOf(layout)
    const isLastRung = i === rungs.length - 1
    if (contentHeight <= trackHeight || isLastRung) {
      return {
        level: rung.level,
        layout,
        contentHeight,
        scale: keptRungScale(contentHeight, trackHeight, minScale, maxScale),
      }
    }
  }
  // Unreachable: the tuple type guarantees a rung, and the last one always
  // returns. Present so the function is total without a non-null assertion.
  throw new Error('resolveFitLadder called with no rungs')
}
