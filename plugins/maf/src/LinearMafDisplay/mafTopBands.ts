/**
 * The bands a MAF display stacks above its rows, coverage over
 * conservation, as one pure function. The layout reserving each strip and
 * every reader placing something in it — the render state, the marks, the
 * export, the handles, the labels, the axes and the tooltip — take the band
 * from here.
 */
import { boundStackedBands, stackBands } from '@jbrowse/core/util/bandLayout'

import type { Band, BandPlot, BandStack } from '@jbrowse/core/util/bandLayout'

export const MAF_BAND_ORDER = ['coverage', 'conservation'] as const

export type MafBandKey = (typeof MAF_BAND_ORDER)[number]

/** Where a band sits on the canvas and how many px it reserves. */
export interface MafBandRect {
  top: number
  height: number
}

export interface MafTopBands extends BandStack<MafBandKey> {
  rects: Record<MafBandKey, MafBandRect>
}

function rectOf(stack: BandStack<MafBandKey>, key: MafBandKey) {
  return { top: stack.top[key], height: stack.reserved[key] }
}

/**
 * The stated heights bound against the plot the bands share with the rows
 * (`boundStackedBands`), folded into tops and a bottom, with each band's
 * rect beside the fold.
 */
export function mafTopBands(
  bands: Record<MafBandKey, Band>,
  plot: BandPlot,
): MafTopBands {
  const stack = stackBands(
    MAF_BAND_ORDER,
    boundStackedBands(MAF_BAND_ORDER, bands, plot),
  )
  return {
    ...stack,
    rects: {
      coverage: rectOf(stack, 'coverage'),
      conservation: rectOf(stack, 'conservation'),
    },
  }
}
