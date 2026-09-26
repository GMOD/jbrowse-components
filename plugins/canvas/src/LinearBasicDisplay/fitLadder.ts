import { maxBottom } from './layoutQueries.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { LabelRoomFactors } from './layoutInputs.ts'

// Past ~8x almost nothing but pinned survives, which caps the search.
const FIT_MAX_ROOM_FACTOR = 8
const FIT_SOLVE_ITERS = 8

// `fits` must be monotone and the caller must already have measured
// `fits(hi)` true and `fits(lo)` false, so the returned `hi` is a value
// something measured; an unmeasured `hi` once hid every label on a track.
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

// Same two preconditions as `bisectSmallestFitting`: monotone `fits`, with
// `fits(lo)` true and `fits(hi)` false already measured.
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

// `floorWhenNothingFits` belongs to the caller: fit passes 1 so the rungs
// below run at one isoform per gene, fixed passes undefined because trimming
// to 1 there still scrolls.
export function solveIsoformCount(
  heightAt: (maxIsoforms: number) => number,
  trackHeight: number,
  maxIsoformsOnScreen: number,
  floorWhenNothingFits: 1 | undefined,
) {
  if (maxIsoformsOnScreen <= 1) {
    return undefined
  }
  const fits = (maxIsoforms: number) => heightAt(maxIsoforms) <= trackHeight
  if (fits(maxIsoformsOnScreen)) {
    return undefined
  }
  if (!fits(1)) {
    return floorWhenNothingFits
  }
  return bisectLargestFitting(fits, 1, maxIsoformsOnScreen)
}

// Both ends are probed rather than assumed: factor 0 is not known to
// overflow, since the `labels` rung's seeded pack can be taller than an
// unseeded pack of the same label set.
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

// Gene names claim the height first and the rest fill what they leave: the
// genes' factor is solved with every other name gone, then the others' beside
// the gene names that stayed. Names all of one tier solve a single factor.
export function solveLabelRoomFactors(
  heightAt: (labelRoomFactor: number, geneLabelRoomFactor?: number) => number,
  trackHeight: number,
  tiers: { gene: boolean; other: boolean },
): LabelRoomFactors | undefined {
  if (!tiers.gene || !tiers.other) {
    const labelRoomFactor = solveLabelRoomFactor(f => heightAt(f), trackHeight)
    return labelRoomFactor === undefined ? undefined : { labelRoomFactor }
  }
  const geneLabelRoomFactor =
    solveLabelRoomFactor(g => heightAt(Infinity, g), trackHeight) ?? Infinity
  const labelRoomFactor = solveLabelRoomFactor(
    f => heightAt(f, geneLabelRoomFactor),
    trackHeight,
  )
  return labelRoomFactor !== undefined
    ? { labelRoomFactor, geneLabelRoomFactor }
    : geneLabelRoomFactor < Infinity
      ? { labelRoomFactor: Infinity, geneLabelRoomFactor }
      : undefined
}

// The pack snaps rows to a pitch of a tenth of the body height, so a finer
// scale than 1/32 of the range buys no pixel.
const BODY_SCALE_SOLVE_ITERS = 5

// The largest body scale, down to `floor`, whose labelled stack fits, or
// undefined when even the floor overflows.
export function solveBodyScale(
  heightAt: (bodyScale: number) => number,
  trackHeight: number,
  floor: number,
) {
  if (floor >= 1) {
    return undefined
  }
  const fitsSqueeze = (squeeze: number) => heightAt(1 - squeeze) <= trackHeight
  if (fitsSqueeze(0)) {
    return 1
  }
  if (!fitsSqueeze(1 - floor)) {
    return undefined
  }
  return (
    1 - bisectSmallestFitting(fitsSqueeze, 0, 1 - floor, BODY_SCALE_SOLVE_ITERS)
  )
}

// A labelled body shorter than this share of its label's font reads as an
// underline to the text, so below it the names go instead.
export const LABELED_BODY_TO_FONT_RATIO = 0.4

export function labeledBodyFloorScale(
  tallestBodyPx: number,
  shortestBodyPx: number,
  labelFontPx: number,
) {
  return Math.max(
    squeezeFloorScale(tallestBodyPx, LABELED_BODY_TO_FONT_RATIO * labelFontPx),
    squeezeFloorScale(shortestBodyPx, MIN_FIT_BOX_PX),
  )
}

// Names before isoforms, then names before body height: `thinned` shortens
// the bodies under a full set of names, and `decimated` keeps that floor.
// `bare` sits below `bodies` because subfeature labels are a config choice,
// given up only where the alternative squeezes bodies under rows the squeeze
// would hide anyway.
type FitLevel =
  | 'full'
  | 'labels'
  | 'isoforms'
  | 'thinned'
  | 'decimated'
  | 'bodies'
  | 'bare'

