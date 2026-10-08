import {
  getMafColorPalette,
  getMafLabelColors,
} from '../LinearMafRenderer/util.ts'

import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

/**
 * The display's base table read per character, so a base is one colour in the
 * track and in the widget. Resolve once per paint, not per cell.
 */
export function getSequenceColors(palette: JBrowsePalette) {
  const { colorForBase, unknownBaseColor } = getMafColorPalette(palette)
  const { forBase, unknownBase } = getMafLabelColors(palette)
  const fill = (base: string) =>
    colorForBase[base.toLowerCase()] ?? unknownBaseColor
  return {
    fill,
    /** Glyph color for a sequence cell: gaps/missing-data grays, otherwise the
     *  contrast color over a tinted background or the base color on plain. */
    text: (base: string, colorBackground: boolean) =>
      base === '-'
        ? palette.grey[400]
        : base === '.'
          ? palette.grey[500]
          : colorBackground
            ? (forBase[base.toLowerCase()] ?? unknownBase)
            : fill(base),
  }
}
