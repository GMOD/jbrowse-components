import { MIN_HEIGHT_FOR_TEXT } from '@jbrowse/alignments-core'
import { getContrastText } from '@jbrowse/core/ui/palette'

import { LABEL_FONT } from './types.ts'

import type { DeletionMarker } from '../../LinearMafDisplay/components/computeVisibleDeletions.ts'
import type { MafColorPalette } from '../util.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * Draw the deleted-base count centered inside each deletion run, shared by the
 * on-screen `DeletionsOverlay` and the SVG export so the two can't drift (the
 * same marker pattern the other MAF overlays use). The gap cells themselves are
 * painted by the base pass; this only adds the count label, and only where the
 * run is wide/tall enough to fit it. Markers come from `computeVisibleDeletions`
 * (which shares the `forEachDeletion` walk with the hover hit-test).
 *
 * Takes the palette for the same reason `drawMafEmptyLines` and
 * `drawMafInsertions` do, and this was the one marker drawing that didn't: the
 * label sits on the gap cells, which the base pass fills with
 * `palette.gapColor`, and that color is theme-varying in the one direction that
 * matters. It is `palette.deletion` — `#808080` in light, deliberately
 * lightened to `#c8c8c8` in dark so the run reads against a dark track — so a
 * hardcoded white count was invisible on every dark-mode MAF, and on every
 * dark-theme SVG export regardless of the session's own theme.
 */
export function drawMafDeletionLabels(
  ctx: Ctx2D,
  markers: DeletionMarker[],
  palette: MafColorPalette,
) {
  // Resolved before anything touches text state. Setting `ctx.font` makes the
  // browser resolve the canvas element's computed font, which flushes the whole
  // document's pending style recalc — and this overlay draws from a passive
  // effect, right after React committed a frame of dirty inline styles. At the
  // zoom levels where the rows are too short for a letter that was the single
  // most expensive thing in a wheel-zoom profile, spent to draw nothing. Same
  // gate `drawMafInsertions` keeps, and the cheap height test comes first so a
  // culled marker never reaches the measurement.
  const labeled = markers.filter(
    m =>
      m.h >= MIN_HEIGHT_FOR_TEXT &&
      m.width >= LABEL_FONT.measure(String(m.length)) + 2,
  )
  if (labeled.length > 0) {
    ctx.font = LABEL_FONT.css
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // One resolution per draw, not per marker: every run is the same gap color.
    ctx.fillStyle = getContrastText(palette.gapColor)
    for (const m of labeled) {
      ctx.fillText(
        String(m.length),
        m.xLeft + m.width / 2,
        Math.round(m.rowTop + m.h / 2),
      )
    }
  }
}
