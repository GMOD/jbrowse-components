import type { ColorPalette, RGBColor } from './shaders/colors.ts'

// A full ColorPalette with every channel zeroed, for tests that only assert on
// a few roles. Pass `overrides` to set the colors a case actually checks; the
// explicit literal (no cast) keeps it type-safe as ColorPalette gains fields.
export function makeTestPalette(
  overrides: Partial<ColorPalette> = {},
): ColorPalette {
  const z: RGBColor = [0, 0, 0]
  return {
    colorFwdStrand: z,
    colorRevStrand: z,
    colorNostrand: z,
    colorPairLR: z,
    colorPairRL: z,
    colorPairRR: z,
    colorPairLL: z,
    colorBaseA: z,
    colorBaseC: z,
    colorBaseG: z,
    colorBaseT: z,
    colorBaseN: z,
    colorInsertion: z,
    colorDeletion: z,
    colorSkip: z,
    colorSoftclip: z,
    colorHardclip: z,
    colorCoverage: z,
    colorModificationFwd: z,
    colorModificationRev: z,
    colorMutedSnpBase: z,
    colorLongInsert: z,
    colorShortInsert: z,
    colorSupplementary: z,
    colorUnmappedMate: z,
    colorInterchrom: z,
    ...overrides,
  }
}
