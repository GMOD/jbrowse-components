import { getSession } from '@jbrowse/core/util'

import type { LinearGenomeViewModel } from './model.ts'
import type { Region } from '@jbrowse/core/util/types'

/**
 * Replace a view's displayed regions with a set someone asked for, frame them,
 * and offer an Undo that puts the view back exactly as it was.
 *
 * This is the "navigate the view you are looking at" half of a launcher, as
 * against `session.addView`, which opens a second one. Two features do it —
 * plugin-canvas's collapsed introns and plugin-alignments' "view mate region" —
 * and both had their own copy of the same fifteen lines, including the same two
 * decisions worth stating once:
 *
 * - **`fitAllRegions`, not `showAllRegions`.** The caller named the regions it
 *   wants, so it gets the width. `showAllRegions` goes to the zoom-out LIMIT,
 *   whose 10% margin is a framing choice for "show me everything" and dead frame
 *   here — and both of these callers already padded their regions by the context
 *   they wanted, so a second margin is one nothing asked for.
 * - **The captured viewport is a bp WINDOW, not a pixel pair.** A capture and its
 *   Undo can be a window resize apart, and pixels mean nothing without the width
 *   they were measured at. Both copies captured `{bpPerPx, offsetPx}` and
 *   restored through `setNewView`, so undoing after a resize landed somewhere
 *   else. `displayedRegions` rides along by reference: it is a `types.frozen`,
 *   so the array is already immutable and `getSnapshot` would refuse it anyway.
 *
 * `alsoUndo` is for state the caller changed that is not the view's location —
 * the collapsed-intron launch isolates the track to one gene, and an Undo that
 * restored the regions and left the isolation on would be a worse lie than not
 * offering one.
 */
export function showRegionsWithUndo({
  view,
  regions,
  message,
  alsoUndo,
}: {
  view: LinearGenomeViewModel
  regions: Region[]
  message: string
  alsoUndo?: () => void
}) {
  const previous = {
    displayedRegions: view.displayedRegions,
    windowWidthBp: view.windowWidthBp,
    windowStartBp: view.windowStartBp,
  }
  view.showRegions(regions)
  getSession(view).notify(message, 'info', {
    name: 'Undo',
    onClick: () => {
      view.setDisplayedRegions(previous.displayedRegions)
      view.setWindow(previous.windowWidthBp, previous.windowStartBp)
      alsoUndo?.()
    },
  })
}
