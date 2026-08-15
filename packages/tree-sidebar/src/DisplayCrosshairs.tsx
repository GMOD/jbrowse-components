import { Crosshairs } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import { treeSidebarRightEdge } from './treeSidebarGeometry.ts'

// Above the track content and its overlays, below the app chrome.
const CROSSHAIR_Z_INDEX = 800

/**
 * Cursor crosshair for a sidebar display, with every dimension derived from the
 * model: the guides span the track, and the vertical one stops at the sidebar's
 * right edge (handle included) where a genomic position means nothing.
 *
 * Lives here because that edge does. Every display that grew a crosshair
 * re-derived the same four props and re-picked the z-index, and they had already
 * drifted on the width.
 *
 * `canvasWidthPx` off the model rather than `trackWidthPx` off the view, for the
 * same reason `height` comes off the model: a shared component reading the view
 * directly answers the width question a second way, and cannot follow a display
 * that overrides it. See `MultiRegionDisplayMixin.canvasWidthPx`.
 */
export const DisplayCrosshairs = observer(function DisplayCrosshairs({
  model,
  mouseX,
  mouseY,
}: {
  model: {
    canvasWidthPx: number
    height: number
    showTree: boolean
    hierarchy?: unknown
    treeAreaWidth: number
  }
  mouseX: number
  mouseY: number
}) {
  return (
    <Crosshairs
      mouseX={mouseX}
      mouseY={mouseY}
      width={model.canvasWidthPx}
      height={model.height}
      minLeft={treeSidebarRightEdge(model)}
      zIndex={CROSSHAIR_Z_INDEX}
    />
  )
})
