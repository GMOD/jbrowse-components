import { offscreenMateAt } from '../LinearSyntenyDisplay/drawOffscreenMates.ts'

import type { OffscreenMateData } from '../LinearSyntenyRPC/collectOffscreenMates.ts'

export interface OffscreenMateStubs {
  data: OffscreenMateData
  bpPerPx: number
  offsetPx: number
  minAlignmentLength: number
}

// The structural slice the overlay and the SVG export read, so what decides
// where a stub lands is checkable without a canvas — which jsdom does not give
// one of anyway.
export interface StubSource {
  level: number
  linearSyntenyDisplays: {
    featureData?: { offscreenMates: OffscreenMateData }
  }[]
  parentView: {
    showOffscreenMates: boolean
    minAlignmentLength: number
    views: { bpPerPx: number; offsetPx: number }[]
  }
}

/**
 * What this level has to mark, and the ruler to mark it against.
 *
 * THE LEVEL'S OWN INDEX IS THE QUERY ROW. A synteny level sits between rows
 * `level` and `level + 1`, and these are placed on the query axis because that
 * is the only axis they have — an off-screen mate is precisely an alignment with
 * no position on the row below. Reading the lower row here would draw every stub
 * against the wrong ruler, at a plausible-looking offset that nothing else in
 * the view disagrees with.
 *
 * Empty when the toggle is off, so the overlay clears its canvas and stops
 * rather than the caller branching around the whole draw.
 */
export function offscreenMateStubs(model: StubSource): OffscreenMateStubs[] {
  const { parentView } = model
  const view = parentView.views[model.level]
  if (!parentView.showOffscreenMates || !view) {
    return []
  }
  const { bpPerPx, offsetPx } = view
  const { minAlignmentLength } = parentView
  return model.linearSyntenyDisplays
    .map(d => d.featureData?.offscreenMates)
    .filter(data => data !== undefined)
    .filter(data => data.starts.length > 0)
    .map(data => ({ data, bpPerPx, offsetPx, minAlignmentLength }))
}

/**
 * The contig a pointer in the stub strip is over, or undefined.
 *
 * ASKED BY THE LEVEL'S OWN HANDLERS, before the ribbon pick, and answered only
 * in the few pixels the stubs occupy — which sit above where any ribbon is
 * drawn, so the pick engine loses nothing. The overlay stays
 * `pointerEvents: none` and does not answer this itself: two hit paths over one
 * band is how a click comes to mean different things depending on which element
 * happened to receive it.
 */
export function offscreenMateHit(
  model: StubSource & { height: number; parentView: { width: number } },
  x: number,
  y: number,
) {
  for (const layout of offscreenMateStubs(model)) {
    const hit = offscreenMateAt(
      { ...layout, width: model.parentView.width, height: model.height },
      x,
      y,
    )
    if (hit?.refName !== undefined) {
      return hit.refName
    }
  }
  return undefined
}
