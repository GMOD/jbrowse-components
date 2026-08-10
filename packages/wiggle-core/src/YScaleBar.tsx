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
// Half the vertical space a 10px label needs, halo included: digits reach about
// 3.6px above the centered baseline and the 2.5px-wide background stroke another
// 1.25px past that.
const LABEL_HALF_HEIGHT_PX = 5

export default function YScaleBar({
  ticks,
  orientation,
  insetLabels,
}: {
  ticks: YScaleTicks | undefined
  orientation?: 'left' | 'right'
  // Keep each label's text box inside [yTop, yBottom] instead of centering it on
  // its tick. For an axis whose box is inset from what it's drawn on (every
  // single-row wiggle-family display reserves YSCALEBAR_LABEL_OFFSET at both
  // ends) a centered end label already fits, so this is off by default. It is
  // for multi-wiggle, which stacks a full-height axis per row with no inset: the
  // end labels there are centered on the row boundary, which puts the first
  // row's top label and the last row's bottom label half outside the track —
  // clipped away by the <svg> — and at every boundary in between draws one row's
  // domain-min on top of the next row's domain-max, so the halo of whichever
  // paints second erases the other.
  insetLabels?: boolean
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
  // below it.
  const strokeY = (y: number) => clampStrokeInsideAxis(y + 0.5, yBottom)
  // The tick keeps the group transform; only the text moves off it, and only
  // under `insetLabels` within half a label of an end. A tick is where the data
  // is, so it never moves — the label is then drawn against the tick rather than
  // across it, which is what any axis does at the edge of its own frame.
  // `undefined` rather than 0 for the labels that don't move, so the markup this
  // emits is unchanged wherever the inset doesn't apply.
  const labelDy = (sy: number) => {
    if (!insetLabels) {
      return undefined
    }
    const inset = Math.min(
      Math.max(sy, yTop + LABEL_HALF_HEIGHT_PX),
      yBottom - LABEL_HALF_HEIGHT_PX,
    )
    return inset === sy ? undefined : inset - sy
  }
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
            y={labelDy(strokeY(y))}
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
