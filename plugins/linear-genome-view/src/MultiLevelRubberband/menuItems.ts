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
