import { measureText } from '@jbrowse/core/util/measureText'

import {
  AXIS_FONT_PX,
  CAPTION_BAND_PX,
  TICK_LABEL_X_PX,
} from './yAxisConstants.ts'
import { AXIS_GUTTER_WIDTH_PX } from './yScaleTicks.ts'

import type { ValueScale, YAxis } from './valueScale.ts'

/**
 * Below this band height a full `YScaleBar`'s tick labels overlap each other,
 * so the chrome draws one `ScoreDomainCaption` for the scale instead of an
 * axis per band. Its own module because `YScaleBar`'s label geometry is what
 * makes 30 the number.
 */
export const COMPACT_AXIS_HEIGHT = 30

/**
 * Whether a scale places anything by y, which is whether its rules draw: it
 * rules at least one band, where `[]` is a scale mapped to colour instead.
 */
export function rulesABand(scale: Pick<ValueScale, 'bandTops'>) {
  return (scale.bandTops?.length ?? 1) > 0
}

/**
 * Whether a scale gets an axis at all: it rules at least one band, and the
 * band has room for tick labels. A scale that fails either is captioned.
 */
export function axisDrawn(scale: Pick<ValueScale, 'height' | 'bandTops'>) {
  return rulesABand(scale) && scale.height >= COMPACT_AXIS_HEIGHT
}

/**
 * The y a scale's one caption centres on: halfway down the extent of the bands
 * given, from the first's top tick to the last's bottom. One band gives the
 * middle of its own axis.
 */
export function axisCaptionY(axis: Pick<YAxis, 'ticks'>, bandTops: number[]) {
  const { yTop, yBottom } = axis.ticks
  return (Math.min(...bandTops) + yTop + Math.max(...bandTops) + yBottom) / 2
}

/**
 * How wide an axis's gutter is: the ordinary width, grown inward over the plot
 * where a caption and the widest tick label cannot share it, so neither is
 * drawn over the other. The caption keeps the outer edge and the labels stay
 * beside the spine.
 */
export function axisGutterWidth(axis: Pick<YAxis, 'ticks' | 'caption'>) {
  if (!axis.caption) {
    return AXIS_GUTTER_WIDTH_PX
  }
  let widest = 0
  for (const { value, label } of axis.ticks.items) {
    widest = Math.max(widest, measureText(label ?? value, AXIS_FONT_PX))
  }
  return Math.max(
    AXIS_GUTTER_WIDTH_PX,
    Math.ceil(CAPTION_BAND_PX + widest + TICK_LABEL_X_PX),
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
 * so an axis nothing pushes right sits in the margin with its numbers outside
 * the plot and its spine on the content edge, or past it by what
 * `axisGutterWidth` grew.
 */
export function axisGutterLeft(
  axis: Pick<YAxis, 'side' | 'left' | 'ticks' | 'caption'>,
  width: number,
  rightInset: number,
  exportContentLeft?: number,
) {
  if (axis.side === 'right') {
    return width - rightInset - axisGutterWidth(axis)
  }
  const left = axis.left ?? 0
  return exportContentLeft !== undefined && left === 0
    ? exportContentLeft - AXIS_GUTTER_WIDTH_PX
    : left
}
