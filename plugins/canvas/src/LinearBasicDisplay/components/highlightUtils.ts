// JBrowse's own `alpha`, not Material UI's: the pure Canvas2D painter and the
// SVG export reach this module and neither should drag @mui/material along.
import { alpha } from '@jbrowse/core/ui/palette'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'

import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

export function highlightBoxColors(highlightMain: string) {
  return {
    border: alpha(highlightMain, 0.9),
    fill: alpha(highlightMain, 0.25),
  }
}

// undefined means the item contributes no pixels to this region. A feature that
// merely touches the region edge clamps to zero width, and `computeOverlayRect`
// would inflate that into a phantom stripe at the neighbour's edge; a genuinely
// zero-length feature landing inside the region keeps its zero width.
export function overlayItemRect(
  item: { startBp: number; endBp: number; topPx: number; bottomPx: number },
  vr: BpRegionBounds,
) {
  const toScreen = makeBpMapper(vr)
  const px1 = toScreen(item.startBp)
  const px2 = toScreen(item.endBp)
  const leftPx = Math.max(vr.screenStartPx, Math.min(px1, px2))
  const rightPx = Math.min(vr.screenEndPx, Math.max(px1, px2))
  const clampedToNothing =
    rightPx < leftPx || (rightPx === leftPx && item.endBp > item.startBp)
  return clampedToNothing
    ? undefined
    : {
        leftPx,
        width: rightPx - leftPx,
        topPx: item.topPx,
        heightPx: item.bottomPx - item.topPx,
      }
}

// ScrollLockedOverlay clips at content y=0, so the outset top clamps there or a
// top-row feature's box loses its top border.
export function computeOverlayRect(
  rect: { leftPx: number; topPx: number; width: number; heightPx: number },
  extraWidth: number,
  xPadding: number,
  yPadding: number,
) {
  const outsetTop = rect.topPx - yPadding
  const top = Math.max(0, outsetTop)
  return {
    left: rect.leftPx - xPadding,
    top,
    width: rect.width + extraWidth + xPadding * 2,
    height: rect.heightPx + yPadding * 2 - (top - outsetTop),
  }
}
