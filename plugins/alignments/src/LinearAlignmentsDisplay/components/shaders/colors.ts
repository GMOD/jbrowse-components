import { colord } from '@jbrowse/core/util/colord'

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
  colorLongInsert: RGBColor
  colorShortInsert: RGBColor
  colorSupplementary: RGBColor
}

export function toRgb(color: string): RGBColor {
  const { r, g, b } = colord(color).toRgb()
  return [r / 255, g / 255, b / 255]
}
