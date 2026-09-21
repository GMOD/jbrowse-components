import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import {
  thresholdCuts,
  thresholdIndex,
  thresholdLabels,
  thresholdPalette,
} from '@jbrowse/core/util/thresholdScale'

import { LD_FIELD } from './colorConfigSchema.ts'

export interface LdSwatch {
  label: string
  color: string
}

// The LocusZoom r² convention as the display's colour object: the cuts and the
// palette a config author may move, and the two swatches that are not values on
// the r² axis. Hex values match the LocusZoom.js default palette.
export const LD_DOMAIN = ['0.2', '0.4', '0.6', '0.8']
export const LD_PALETTE = [
  '#357ebd',
  '#46b8da',
  '#5cb85c',
  '#eea236',
  '#d43f3a',
]

export const LD_INDEX_SWATCH: LdSwatch = {
  label: 'Index SNP',
  color: '#c951c9',
}
export const LD_MISSING_SWATCH: LdSwatch = {
  label: 'No LD data',
  color: '#b8b8b8',
}

// The title of the display's `legend` value under LD coloring, which both the
// on-screen key and the SVG export render.
export const LD_LEGEND_TITLE = 'r² to index'

export const ldIndexColor = cssColorToABGR(LD_INDEX_SWATCH.color)
export const ldMissingColor = cssColorToABGR(LD_MISSING_SWATCH.color)

interface LdColor {
  domain?: readonly (string | number)[]
  range?: readonly string[]
}

/** Whether a colour object asks for r² to the index SNP. */
export function isLdColoring(
  color: string | { field: string; scale?: string },
): boolean {
  return (
    typeof color === 'object' &&
    color.field === LD_FIELD &&
    color.scale === 'threshold'
  )
}

/** The cuts and colours an LD colour object paints through, defaults filled. */
export function ldColorDefaults(color: LdColor) {
  return {
    domain: color.domain?.length ? color.domain.map(String) : LD_DOMAIN,
    range: color.range?.length ? color.range : LD_PALETTE,
  }
}

// The cuts, and one colour per interval between them. A config moving the cuts
// without restating the palette gets the default categorical palette past its
// end rather than the no-data grey, which would read as "absent from the LD
// data" on points that are in it. Four cuts and the five LocusZoom colours —
// the default — spend the palette exactly and reach neither.
function ldBins(color: LdColor) {
  const { domain, range } = ldColorDefaults(color)
  const cuts = thresholdCuts(domain)
  return { cuts, colors: thresholdPalette(cuts.length + 1, range) }
}

/**
 * Packed ABGR per r² to the index SNP: the palette entry for the bin the value
 * falls in, and the no-data grey for a SNP absent from the LD data.
 */
export function ldBinColor(color: LdColor) {
  const { cuts, colors } = ldBins(color)
  const abgr = colors.map(c => cssColorToABGR(c))
  return (r2: number | undefined) => {
    const bin = r2 === undefined ? -1 : thresholdIndex(r2, cuts)
    return bin < 0 ? ldMissingColor : abgr[bin]!
  }
}

/** Legend rows, top to bottom: index, the r² bins high to low, the no-data grey. */
export function ldLegend(color: LdColor): LdSwatch[] {
  const { cuts, colors } = ldBins(color)
  return [
    LD_INDEX_SWATCH,
    ...thresholdLabels(cuts)
      .map((label, i) => ({ label, color: colors[i]! }))
      .reverse(),
    LD_MISSING_SWATCH,
  ]
}
