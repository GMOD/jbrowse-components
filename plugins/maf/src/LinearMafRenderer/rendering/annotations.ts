import type { FrameMarker } from '../../LinearMafDisplay/components/computeVisibleAnnotations.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * Draw per-species CDS frame boxes: one rectangle per `mafFrames` row on its
 * species' row, filled with the reading-frame color. Drawn on the same
 * backend-independent Canvas2D layer as the summary/e-line overlays so the CDS
 * structure composites over the per-species rows.
 *
 * A plain lookup: `frameColorIndex` resolved the frame + strand into a palette
 * slot when the marker was built, so nothing here knows the palette's layout.
 */
export function drawMafAnnotations(
  ctx: Ctx2D,
  markers: FrameMarker[],
  frameColors: (string | undefined)[],
) {
  for (const m of markers) {
    const color = frameColors[m.colorIndex]
    if (color) {
      ctx.fillStyle = color
      ctx.fillRect(m.xLeft, m.rowTop, m.width, m.h)
    }
  }
}
