import type { YScaleTicks } from '@jbrowse/wiggle-core'

// Horizontal guide lines at each YScaleBar tick. Pointer-events disabled so
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
      {ticks.ticks.map(({ value, y }) => (
        <line
          key={value}
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
