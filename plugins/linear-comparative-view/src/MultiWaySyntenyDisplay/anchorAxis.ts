import { clipToDisplayedRegions } from '@jbrowse/core/util/Base1DUtils'

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
