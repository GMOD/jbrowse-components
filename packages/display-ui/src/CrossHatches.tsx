import { clampStrokeInsideAxis } from './yScaleTicks.ts'

import type { YScaleTicks } from './yScaleTicks.ts'

// Bare <line> set for the Y-scale tick guide lines, no wrapping <svg>. Shared by
// the absolutely-positioned on-screen CrossHatches overlay and the flat SVG
// export, so the two can't drift. `offsetY` is the band's top.
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
      {ticks.items.map(({ value, y }) => {
        // Same clamp the axis ticks take, so a guide line and the tick it
        // belongs to can't disagree at the bottom edge — where, in multi-wiggle,
        // "one pixel lower" is the next sample's row. Only that edge moves; the
        // guide lines don't crispen to a half pixel the way the axis does.
        const lineY = offsetY + clampStrokeInsideAxis(y, ticks.yBottom)
        return (
          <line
            key={`${value}-${y}`}
            x1={0}
            x2={width}
            y1={lineY}
            y2={lineY}
            stroke="rgb(200,200,200)"
            // a separate stroke-opacity attribute (not baked into an rgba()
            // string) survives the SVG export, whose renderToStaticMarkup strips
            // rgba() alpha
            strokeOpacity={0.8}
            strokeWidth={1}
          />
        )
      })}
    </>
  )
}

// Horizontal guide lines at each Y-scale tick, once per band the scale rules.
// Pointer-events disabled so the underlying canvas still receives mouse events.
export default function CrossHatches({
  ticks,
  width,
  height,
  bandTops,
}: {
  ticks: YScaleTicks
  width: number
  height: number
  bandTops: number[]
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
      {bandTops.map(top => (
        <CrossHatchLines key={top} ticks={ticks} width={width} offsetY={top} />
      ))}
    </svg>
  )
}
