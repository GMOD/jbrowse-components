import type { LegendSwatch } from './legendSpec.ts'

// The one place that decides what each `LegendMark` looks like. Returns bare SVG
// shapes rather than a rooted <svg>, so the floating legend (which wraps them in
// an inline <svg>) and the SVG export (which drops them into a row <g>) draw the
// identical glyph — a display's on-screen key and its exported figure disagreeing
// about which color is a curve would be worse than neither having marks.
//
// Every shape fills the `size` box from (x, y) so a caller can lay swatches out
// on a fixed pitch without knowing which mark it is placing.
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
  const { color, mark = 'fill' } = swatch
  // Thin enough to read as a stroke next to a solid block, thick enough to
  // carry a color at 10-12px.
  const strokeWidth = Math.max(2, Math.round(size / 5))
  if (mark === 'line') {
    return (
      <line
        x1={x}
        x2={x + size}
        y1={y + size / 2}
        y2={y + size / 2}
        stroke={color}
        strokeWidth={strokeWidth}
      />
    )
  }
  if (mark === 'curve') {
    // An arc bulging up out of the box's lower corners, which is the shape of
    // the connector itself — a pair of endpoints with the curve between them.
    const inset = strokeWidth / 2
    return (
      <path
        d={`M${x},${y + size - inset} Q${x + size / 2},${y - size / 3} ${x + size},${y + size - inset}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
      />
    )
  }
  return <rect x={x} y={y} width={size} height={size} fill={color} />
}
