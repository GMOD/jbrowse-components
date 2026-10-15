import { bpToPx, clipToDisplayedRegions } from '@jbrowse/core/util/Base1DUtils'

import type { AnchorCoord } from './laneDecision.ts'
import type { Span } from './layoutMultiWay.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
  view: LinearGenomeViewModel,
  refName: string,
  start: number,
  end: number,
): AxisPlacement | undefined {
  const clipped = clipToDisplayedRegions(view, { refName, start, end })
  if (!clipped) {
    return undefined
  }
  const a = view.bpToPx({ refName, coord: clipped.start })
  const b = view.bpToPx({ refName, coord: clipped.end })
  return a === undefined || b === undefined
    ? undefined
    : {
        x1: a.offsetPx,
        x2: b.offsetPx,
        centre: { refName, coord: (clipped.start + clipped.end) / 2 },
      }
}

/** px relative to `originPx`, as a lane's `spanOf` answers */
export function axisSpan(
  view: LinearGenomeViewModel,
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
  view: LinearGenomeViewModel,
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
        bpToPx({ refName, coord, displayedRegionIndex, self: view })!.offsetPx -
        originPx
      out.push([px(s), px(e)])
    }
  })
  return out
}

export function displayedRegionSpans(
  view: LinearGenomeViewModel,
  originPx = view.offsetPx,
): Span[] {
  const { bpPerPx, displayedRegions } = view
  let bp = 0
  return displayedRegions.map(({ start, end, reversed }) => {
    const left = Math.round(bp / bpPerPx) - originPx
    bp += end - start
    const right = Math.round(bp / bpPerPx) - originPx
    return reversed ? [right, left] : [left, right]
  })
}

/**
 * px relative to `originPx` of every `step` bp of the displayed regions that
 * lands in `[lo, hi]`, so a pan, which moves the view and not the origin,
 * keeps the answer
 */
export function axisTickXs(
  view: LinearGenomeViewModel,
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
