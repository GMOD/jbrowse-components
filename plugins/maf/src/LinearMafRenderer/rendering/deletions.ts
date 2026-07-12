import { MIN_HEIGHT_FOR_TEXT } from '@jbrowse/alignments-core'
import { measureText } from '@jbrowse/core/util'

import { FONT_CONFIG } from './types.ts'

import type { DeletionMarker } from '../../LinearMafDisplay/components/computeVisibleDeletions.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * Draw the deleted-base count centered inside each deletion run, shared by the
 * on-screen `DeletionsOverlay` and the SVG export so the two can't drift (the
 * same marker pattern the other MAF overlays use). The gap cells themselves are
 * painted by the base pass; this only adds the count label, and only where the
 * run is wide/tall enough to fit it. Markers come from `computeVisibleDeletions`
 * (which shares the `forEachDeletion` walk with the hover hit-test).
 */
export function drawMafDeletionLabels(ctx: Ctx2D, markers: DeletionMarker[]) {
  ctx.font = FONT_CONFIG
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'white'
  for (const m of markers) {
    const text = String(m.length)
    if (m.width >= measureText(text) + 2 && m.h >= MIN_HEIGHT_FOR_TEXT) {
      ctx.fillText(text, m.xLeft + m.width / 2, Math.round(m.rowTop + m.h / 2))
    }
  }
}
