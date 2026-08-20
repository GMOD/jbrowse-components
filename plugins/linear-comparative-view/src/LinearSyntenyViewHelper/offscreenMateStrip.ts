import { offscreenMateAt } from '../LinearSyntenyDisplay/drawOffscreenMates.ts'

import type { OffscreenMateData } from '../LinearSyntenyRPC/collectOffscreenMates.ts'

// One level's row of marks: the off-screen mates every display on it fetched,
// and the query-axis ruler to place them against.
export interface OffscreenMateStrip {
  datasets: OffscreenMateData[]
  bpPerPx: number
  offsetPx: number
  minAlignmentLength: number
}

// The structural slice the overlay and the SVG export read, so what decides
// where a mark lands is checkable without a canvas — which jsdom does not give
// one of anyway.
export interface OffscreenMateSource {
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
 * What this level has to mark, and the ruler to mark it against — or undefined
 * when it has nothing, so neither surface mounts a layer for an empty strip.
 *
 * THE LEVEL'S OWN INDEX IS THE QUERY ROW. A synteny level sits between rows
 * `level` and `level + 1`, and these are placed on the query axis because that
 * is the only axis they have — an off-screen mate is precisely an alignment with
 * no position on the row below. Reading the lower row here would draw every mark
 * against the wrong ruler, at a plausible-looking offset that nothing else in
 * the view disagrees with.
 *
 * Every display on the level in ONE value: they paint one strip, so the label
 * placement and the "on top" the pointer answers with have to run across all of
 * them at once.
 */
export function offscreenMateStrip(
  model: OffscreenMateSource,
): OffscreenMateStrip | undefined {
  const { parentView } = model
  const view = parentView.views[model.level]
  if (!parentView.showOffscreenMates || !view) {
    return undefined
  }
  const datasets = model.linearSyntenyDisplays
    .map(d => d.featureData?.offscreenMates)
    .filter(data => data !== undefined)
    .filter(data => data.starts.length > 0)
  if (datasets.length === 0) {
    return undefined
  }
  return {
    datasets,
    bpPerPx: view.bpPerPx,
    offsetPx: view.offsetPx,
    minAlignmentLength: parentView.minAlignmentLength,
  }
}

/**
 * The contig a pointer in the mark strip is over, or undefined.
 *
 * ASKED BY THE LEVEL'S OWN HANDLERS, before the ribbon pick, and answered only
 * in the few pixels the marks occupy — which sit above where any ribbon is
 * drawn, so the pick engine loses nothing. The overlay stays
 * `pointerEvents: none` and does not answer this itself: two hit paths over one
 * band is how a click comes to mean different things depending on which element
 * happened to receive it.
 */
export function offscreenMateHit(
  model: OffscreenMateSource & {
    height: number
    parentView: { width: number }
  },
  x: number,
  y: number,
) {
  const strip = offscreenMateStrip(model)
  return strip
    ? offscreenMateAt(
        { ...strip, width: model.parentView.width, height: model.height },
        x,
        y,
      )?.refName
    : undefined
}
