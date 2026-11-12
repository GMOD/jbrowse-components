import Crosshairs from '@jbrowse/core/ui/Crosshairs'
import { observer } from 'mobx-react'

import { sidebarCovers } from './sidebarBounds.ts'

import type { SidebarBounds } from './sidebarBounds.ts'

// Above the track content and its overlays, below the app chrome.
const CROSSHAIR_Z_INDEX = 800

/**
 * Cursor crosshair for a sidebar display, with every dimension derived from the
 * model: the guides span the track, and the vertical one is dropped over the
 * sidebar (`sidebarBounds`), where a genomic position means nothing. Over a band
 * above the rows but left of the sidebar's edge it runs down to the sidebar's
 * top. A guide without `mouseY` counts the pointer as in the rows.
 *
 * Beside `sidebarBounds` because it reads that edge, so every display's
 * crosshair takes the same props and z-index.
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
    sidebarBounds: SidebarBounds
  }
  mouseX: number
  // omit for a vertical-only guide
  mouseY?: number
}) {
  const { sidebarBounds } = model
  const covered = sidebarCovers(
    sidebarBounds,
    mouseX,
    mouseY ?? sidebarBounds.top,
  )
  const aboveSidebar = !covered && mouseX < sidebarBounds.right
  return (
    <Crosshairs
      mouseX={mouseX}
      mouseY={mouseY}
      width={model.canvasWidthPx}
      height={aboveSidebar ? sidebarBounds.top : model.height}
      minLeft={covered ? sidebarBounds.right : 0}
      zIndex={CROSSHAIR_Z_INDEX}
    />
  )
})
