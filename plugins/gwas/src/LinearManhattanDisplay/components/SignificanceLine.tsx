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