// A rung that hands back another rung's stack by reference declares that
// stack's reservation, so a renderer never re-derives it from the level.
export interface LabelReservation {
  showLabels: boolean
  showDescriptions: boolean
  dropBelowLabelRows: boolean
}

// Lazy, so a rung tighter than the one that fits is never laid out.
export interface FitRung {
  level: FitLevel
  reserved: LabelReservation
  layout: () => Map<number, FeatureDataResult>
  // Carried on the rung rather than derived from the level, because the two
  // rungs below `isoforms` inherit the count it failed at.
  maxIsoforms?: () => number | undefined
  bodyScale?: () => number
}

// `contentHeight` is the kept rung's unscaled `maxBottom`, of which
// `fixedHeight` is the part the scale leaves alone (the group chip rows), so
// the fitted height is `fittedHeight`. `bodyScale` is the part of the squeeze
// the pack already spent on bodies alone.
export interface FitStage extends LabelReservation {
  level: FitLevel
  layout: Map<number, FeatureDataResult>
  scale: number
  bodyScale: number
  contentHeight: number
  fixedHeight: number
  maxIsoforms: number | undefined
}

export function fittedHeight(
  stage: Pick<FitStage, 'contentHeight' | 'fixedHeight' | 'scale'>,
) {
  return (
    (stage.contentHeight - stage.fixedHeight) * stage.scale + stage.fixedHeight
  )
}

// The scale over the scalable part alone: a chip row is 16 px whatever the
// squeeze, so it is taken off both sides before the division. An empty stack
// answers 1: the division would hand back Infinity and so `maxScale`, a stack
// of nothing grown.
export function fitScaleToFill(
  contentHeight: number,
  trackHeight: number,
  minScale: number,
  maxScale: number,
  fixedHeight = 0,
) {
  const scalable = contentHeight - fixedHeight
  return scalable > 0
    ? Math.max(
        minScale,
        Math.min(maxScale, Math.max(0, trackHeight - fixedHeight) / scalable),
      )
    : 1
}

export const MIN_FIT_BOX_PX = 2

// Both degenerate inputs answer 1 through the same comparison, so a caller
// passes a raw `minDrawnBoxHeight` with no zero check.
export function squeezeFloorScale(shortestBodyPx: number, minBoxPx: number) {
  return shortestBodyPx > minBoxPx ? minBoxPx / shortestBodyPx : 1
}

// Float-epsilon allowance, not a layout tolerance.
const FIT_SNAP_EPSILON_PX = 1

// The multiply-then-measure round trip lands a hair above `trackHeight` in
// ~5% of cases, enough to open a sub-pixel scrollbar; a larger overflow is
// the min-box floor and stays.
export function snapFittedContentHeight(
  rawContentHeight: number,
  trackHeight: number,
  scaling: boolean,
) {
  return scaling && rawContentHeight - trackHeight < FIT_SNAP_EPSILON_PX
    ? Math.min(rawContentHeight, trackHeight)
    : rawContentHeight
}

// Same object, therefore same height: a rung whose reduction is already in
// effect returns the previous rung's map by reference, so the ladder would
// otherwise walk one map four times. Takes layouts rather than reported
// heights, because the `decimated` bisection assumes a monotonicity greedy
// first-fit does not guarantee; measuring the stack a rung returns makes an
// overflowing solve descend to `bodies`.
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

export function resolveFitLadder(
  rungs: [FitRung, ...FitRung[]],
  trackHeight: number,
  minScale: number,
  maxScale: number,
  // Fit mode passes the on-screen ids, so a stack the fetch buffer made tall
  // off screen neither strips labels nor squeezes the boxes the user is
  // looking at.
  measureIds?: ReadonlySet<string>,
  // The px of a stack the scale must leave alone: the group chip rows.
  fixedHeightOf: (layout: Map<number, FeatureDataResult>) => number = () => 0,
): FitStage {
  const heightOf = rungHeightMeasurer(measureIds)
  for (const [i, rung] of rungs.entries()) {
    const layout = rung.layout()
    const contentHeight = heightOf(layout)
    const isLastRung = i === rungs.length - 1
    if (contentHeight <= trackHeight || isLastRung) {
      const fixedHeight = fixedHeightOf(layout)
      return {
        level: rung.level,
        ...rung.reserved,
        layout,
        contentHeight,
        fixedHeight,
        maxIsoforms: rung.maxIsoforms?.(),
        bodyScale: rung.bodyScale?.() ?? 1,
        scale: fitScaleToFill(
          contentHeight,
          trackHeight,
          minScale,
          maxScale,
          fixedHeight,
        ),
      }
    }
  }
  // Unreachable: the last rung always returns.
  throw new Error('resolveFitLadder called with no rungs')
}
