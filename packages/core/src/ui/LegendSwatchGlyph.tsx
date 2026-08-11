import { svgSafeId } from '../svg/svgId.ts'

import type { LegendSwatch } from './legendSpec.ts'

// A gradient's paint id, derived from its stops rather than from a counter or a
// caller-supplied name. The glyph is a leaf — it is handed one swatch and knows
// nothing about the document it lands in — so a unique id has to come from
// somewhere, and the stops are the only thing available. Deriving from them is
// better than a counter anyway: two rows keying the SAME ramp resolve to one
// `<defs>` entry with identical content, which is the only case where a repeat
// is possible at all, and interchangeable when it happens. Distinct ramps get
// distinct ids because the mapping is injective (see svgSafeId).
function gradientId(stops: string[]) {
  return svgSafeId(`jb-legend-ramp-${stops.join('_')}`)
}

// The one place that decides what each `LegendMark` looks like. Returns bare SVG
// shapes rather than a rooted <svg>, so the floating legend (which wraps them in
// an inline <svg>) and the SVG export (which drops them into a row <g>) draw the
// identical glyph — a display's on-screen key and its exported figure disagreeing
// about which color is a curve would be worse than neither having marks.
//
// A ramp-filled swatch emits its own `<defs>` next to the shape, which is legal
// anywhere in an SVG subtree and so needs nothing from either host.
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
  const { color, mark = 'fill', gradient } = swatch
  // A ramp needs two ends to be a ramp; anything shorter is just the flat color
  // it already carries.
  const stops = gradient && gradient.length > 1 ? gradient : undefined
  const id = stops ? gradientId(stops) : undefined
  const paint = id ? `url(#${id})` : color
  // Emitted alongside whichever shape is returned below, so every mark can be
  // ramp-filled rather than only the square.
  const defs = stops ? (
    <defs>
      <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
        {stops.map((stop, i) => (
          <stop
            // eslint-disable-next-line @eslint-react/no-array-index-key
            key={`${stop}-${i}`}
            offset={`${(i / (stops.length - 1)) * 100}%`}
            style={{ stopColor: stop }}
          />
        ))}
      </linearGradient>
    </defs>
  ) : null
  // Thin enough to read as a stroke next to a solid block, thick enough to
  // carry a color at 10-12px.
  const strokeWidth = Math.max(2, Math.round(size / 5))
  if (mark === 'line') {
    return (
      <>
        {defs}
        <line
          x1={x}
          x2={x + size}
          y1={y + size / 2}
          y2={y + size / 2}
          stroke={paint}
          strokeWidth={strokeWidth}
        />
      </>
    )
  }
  if (mark === 'curve') {
    // An arc bulging up out of the box's lower corners, which is the shape of
    // the connector itself — a pair of endpoints with the curve between them.
    const inset = strokeWidth / 2
    return (
      <>
        {defs}
        <path
          d={`M${x},${y + size - inset} Q${x + size / 2},${y - size / 3} ${x + size},${y + size - inset}`}
          fill="none"
          stroke={paint}
          strokeWidth={strokeWidth}
        />
      </>
    )
  }
  return (
    <>
      {defs}
      <rect x={x} y={y} width={size} height={size} fill={paint} />
    </>
  )
}
