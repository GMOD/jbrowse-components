import { connectorLineAlpha } from './connectorLineAlpha.ts'

import type { ConnectorCoord } from './ConnectorLines.tsx'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

function round(px: number) {
  return Math.round(px * 100) / 100
}

/**
 * The faint field of connector lines, from each column center at
 * `connectorsHeight` up to its genomic position at y=0.
 *
 * **One `stroke()` per line.** A rasterizer composites a stroked path ONCE, so
 * every line put into a single path (or a single SVG `<path>` with 13,000
 * subpaths) unions rather than accumulates: a pixel two hundred lines deep comes
 * out the same grey as a pixel one line deep, and the field draws as flat
 * polygons with hard edges where the union boundary falls. Stroking each line
 * separately makes density visible, and gives `connectorLineAlpha` something to
 * hold constant.
 *
 * `rgbaColor` folds the per-line alpha in, because `SvgCanvas` deliberately has
 * no `globalAlpha`.
 */
export function drawConnectorField(
  ctx: Ctx2D,
  coords: ConnectorCoord[],
  connectorsHeight: number,
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
    ctx.moveTo(round(mx), connectorsHeight)
    ctx.lineTo(round(gx), 0)
    ctx.stroke()
  }
}

/**
 * The per-line alpha this field draws at: its density is measured over the
 * lines' OWN horizontal extent (not the view width) so a dense cluster in a
 * narrow band fades like the dense thing it is. Only the part of each line
 * inside `[0, width]` counts: a deletion that starts 10^5 px off to the left
 * still has a line, and its far end must not spread the field's ink budget
 * over pixels nobody sees.
 */
export function connectorFieldAlpha(
  coords: ConnectorCoord[],
  strokeWidth: number,
  width: number,
) {
  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  let count = 0
  // indexed min/max rather than Math.max(...xs): coords runs to ~10^4 entries
  // on a pangenome VCF, past what a spread can pass as arguments
  for (const { mx, gx } of coords) {
    const left = Math.max(Math.min(mx, gx), 0)
    const right = Math.min(Math.max(mx, gx), width)
    if (left <= right) {
      lo = Math.min(lo, left)
      hi = Math.max(hi, right)
      count++
    }
  }
  return connectorLineAlpha(count, hi - lo, strokeWidth)
}
