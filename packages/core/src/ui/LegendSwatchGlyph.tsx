import type { LegendSwatch } from './legendSpec.ts'

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
  return <rect x={x} y={y} width={size} height={size} fill={swatch.color} />
}
