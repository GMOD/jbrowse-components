import type { YScaleTicks } from './index.ts'

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
      {ticks.items.map(({ value, y }, i) => (
        <line
          key={`${value}-${y}-${i}`}
          x1={0}
          x2={width}
          y1={y}
          y2={y}
          stroke="rgba(200,200,200,0.8)"
          strokeWidth={1}
        />
      ))}
    </svg>
  )
}
