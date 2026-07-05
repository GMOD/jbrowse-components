export { cssColorToNormalizedRgb as toRgb } from '@jbrowse/core/util/colorBits'

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
  colorBaseN: RGBColor
  colorInsertion: RGBColor
  colorDeletion: RGBColor
  colorSkip: RGBColor
  colorSoftclip: RGBColor
  colorHardclip: RGBColor
  // Coverage-track variants of the interbase indicator colors (inverted
  // histogram + indicator triangles). Identical to the base colors in light
  // mode; lightened in dark mode so they read against the dark track background
  // instead of washing out the way the saturated on-read colors would.
  colorInsertionIndicator: RGBColor
  colorSoftclipIndicator: RGBColor
  colorHardclipIndicator: RGBColor
  colorCoverage: RGBColor
  colorModificationFwd: RGBColor
  colorModificationRev: RGBColor
  colorMutedSnpBase: RGBColor
  colorLongInsert: RGBColor
  colorShortInsert: RGBColor
  colorSupplementary: RGBColor
  // Paired split reads crossing an inversion junction. A dedicated hue (not the
  // RR-pair blue) so the legend swatch is distinguishable from the RR-pair
  // orientation category, which is a different measurement.
  colorSplitInversion: RGBColor
  colorUnmappedMate: RGBColor
  colorInterchrom: RGBColor
}
