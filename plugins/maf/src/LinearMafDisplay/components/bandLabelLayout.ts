import { YSCALE_AXIS_WIDTH } from './MafYScaleGutter.tsx'

/**
 * Where a band title sits and how big it is, shared by the on-screen labels and
 * the SVG export so the two can't drift. Its own module rather than an export
 * off `MafBandLabels.tsx`: that file is a `.tsx` component the export path has
 * no other reason to pull in.
 *
 * Just clear of the Y-axis gutter the two bands share.
 */
export const BAND_LABEL_X = YSCALE_AXIS_WIDTH + 2
export const BAND_LABEL_FONT_SIZE = 9

/**
 * Baseline for a band title whose band starts at `top`. The on-screen label is
 * a block element with 1px of padding above it, so the text's baseline lands
 * about a font-size below the band edge; SVG `<text>` is positioned by that
 * baseline directly and needs the offset spelled out.
 */
export function bandLabelBaselineY(top: number) {
  return top + BAND_LABEL_FONT_SIZE + 1
}
