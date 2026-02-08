import { colord } from '@jbrowse/core/util/colord'

// RGB color as [r, g, b] where each is 0-1
export type RGBColor = [number, number, number]

// Color palette for the renderer - matches shared/color.ts and theme
export interface ColorPalette {
  // Read/alignment colors from shared/color.ts
  colorFwdStrand: RGBColor // #EC8B8B
  colorRevStrand: RGBColor // #8F8FD8
  colorNostrand: RGBColor // #c8c8c8
  colorPairLR: RGBColor // lightgrey
  colorPairRL: RGBColor // teal
  colorPairRR: RGBColor // #3a3a9d
  colorPairLL: RGBColor // green
  // Theme colors for bases (A, C, G, T)
  colorBaseA: RGBColor // green (#4caf50)
  colorBaseC: RGBColor // blue (#2196f3)
  colorBaseG: RGBColor // orange (#ff9800)
  colorBaseT: RGBColor // red (#f44336)
  // Theme colors for indels/clips
  colorInsertion: RGBColor // purple (#800080)
  colorDeletion: RGBColor // grey (#808080)
  colorSkip: RGBColor // teal/blue (#97b8c9)
  colorSoftclip: RGBColor // blue (#00f)
  colorHardclip: RGBColor // red (#f00)
  // Coverage color
  colorCoverage: RGBColor // light grey
  // Modification mode read colors
  colorModificationFwd: RGBColor // #c8c8c8
  colorModificationRev: RGBColor // #c8dcc8 (slightly green)
}

// Default colors matching shared/color.ts fillColor values and theme
export const defaultColorPalette: ColorPalette = {
  // Read colors
  colorFwdStrand: [0.925, 0.545, 0.545], // #EC8B8B
  colorRevStrand: [0.561, 0.561, 0.847], // #8F8FD8
  colorNostrand: [0.784, 0.784, 0.784], // #c8c8c8
  colorPairLR: [0.827, 0.827, 0.827], // lightgrey (#d3d3d3)
  colorPairRL: [0, 0.502, 0.502], // teal
  colorPairRR: [0.227, 0.227, 0.616], // #3a3a9d
  colorPairLL: [0, 0.502, 0], // green
  // Base colors (MUI theme)
  colorBaseA: [0.298, 0.686, 0.314], // green (#4caf50)
  colorBaseC: [0.129, 0.588, 0.953], // blue (#2196f3)
  colorBaseG: [1, 0.596, 0], // orange (#ff9800)
  colorBaseT: [0.957, 0.263, 0.212], // red (#f44336)
  // Indel/clip colors (theme)
  colorInsertion: [0.502, 0, 0.502], // purple (#800080)
  colorDeletion: [0.502, 0.502, 0.502], // grey (#808080)
  colorSkip: [0.592, 0.722, 0.788], // teal/blue (#97b8c9)
  colorSoftclip: [0, 0, 1], // blue (#00f)
  colorHardclip: [1, 0, 0], // red (#f00)
  // Coverage color
  colorCoverage: [0.8, 0.8, 0.8], // light grey (#cccccc)
  // Modification mode read colors
  colorModificationFwd: [0.784, 0.784, 0.784], // #c8c8c8
  colorModificationRev: [0.784, 0.863, 0.784], // #c8dcc8
}

export function cssColorToRgb(color: string): RGBColor {
  const { r, g, b } = colord(color).toRgb()
  return [r / 255, g / 255, b / 255]
}
