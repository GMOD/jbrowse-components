import { YScaleBar } from '@jbrowse/wiggle-core'

import { leftAxisSpineX } from '../coverageAxisStyle.ts'
import TlenAxisLabel from './TlenAxisLabel.tsx'
import { sectionKey } from './sectionScreen.ts'

import type { YScaleTicks } from '@jbrowse/wiggle-core'

// x the "TLEN" caption sits at in down mode: left of the tick labels, which grow
// leftward from the spine. Up mode's caption takes TlenAxisLabel's own default,
// which is right of them for the same reason.
const DOWN_MODE_CAPTION_X = 11

/**
 * The read-cloud insert-size (TLEN) axis, laid out inside a box
 * `AXIS_SVG_WIDTH` wide whose left edge is this component's origin. Down
 * mode is left-oriented, so its spine sits at the far side of the box and the
 * numbers grow back across it; up mode is right-oriented and grows out of it.
 *
 * One component rather than a pair, because the on-screen overlay and the SVG
 * export draw the same axis and each supplied its own spine x: the export had
 * drifted to a hardcoded 40 against the overlay's `AXIS_SVG_WIDTH -
 * YSCALEBAR_LABEL_OFFSET`, so every exported figure's TLEN numbers sat 5px left
 * of the ones on screen. Callers now supply only where the box is —
 * {@link insertSizeAxisBoxLeft} on the export, `left: 0` / `right: 0` on screen.
 */
export default function InsertSizeAxis({
  ticks,
  down,
}: {
  ticks: YScaleTicks
  down: boolean
}) {
  const caption = (
    <TlenAxisLabel
      yTop={ticks.yTop}
      yBottom={ticks.yBottom}
      x={down ? DOWN_MODE_CAPTION_X : undefined}
    />
  )
  return down ? (
    <>
      {/* only the axis is nested in the spine translate — wrapping the caption
          in it too would push it past the numbers it labels */}
      <g transform={`translate(${leftAxisSpineX(0)}, 0)`}>
        <YScaleBar ticks={ticks} orientation="left" />
      </g>
      {caption}
    </>
  ) : (
    <>
      <YScaleBar ticks={ticks} orientation="right" />
      {caption}
    </>
  )
}

/**
 * Every reserved arc band's axis, in stacking order, under one shift.
 *
 * One shift for all of them because each section's ticks already carry its own
 * `arcBandTop` in content space, and `bandScreenTop` is affine — so the
 * caller's `bandScreenTop(0, …)` completes the projection for every section at
 * once. Both hosts pass exactly that; what differs is only where the axis box
 * sits, which is `x` (a CSS-anchored 0 on screen, `insertSizeAxisBoxLeft` on
 * the export). Kept together for the reason the single {@link InsertSizeAxis}
 * exists: the last thing these two spelled separately drifted by 5px and every
 * exported figure carried it.
 */
export function InsertSizeAxisStack({
  sections,
  down,
  yShift,
  x = 0,
}: {
  sections: { groupKey: string; ticks: YScaleTicks }[]
  down: boolean
  yShift: number
  x?: number
}) {
  return (
    <g transform={`translate(${x}, ${yShift})`}>
      {sections.map(({ groupKey, ticks }) => (
        <InsertSizeAxis key={sectionKey(groupKey)} ticks={ticks} down={down} />
      ))}
    </g>
  )
}
