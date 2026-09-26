import { rowLabels } from './rowLabel.ts'

import type { LinearGenomeViewModel } from '../LinearGenomeView/model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

/**
 * One row per genome row, each holding that row's own rubberband menu — Get
 * sequence, Copy range, Highlight region, and whatever a plugin contributes
 * under Launch.
 *
 * A drag on the multi-level strip commits offsets on EVERY row (see
 * `useRangeSelect`), so each row's `rubberBandMenuItems()` already describes a
 * real selection and was simply never offered: the stacked views' menu held
 * "Zoom to region(s)" and nothing else, while the same drag in a plain linear
 * genome view offered five actions. Per row rather than applied across rows
 * because each row is its own assembly — one sequence to fetch, one range to
 * copy, one highlight to place — so there is no "all rows" answer to give.
 *
 * Zoom is the exception and stays where each view already has it: zooming every
 * row at once is what the gesture means, and the synteny view holds its follow
 * anchor across the loop.
 */
export function multiLevelRowMenuItems(
  views: LinearGenomeViewModel[],
): MenuItem[] {
  return rowLabels(views).map((label, idx) => ({
    label,
    subMenu: views[idx]!.rubberBandMenuItems(),
  }))
}

/**
 * The same per-row rows for a bare CLICK on the strip rather than a drag — each
 * row's Center view here, Zoom to base level and Copy coordinate, at the base
 * that row paints under `px`.
 *
 * No all-rows row above them, unlike the drag's "Zoom to region(s)". A drag
 * names a span in pixels and every row can act on it; a click names a
 * COORDINATE, and the rows are different assemblies, so which genome's base the
 * pointer is over is the question the menu has to ask rather than answer.
 *
 * `px` rather than a resolved offset: each row maps the pixel through its own
 * `pxToBp`, so there is no one offset to pass.
 */
export function multiLevelRowClickMenuItems(
  views: LinearGenomeViewModel[],
  px: number,
): MenuItem[] {
  return rowLabels(views).flatMap((label, idx) => {
    const view = views[idx]!
    // A row with no regions is dropped, because `pxToBp` THROWS on one rather
    // than answering an offset that names no base — so gating on the built
    // submenu being empty, which is what this did, was a guard that could never
    // fire in front of a call that had already thrown. Reachable: a row's
    // `initialized` is assembly readiness, and the stack mounts this strip once
    // ANY row is ready.
    if (!view.displayedRegions.length) {
      return []
    }
    return [{ label, subMenu: view.rubberbandClickMenuItems(view.pxToBp(px)) }]
  })
}
