import { usePalette } from '@jbrowse/core/ui/PaletteContext'

import { clampStrokeInsideAxis } from './yScaleTicks.ts'

import type { YScaleTicks } from './yScaleTicks.ts'

// Not an `observer`, and deliberately: there is nothing here to observe. Every
// caller already reads `model.ticks` inside its own observer and hands the
// resolved plain object down, and `usePalette` is a React context, not MobX.
// Wrapping it anyway allocated a Reaction per instance — multi-wiggle renders
// one per sample row, on screen as well as in export — and, per CLAUDE.md, put
// the component out of `babel-plugin-react-compiler`'s reach, so it got neither
// the MobX tracking it doesn't need nor the memoization it does. Its sibling
// `CrossHatchLines`, consuming the same ticks, is already plain.
export default function YScaleBar({
  ticks,
  orientation,
}: {
  ticks: YScaleTicks | undefined
  orientation?: 'left' | 'right'
}) {
  const palette = usePalette()
  if (!ticks) {
    return null
  }
  const { items, yTop, yBottom } = ticks
  const bg = palette.background.default
  const fg = palette.text.primary
  const isLeft = orientation !== 'right'
  const k = isLeft ? -1 : 1
  const tickLength = 6
  // Crispen to `y + 0.5` so each 1px stroke fills one pixel instead of
  // straddling two, then clamp, which only bites at the bottom edge: there the
  // stroke goes on the last pixel inside the box rather than the first one
  // below it. The tick and its label share the transform so they can't split.
  const strokeY = (y: number) => clampStrokeInsideAxis(y + 0.5, yBottom)
  return (
    <g
      fontSize={10}
      textAnchor={isLeft ? 'end' : 'start'}
      stroke={fg}
      strokeWidth={1}
    >
      <path
        fill="none"
        d={`M${k * tickLength} ${strokeY(yTop)}H0.5V${strokeY(yBottom)}H${k * tickLength}`}
      />
      {items.map(({ value, y, label }) => (
        <g key={`${value}-${y}`} transform={`translate(0,${strokeY(y)})`}>
          <line x2={k * tickLength} />
          <text
            stroke={bg}
            strokeWidth={2.5}
            paintOrder="stroke"
            fill={fg}
            dy="0.32em"
            x={k * 9}
          >
            {label ?? value}
          </text>
        </g>
      ))}
    </g>
  )
}
