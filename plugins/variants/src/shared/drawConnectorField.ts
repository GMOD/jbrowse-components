import { connectorLineAlpha } from './connectorLineAlpha.ts'

import type { ConnectorCoord } from './ConnectorLines.tsx'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

function round(px: number) {
  return Math.round(px * 100) / 100
}

/**
 * The faint field of connector lines, from each column center at
 * `lineZoneHeight` up to its genomic position at y=0.
 *
 * **One `stroke()` per line, and that is the whole point.** A rasterizer
 * composites a stroked path ONCE, so every line put into a single path (or a
 * single SVG `<path>` with 13,000 subpaths, which is what this used to be)
 * unions rather than accumulates: a pixel two hundred lines deep comes out the
 * same grey as a pixel one line deep, and the field draws as flat polygons with
 * hard edges where the union boundary falls. Stroking each line separately is
 * what makes density visible, and is why `connectorLineAlpha` has anything to
 * hold constant.
 *
 * `rgbaColor` folds the per-line alpha in, because `SvgCanvas` deliberately has
 * no `globalAlpha`.
 */
export function drawConnectorField(
  ctx: Ctx2D,
  coords: ConnectorCoord[],
  lineZoneHeight: number,
  strokeWidth: number,
  rgbaColor: string,
) {
  ctx.strokeStyle = rgbaColor
  ctx.lineWidth = strokeWidth
  for (const { mx, gx } of coords) {
    ctx.beginPath()
    // 2dp, not the raw float: a column center is (i + 0.5) * pitch, so most of
    // these serialize as 17 digits, and at 10^4 lines that is megabytes of a
    // vector SVG export spent below a hundredth of a pixel
    ctx.moveTo(round(mx), lineZoneHeight)
    ctx.lineTo(round(gx), 0)
    ctx.stroke()
  }
}

/**
 * The per-line alpha this field draws at: its density is measured over the
 * lines' OWN horizontal extent (not the view width) so a dense cluster in a
 * narrow band fades like the dense thing it is.
 */
export function connectorFieldAlpha(
  coords: ConnectorCoord[],
  strokeWidth: number,
) {
  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  // indexed min/max rather than Math.max(...xs): coords runs to ~10^4 entries
  // on a pangenome VCF, past what a spread can pass as arguments
  for (const { mx, gx } of coords) {
    lo = Math.min(lo, mx, gx)
    hi = Math.max(hi, mx, gx)
  }
  return connectorLineAlpha(coords.length, hi - lo, strokeWidth)
}
