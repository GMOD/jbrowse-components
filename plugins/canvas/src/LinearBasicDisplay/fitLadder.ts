import { maxBottom } from './layout.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

// The whitespace factor `keepFeatureLabel` demands is searched in [0, MAX],
// where 0 keeps every name and MAX keeps only the most isolated (plus pinned).
// Past ~8x almost nothing but pinned survives, so that caps the search; ITERS
// bisections land the stack within one label row of the track height.
const FIT_MAX_ROOM_FACTOR = 8
const FIT_SOLVE_ITERS = 8

/**
 * The smallest x in `(lo, hi]` with `fits(x)`, by bisection.
 *
 * Two preconditions, and they are why this is a function rather than four lines
 * inline: `fits` must be monotone, and the caller must have ALREADY measured
 * `fits(hi) === true` and `fits(lo) === false`. Given those, the loop only
 * narrows a bracket whose ends are both known, so returning `hi` returns a value
 * something measured — where a loop handed an unmeasured `hi` returns a bound
 * that may not fit at all. That is the bug that once hid every label on a track
 * a fitting decimation existed for, so don't simplify the two probes away.
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
 * The largest integer x in `[lo, hi]` with `fits(x)`, by bisection.
 *
 * The integer twin of `bisectSmallestFitting`, and it owes the same two
 * preconditions for the same reason: `fits` must be monotone (fewer isoforms
 * cannot make a stack taller) and the caller must have ALREADY measured
 * `fits(lo) === true` and `fits(hi) === false`, so the loop only ever narrows a
 * bracket whose ends are both known and `lo` is a value something measured.
 *
 * No iteration count: the bracket is integers, so it closes on its own.
 */
export function bisectLargestFitting(
  fits: (x: number) => boolean,
  lo: number,
  hi: number,
) {
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (fits(mid)) {
      lo = mid
    } else {
      hi = mid
    }
  }
  return lo
}

/**
 * The most isoforms per gene whose names-kept stack fits `trackHeight`, or
 * undefined when trimming buys nothing — either no gene on screen has more than
 * one, or the whole stack already fits.
 *
 * Answers 1 rather than undefined when even one isoform per gene overflows:
 * "names before isoforms" means every isoform goes before any name does, so the
 * `decimated` and `bodies` rungs below run at that 1 rather than back at the
 * full stack.
 *
 * Takes the probe rather than building one, like `solveLabelRoomFactor`: its
 * preparation depends on the data and the layout inputs but not on the track
 * height, so a caller re-solving as the height moves holds one probe across
 * every solve.
 */
export function solveIsoformCount(
  heightAt: (maxIsoforms: number) => number,
  trackHeight: number,
  maxIsoformsOnScreen: number,
) {
  if (maxIsoformsOnScreen <= 1) {
    return undefined
  }
  const fits = (maxIsoforms: number) => heightAt(maxIsoforms) <= trackHeight
  if (fits(maxIsoformsOnScreen)) {
    return undefined
  }
  if (!fits(1)) {
    return 1
  }
  return bisectLargestFitting(fits, 1, maxIsoformsOnScreen)
}

