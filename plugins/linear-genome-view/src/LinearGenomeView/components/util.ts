import { clamp } from '@jbrowse/core/util'
import { pxToBp } from '@jbrowse/core/util/Base1DUtils'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'

// getHighlightColor/highlightKey live in core so the dotplot highlight bands can
// share the exact same color and React-key semantics
export { getHighlightColor, highlightKey } from '@jbrowse/core/util/highlights'

// Shared style for elided (collapsed) blocks — striped grey pattern used
// consistently across OverviewScalebar, ScalebarCoordinateLabels, and Gridlines
export const elidedBlockStyles = {
  backgroundColor: '#999',
  backgroundImage:
    'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.5) 1px, rgba(255,255,255,.5) 3px)',
} as const

// The absolute-fill overlays (Gridlines, PaddingBlocks, ZoomTransform) are
// deliberately NOT consolidated onto a shared `position:absolute; inset:0`:
// they leave top/left unset so the box takes its static position, and pinning
// those to 0 moves the layer. On the inline-level Gridlines <svg> that shifted
// every tick off the canvas's grid (caught by the bsv-hg19-pileup snapshot).

export type Cytoband = ReturnType<typeof getCytobands>[number]

export function getCytobands(assembly: Assembly | undefined, refName: string) {
  return (
    assembly?.cytobands
      ?.map(f => ({
        refName: assembly.getCanonicalRefName2(f.get('refName')),
        start: f.get('start'),
        end: f.get('end'),
        type: f.get('gieStain') as string,
        name: f.get('name'),
      }))
      .filter(f => f.refName === refName) ?? []
  )
}

/**
 * The bp under a pixel of the overview strip. The strip spans the whole view,
 * but the overview *layout* is laid out in the pixels after the chromosome-name
 * gutter (cytobandOffset), so a press or hover on that gutter sits left of the
 * layout's own origin. `pxToBp` extrapolates there rather than refusing, and
 * every overview reader took it at face value: the hover and rubberband labels
 * read out an impossible "ctgA:-12,345,678", and a click did nothing at all,
 * silently, because `centerAt` cannot resolve a coordinate that is in no region.
 * Clamping into the layout's own span makes all three name the genome's start,
 * which is what the gutter is adjacent to.
 */
export function overviewPxToBp(
  overview: ViewLayout,
  px: number,
  cytobandOffset: number,
) {
  return pxToBp(overview, clamp(px - cytobandOffset, 0, overview.width - 1))
}

const MIN_DRAG_DISTANCE = 30

export function shouldSwapTracks(
  lastSwapY: number | undefined,
  currentY: number,
  movingDown: boolean,
) {
  return (
    lastSwapY === undefined ||
    (movingDown && currentY > lastSwapY + MIN_DRAG_DISTANCE) ||
    (!movingDown && currentY < lastSwapY - MIN_DRAG_DISTANCE)
  )
}
