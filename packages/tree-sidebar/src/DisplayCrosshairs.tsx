import { Crosshairs } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { treeSidebarRightEdge } from './treeSidebarGeometry.ts'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
 */
export const DisplayCrosshairs = observer(function DisplayCrosshairs({
  model,
  mouseX,
  mouseY,
}: {
  model: {
    height: number
    showTree: boolean
    hierarchy?: unknown
    treeAreaWidth: number
  }
  mouseX: number
  mouseY: number
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  return (
    <Crosshairs
      mouseX={mouseX}
      mouseY={mouseY}
      width={view.trackWidthPx}
      height={model.height}
      minLeft={treeSidebarRightEdge(model)}
      zIndex={CROSSHAIR_Z_INDEX}
    />
  )
})
