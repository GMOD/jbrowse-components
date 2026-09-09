import { appendGlyph } from '@jbrowse/render-core/marks/glyphPaint'
import { DIAMOND_GLYPH_SCALE } from '@jbrowse/render-core/shaders/pointMarkConsts'

import { GLYPH_CODES } from '../util/glyphNames.ts'

import type { GlyphName } from '../util/markEncodingTypes.ts'
import type { LegendSwatch } from './legendSpec.ts'
import type { GlyphPath } from '@jbrowse/render-core/marks/glyphPaint'

// The point shape's own painter, recorded as SVG path data, so the key draws
// the glyph the plot draws. The diamond paints wider than its diameter and
// is scaled down to fit the box.
function glyphPathData(glyph: GlyphName, size: number, x: number, y: number) {
  const d: string[] = []
  const path: GlyphPath = {
    moveTo: (px, py) => d.push(`M${px} ${py}`),
    lineTo: (px, py) => d.push(`L${px} ${py}`),
    closePath: () => d.push('Z'),
    rect: (px, py, w, h) => d.push(`M${px} ${py}h${w}v${h}h${-w}Z`),
    arc: (cx, cy, r) =>
      d.push(
        `A${r} ${r} 0 1 0 ${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}Z`,
      ),
  }
  const diameter = glyph === 'diamond' ? size / DIAMOND_GLYPH_SCALE : size
  appendGlyph(path, GLYPH_CODES[glyph], x + size / 2, y + size / 2, diameter)
  return d.join('')
}

// The one place that decides what a legend swatch looks like. Returns a bare
// shape rather than a rooted <svg>, so the floating legend (which wraps it in an
// inline <svg>) and the SVG export (which drops it into a row <g>) draw the
// identical box.
//
// The shape fills the `size` box from (x, y) so a caller can lay swatches out on
// a fixed pitch.
export function LegendSwatchGlyph({
  swatch,
  size,
  x = 0,
  y = 0,
}: {
  swatch: LegendSwatch
  size: number
  x?: number
  y?: number
}) {
  return swatch.glyph ? (
    <path d={glyphPathData(swatch.glyph, size, x, y)} fill={swatch.color} />
  ) : (
    <rect x={x} y={y} width={size} height={size} fill={swatch.color} />
  )
}
