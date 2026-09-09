import { AXIS_GUTTER_WIDTH_PX } from './yScaleTicks.ts'

import type { ValueScale } from './valueScale.ts'

/**
 * Below this band height a full `YScaleBar`'s tick labels overlap each other,
 * so the chrome draws one `ScoreDomainCaption` for the scale instead of an
 * axis per band. Its own module because `YScaleBar`'s label geometry is what
 * makes 30 the number.
 */
export const COMPACT_AXIS_HEIGHT = 30

/**
 * Whether a scale gets an axis at all: it rules at least one band, and the
 * band has room for tick labels. A scale that fails either is captioned.
 */
export function axisDrawn(scale: Pick<ValueScale, 'height' | 'bandTops'>) {
  return (
    (scale.bandTops?.length ?? 1) > 0 && scale.height >= COMPACT_AXIS_HEIGHT
  )
}

/** How far in from the plot's right edge a right-side gutter ends in an export. */
export const AXIS_RIGHT_INSET_PX = 4

/**
 * Left edge of the gutter an axis is drawn in. A right-side axis takes the
 * gutter inside the plot's right edge, less `rightInset` (the vertical
 * scrollbar a display may mount on screen; a margin in an export). A left-side
 * axis takes the gutter at the display's left edge, past whatever panel the
 * scale's `left` reserves — except in an export, whose margin is the gutter,
 * so an axis nothing pushes right sits in the margin with its spine on the
 * content edge and its numbers outside the plot.
 */
export function axisGutterLeft(
  scale: Pick<ValueScale, 'side' | 'left'>,
  width: number,
  rightInset: number,
  exportContentLeft?: number,
) {
  if (scale.side === 'right') {
    return width - rightInset - AXIS_GUTTER_WIDTH_PX
  }
  const left = scale.left ?? 0
  return exportContentLeft !== undefined && left === 0
    ? exportContentLeft - AXIS_GUTTER_WIDTH_PX
    : left
}