/**
 * The smallest `labelRoomFactor` whose packed stack fits `trackHeight`, or
 * undefined when even the most aggressive decimation overflows. Smallest = most
 * names kept, and the kept set shrinks monotonically as the factor rises, so the
 * bisection is valid.
 *
 * Both ends are probed rather than assumed, which is what makes them the
 * measurements `bisectSmallestFitting` requires. Factor 0 in particular is not
 * known to overflow: the `labels` rung that sent the ladder here is packed
 * through the incremental memo, whose prior-row seeding can make it taller than
 * an unseeded pack of the same label set. The cap is the mirror image — probing
 * it is what lets the loop return `hi` directly, and skips the bisection
 * entirely when nothing fits, which is the common case here.
 *
 * Takes the probe rather than building one: its preparation depends on the data
 * and the layout inputs but NOT on the track height, so a caller re-solving as
 * the height moves holds one probe across every solve.
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
  if (!fits(FIT_MAX_ROOM_FACTOR)) {
    return undefined
  }
  return bisectSmallestFitting(fits, 0, FIT_MAX_ROOM_FACTOR, FIT_SOLVE_ITERS)
}

// The fit ladder's reservation levels, least to most reduced: `full` reserves
// names + descriptions, `labels` drops descriptions, `isoforms` trims each
// gene's transcript stack to the count that fits WITH its names, `decimated`
// keeps names only on features wide enough to host them (plus
// pinned/highlighted), `bodies` drops all names and packs boxes edge-to-edge.
//
// `isoforms` sits above `decimated` because the policy is names before
// isoforms: a gene drawn with 5 of its 10 transcripts and its name on it is the
// picture the reader can use, and one drawn with all 10 and no name is not.
type FitLevel = 'full' | 'labels' | 'isoforms' | 'decimated' | 'bodies'

// One rung. Lazy so a rung tighter than the one that fits is never laid out — in
// the common non-overflowing case only `full` is materialized.
export interface FitRung {
  level: FitLevel
  layout: () => Map<number, FeatureDataResult>
  // isoforms per gene this rung packs at, undefined for every one the worker
  // sent. Carried on the rung rather than derived from the level, because the
  // two rungs BELOW `isoforms` inherit the count it failed at (see fitStage).
  // A thunk like `layout`, and for the same reason: the count is a solve that
  // packs, and a stack that fits at `full` never asks for it.
  maxIsoforms?: () => number | undefined
}

// The resolved outcome, bundled so its parts can't disagree. `scale` is
// two-directional: > 1 grows a stack that fits with room to spare (capped at
// `maxScale`), < 1 squeezes the last rung (floored at `minScale`), 1 when it
// lands exactly. `contentHeight` is the kept rung's unscaled `maxBottom`, so a
// caller derives the fitted height as `contentHeight * scale` without re-walking
// the scaled map.
export interface FitStage {
  level: FitLevel
  layout: Map<number, FeatureDataResult>
  scale: number
  contentHeight: number
  // isoforms per gene the kept rung packs at, undefined when nothing was
  // trimmed. The chip, the tooltip and `isoformPicks.byCap` read the solve from
  // here rather than from a worker flag.
  maxIsoforms: number | undefined
}

// Uniform vertical scale making a `contentHeight` stack fill `trackHeight`,
// clamped to [minScale, maxScale].
//
// An empty stack answers 1: it has nothing to fill the track with, and the
// division would hand back Infinity and so `maxScale` — a stack of nothing,
// "grown". The guard lives here, next to the division, so a second caller can't
// forget it.
export function fitScaleToFill(
  contentHeight: number,
  trackHeight: number,
  minScale: number,
  maxScale: number,
) {
  return contentHeight > 0
    ? Math.max(minScale, Math.min(maxScale, trackHeight / contentHeight))
    : 1
}

// Smallest feature-body height (px) a squeeze may leave. Once bodies would pack
// tighter than this the squeeze stops and the surplus scrolls, rather than
// shrinking boxes to invisibility.
//
// Here rather than in the display that reads it, because it is the promise
// `squeezeFloorScale` below makes and every caller of that owes the same one — a
// band fitting a stack into 40px is squeezing the same boxes a track squeezing
// into 400px is.
export const MIN_FIT_BOX_PX = 2

// Floor for the squeeze, as a scale in (0, 1]: the deepest reduction leaving the
// shortest body `minBoxPx` tall. Below that the surplus scrolls rather than
// shrinking boxes to invisibility.
//
// Both degenerate inputs answer 1 — "no squeeze available" — through the same
// comparison rather than separate guards: a stack already at or under the
// minimum has nothing left to give, and one with no body at all has nothing to
// measure. That is what lets the caller pass a raw `minDrawnBoxHeight` straight
// in, with no zero check and no `Math.min(1, …)` of its own.
export function squeezeFloorScale(shortestBodyPx: number, minBoxPx: number) {
  return shortestBodyPx > minBoxPx ? minBoxPx / shortestBodyPx : 1
}

// Float-epsilon allowance, not a layout tolerance — well under one row.
const FIT_SNAP_EPSILON_PX = 1

// The content height fit mode reports, snapping away a float-epsilon overflow.
// Scaling a rung by `height / contentHeight` should land exactly on
// `trackHeight`, but the multiply-then-measure round trip lands a hair above it
// in ~5% of cases — enough to mark the track as overflowing and open a sub-pixel
// scrollbar. A larger overflow is the min-box floor stopping a squeeze short of
// fitting: real, and kept so it scrolls.
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
// very same map object again. That happens constantly rather than rarely: a rung
// whose reduction is already in effect returns the PREVIOUS rung's map by
// reference (names off makes `labels`, `decimated` and `bodies` literally one
// stack), so without this the ladder walks the same map up to four times.
//
// The reuse is sound for the narrowest possible reason — same object, therefore
// same height — and specifically NOT because a rung reported its height. That
// distinction is why this takes layouts and not numbers: the `decimated` rung
// arrives from a bisection assuming stack height is monotone in its factor, and
// greedy first-fit plus pitchY quantization do not guarantee it. Measuring every
// kept rung off the stack it is about to return makes a non-monotone solve
// self-correcting — an overflowing `decimated` stack simply descends to
// `bodies`.
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

// Keep the least-reduced rung whose unscaled stack fits `trackHeight`, then
// scale it to fill. A fitting rung grows (capped at `maxScale`) so bodies fill
// the track instead of leaving whitespace; a rung that overflows descends; the
// last rung has no next, so it is squeezed (floored at `minScale`) and scrolls
// if even that overflows. Rungs are laid out lazily in order.
export function resolveFitLadder(
  // Non-empty by construction — the walk always keeps the last rung. The tuple
  // type rejects `[]` at compile time rather than crashing on `rungs[0]`.
  rungs: [FitRung, ...FitRung[]],
  trackHeight: number,
  minScale: number,
  maxScale: number,
  // Features every rung's height is measured over: fit mode passes the
  // on-screen ones, so a stack the fetch buffer made tall off screen neither
  // strips labels nor squeezes the boxes the user is looking at.
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
        maxIsoforms: rung.maxIsoforms?.(),
        scale: fitScaleToFill(contentHeight, trackHeight, minScale, maxScale),
      }
    }
  }
  // Unreachable: the tuple type guarantees a rung and the last one always
  // returns. Present so the function is total without a non-null assertion.
  throw new Error('resolveFitLadder called with no rungs')
}
