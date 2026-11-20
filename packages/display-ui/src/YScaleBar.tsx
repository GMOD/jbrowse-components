import { usePalette } from '@jbrowse/core/ui/PaletteContext'

import { SvgHaloText, TEXT_BASELINE_RATIO } from './FloatingText.tsx'
import { AXIS_FONT_PX, TICK_LABEL_X_PX } from './yAxisConstants.ts'
import { clampStrokeInsideAxis } from './yScaleTicks.ts'

import type { YScaleTicks } from './yScaleTicks.ts'

// Half the vertical space a 10px label needs, halo included: digits reach about
// 3.6px above the centered baseline and the 2.5px-wide background stroke another
// 1.25px past that.
const LABEL_HALF_HEIGHT_PX = 5

const LABEL_BASELINE_DROP_PX = AXIS_FONT_PX * (TEXT_BASELINE_RATIO - 0.5)

// eslint-disable-next-line no-restricted-syntax -- drawn inside a frozen SVG figure
export default function YScaleBar({
  ticks,
  orientation,
  bandHeight,
}: {
  ticks: YScaleTicks | undefined
  orientation?: 'left' | 'right'
  // Keep each label's text box inside the band [0, bandHeight] instead of
  // centering it on its tick. A no-op for a box inset by YSCALEBAR_LABEL_OFFSET
  // at both ends, where a centered end label already fits; it is for rows that
  // stack edge to edge (multi-wiggle), whose end labels are centered on the row
  // boundary — the first row's top label and the last row's bottom label half
  // outside the track, clipped away by the <svg>, and at every boundary between
  // one row's domain-min drawn on top of the next row's domain-max, so the halo
  // of whichever paints second erases the other.
  bandHeight?: number
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
  // under `bandHeight` within half a label of an end. A tick is where the data
  // is, so it never moves — the label is then drawn against the tick rather than
  // across it, which is what any axis does at the edge of its own frame.
  const labelDy = (sy: number) => {
    const inset =
      bandHeight === undefined
        ? sy
        : Math.min(
            Math.max(sy, LABEL_HALF_HEIGHT_PX),
            bandHeight - LABEL_HALF_HEIGHT_PX,
          )
    return inset - sy
  }
  return (
    <g>
      <path
        fill="none"
        stroke={fg}
        strokeWidth={1}
        d={`M${k * tickLength} ${strokeY(yTop)}H0.5V${strokeY(yBottom)}H${k * tickLength}`}
      />
      {items.map(({ value, y, label }) => (
        <g key={`${value}-${y}`} transform={`translate(0,${strokeY(y)})`}>
          <line x2={k * tickLength} stroke={fg} strokeWidth={1} />
          <SvgHaloText
            x={k * TICK_LABEL_X_PX}
            y={labelDy(strokeY(y)) + LABEL_BASELINE_DROP_PX}
            fill={fg}
            halo={bg}
            haloWidth={2.5}
            fontSize={AXIS_FONT_PX}
            anchor={isLeft ? 'end' : 'start'}
          >
            {label ?? value}
          </SvgHaloText>
        </g>
      ))}
    </g>
  )
}
