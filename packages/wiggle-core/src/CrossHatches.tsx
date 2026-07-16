import type { YScaleTicks } from './index.ts'

// Bare <line> set for the Y-scale tick guide lines, no wrapping <svg>. Shared by
// the absolutely-positioned on-screen CrossHatches overlay and the flat SVG
// export (single- and multi-wiggle), so the three can't drift. `offsetY` shifts
// every line down for per-row rendering in multi-wiggle.
export function CrossHatchLines({
  ticks,
  width,
  offsetY = 0,
}: {
  ticks: YScaleTicks
  width: number
  offsetY?: number
}) {
  return (
    <>
      {ticks.items.map(({ value, y }) => (
        <line
          key={`${value}-${y}`}
          x1={0}
          x2={width}
          y1={offsetY + y}
          y2={offsetY + y}
          stroke="rgb(200,200,200)"
          // a separate stroke-opacity attribute (not baked into an rgba()
          // string) survives the SVG export, whose renderToStaticMarkup strips
          // rgba() alpha
          strokeOpacity={0.8}
          strokeWidth={1}
        />
      ))}
    </>
  )
}

// Horizontal guide lines at each Y-scale tick. Pointer-events disabled so
// the underlying canvas still receives mouse events.
export default function CrossHatches({
  ticks,
  width,
  height,
}: {
  ticks: YScaleTicks
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
      <CrossHatchLines ticks={ticks} width={width} />
    </svg>
  )
}
