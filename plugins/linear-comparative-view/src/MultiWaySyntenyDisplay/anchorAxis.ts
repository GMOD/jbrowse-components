import {
  bpToLinearBp,
  clipToDisplayedRegions,
} from '@jbrowse/core/util/Base1DUtils'

import type { AnchorCoord } from './laneDecision.ts'
import type { Span } from './layoutMultiWay.ts'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'

/**
 * A linear genome view, or a static layout of the anchor's regions. A view
 * places at whole px, as its own `bpToPx` does; `wholePx: false` keeps the
 * fraction, which a table of positions wants
 */
export interface AnchorLayout extends Pick<
  ViewLayout,
  'displayedRegions' | 'bpPerPx' | 'offsetPx'
> {
  wholePx?: boolean
}

function layoutPx(view: AnchorLayout, bp: number) {
  const px = bp / view.bpPerPx
  return view.wholePx === false ? px : Math.round(px)
}

/** px of a coord before the scroll offset; undefined off the displayed regions */
export function anchorPx(
  view: AnchorLayout,
  refName: string,
  coord: number,
  displayedRegionIndex?: number,
) {
  const bp = bpToLinearBp({
    refName,
    coord,
    displayedRegions: view.displayedRegions,
    displayedRegionIndex,
  })
  return bp === undefined ? undefined : layoutPx(view, bp)
}

export interface AxisPlacement {
  /**
   * view px of the clipped ends before the scroll offset, in the interval's
   * own order
   */
  x1: number
  x2: number
  centre: AnchorCoord
}

/** Clips to the displayed regions, since `bpToPx` answers only inside one. */
export function axisPlacement(
  view: AnchorLayout,
  refName: string,
  start: number,
  end: number,
): AxisPlacement | undefined {
  const clipped = clipToDisplayedRegions(view, { refName, start, end })
  if (!clipped) {
    return undefined
  }
  const x1 = anchorPx(view, refName, clipped.start)
  const x2 = anchorPx(view, refName, clipped.end)
  return x1 === undefined || x2 === undefined
    ? undefined
    : {
        x1,
        x2,
        centre: { refName, coord: (clipped.start + clipped.end) / 2 },
      }
}

/** px relative to `originPx`, as a lane's `spanOf` answers */
export function axisSpan(
  view: AnchorLayout,
  refName: string,
  start: number,
  end: number,
  originPx = view.offsetPx,
): Span | undefined {
  const placement = axisPlacement(view, refName, start, end)
  return placement && [placement.x1 - originPx, placement.x2 - originPx]
}

/**
 * One span per displayed region the interval meets, so it opens a gap at the
 * seam between two regions of one refName rather than bridging it
 */
export function axisSpans(
  view: AnchorLayout,
  refName: string,
  start: number,
  end: number,
  originPx = view.offsetPx,
): Span[] {
  const out: Span[] = []
  view.displayedRegions.forEach((region, displayedRegionIndex) => {
    const s = Math.max(start, region.start)
    const e = Math.min(end, region.end)
    if (region.refName === refName && s <= e) {
      const px = (coord: number) =>
        anchorPx(view, refName, coord, displayedRegionIndex)! - originPx
      out.push([px(s), px(e)])
    }
  })
  return out
}

export function displayedRegionSpans(
  view: AnchorLayout,
  originPx = view.offsetPx,
): Span[] {
  let bp = 0
  return view.displayedRegions.map(({ start, end, reversed }) => {
    const left = layoutPx(view, bp) - originPx
    bp += end - start
    const right = layoutPx(view, bp) - originPx
    return reversed ? [right, left] : [left, right]
  })
}

/**
 * px relative to `originPx` of every `step` bp of the displayed regions that
 * lands in `[lo, hi]`, so a pan, which moves the view and not the origin,
 * keeps the answer
 */
export function axisTickXs(
  view: AnchorLayout,
  step: number,
  [lo, hi]: Span,
  originPx = view.offsetPx,
) {
  const { bpPerPx, displayedRegions } = view
  const xs: number[] = []
  let before = 0
  for (const { refName, start, end, reversed } of displayedRegions) {
    const left = before / bpPerPx - originPx
    before += end - start
    const bpAt = (px: number) =>
      reversed ? end - (px - left) * bpPerPx : start + (px - left) * bpPerPx
    const from = Math.max(start, Math.min(bpAt(lo), bpAt(hi)))
    const to = Math.min(end, Math.max(bpAt(lo), bpAt(hi)))
    for (let bp = Math.ceil(from / step) * step; bp < to; bp += step) {
      const span = axisSpan(view, refName, bp, bp + 1, originPx)
      if (span) {
        xs.push(span[0])
      }
    }
  }
  return xs
}
