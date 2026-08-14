import {
  axisPlotBox,
  clampStrokeInsideAxis,
  scoreToAxisY,
} from '@jbrowse/wiggle-core'

// Screen y for a score on the display's own domain, or undefined when the score
// falls outside it. Outside is a real case rather than a guard: the domain is
// the loaded regions' min/max, so zooming to a quiet stretch of a scan can put
// the threshold above everything on screen, and a line pinned to the top edge
// there would read as "the whole view is significant".
export function significanceLineY(
  score: number | undefined,
  domain: [number, number] | undefined,
  height: number,
) {
  if (score === undefined || !domain) {
    return undefined
  }
  const [min, max] = domain
  if (max === min || score < min || score > max) {
    return undefined
  }
  const box = axisPlotBox(height)
  return clampStrokeInsideAxis(
    scoreToAxisY((score - min) / (max - min), box),
    box.yBottom,
  )
}

// The bare <line>, no wrapping <svg>, so the on-screen overlay and the SVG
// export draw the same element from the same y. Same split as CrossHatchLines,
// and for the same reason: two copies of a threshold line drift, and a figure
// exported at a different threshold than the one on screen is the kind of wrong
// nobody looks twice at.
export function SignificanceLineMark({
  y,
  width,
}: {
  y: number
  width: number
}) {
  return (
    <line
      x1={0}
      x2={width}
      y1={y}
      y2={y}
      stroke="rgb(200,60,60)"
      // separate attribute rather than an rgba() string: renderToStaticMarkup
      // strips rgba() alpha out of the SVG export
      strokeOpacity={0.9}
      strokeWidth={1}
      strokeDasharray="4 3"
    />
  )
}

// Pointer-events disabled so the canvas underneath still gets mouse events,
// matching CrossHatches.
export default function SignificanceLine({
  y,
  width,
  height,
}: {
  y: number
  width: number
  height: number
}) {
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        height,
        width,
      }}
    >
      <SignificanceLineMark y={y} width={width} />
    </svg>
  )
}
