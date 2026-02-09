import { colord } from '@jbrowse/core/util/colord'

import { fillColor } from '../../../shared/color.ts'

// RGB color as [r, g, b] where each is 0-1
export type RGBColor = [number, number, number]

// Color palette for the renderer
export interface ColorPalette {
  colorFwdStrand: RGBColor
  colorRevStrand: RGBColor
  colorNostrand: RGBColor
  colorPairLR: RGBColor
  colorPairRL: RGBColor
  colorPairRR: RGBColor
  colorPairLL: RGBColor
  colorBaseA: RGBColor
  colorBaseC: RGBColor
  colorBaseG: RGBColor
  colorBaseT: RGBColor
  colorInsertion: RGBColor
  colorDeletion: RGBColor
  colorSkip: RGBColor
  colorSoftclip: RGBColor
  colorHardclip: RGBColor
  colorCoverage: RGBColor
  colorModificationFwd: RGBColor
  colorModificationRev: RGBColor
}

export function toRgb(color: string): RGBColor {
  const { r, g, b } = colord(color).toRgb()
  return [r / 255, g / 255, b / 255]
}

// Default colors derived from shared/color.ts (fillColor) and theme defaults
// (packages/core/src/ui/theme.ts). Theme-derived colors use the MUI defaults.
export const defaultColorPalette: ColorPalette = {
  colorFwdStrand: toRgb(fillColor.color_fwd_strand),
  colorRevStrand: toRgb(fillColor.color_rev_strand),
  colorNostrand: toRgb(fillColor.color_nostrand),
  colorPairLR: toRgb(fillColor.color_pair_lr),
  colorPairRL: toRgb(fillColor.color_pair_rl),
  colorPairRR: toRgb(fillColor.color_pair_rr),
  colorPairLL: toRgb(fillColor.color_pair_ll),
  // MUI default base colors from @mui/material/colors
  colorBaseA: toRgb('#4caf50'),
  colorBaseC: toRgb('#2196f3'),
  colorBaseG: toRgb('#ff9800'),
  colorBaseT: toRgb('#f44336'),
  // Theme defaults from packages/core/src/ui/theme.ts
  colorInsertion: toRgb('#800080'),
  colorDeletion: toRgb('#404040'),
  colorSkip: toRgb('#009a8a'),
  colorSoftclip: toRgb('#00f'),
  colorHardclip: toRgb('#f00'),
  colorCoverage: toRgb('#cccccc'),
  colorModificationFwd: toRgb('#c8c8c8'),
  colorModificationRev: toRgb('#c8dcc8'),
}
