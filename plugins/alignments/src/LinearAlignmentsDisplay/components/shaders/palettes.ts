import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'

import { fillColor } from '../../../shared/color.ts'

import type { RGBColor } from './colors.ts'
import type { ArcColorByType } from '../../../shared/types.ts'

// Palette indices match the Slang arc/arcLine shaders
// (u.arcColor0..7 / u.arcLineColor0..1). Canvas2D / SVG arc renderers
// reuse these same arrays. Adding a color here requires growing the Slang
// Uniforms struct and the writeUniforms() palette copy.
export const NUM_ARC_COLORS = 8
export const NUM_LINE_COLORS = 2
// Pixels of padding above the arc apex (must match arc.slang).
export const ARC_HEIGHT_MARGIN = 8

const rgb = cssColorToNormalizedRgb

export const arcColorPalette: RGBColor[] = [
  rgb(fillColor.color_pair_lr),
  rgb(fillColor.color_longinsert),
  rgb(fillColor.color_shortinsert),
  rgb(fillColor.color_interchrom),
  rgb(fillColor.color_pair_ll),
  rgb(fillColor.color_pair_rr),
  rgb(fillColor.color_pair_rl),
  rgb(fillColor.color_longread_rev_fwd),
]

// Samplot-style palette: indices 0..3 are DEL, DUP, INV, BND; remaining slots
// reuse insertSize fallbacks so any out-of-range colorType still renders.
export const samplotArcColorPalette: RGBColor[] = [
  rgb(fillColor.color_samplot_del),
  rgb(fillColor.color_samplot_dup),
  rgb(fillColor.color_samplot_inv),
  rgb(fillColor.color_samplot_bnd),
  rgb(fillColor.color_pair_ll),
  rgb(fillColor.color_pair_rr),
  rgb(fillColor.color_pair_rl),
  rgb(fillColor.color_longread_rev_fwd),
]

export const arcLineColorPalette: RGBColor[] = [
  rgb(fillColor.color_interchrom),
  rgb(fillColor.color_longinsert),
]

export function getArcPalette(colorByType: ArcColorByType | undefined): RGBColor[] {
  return colorByType === 'samplot' ? samplotArcColorPalette : arcColorPalette
}

export const sashimiColorPalette: RGBColor[] = [
  rgb(fillColor.color_longinsert),
  rgb(fillColor.color_interchrom),
]
