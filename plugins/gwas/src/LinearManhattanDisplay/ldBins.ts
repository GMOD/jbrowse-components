import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'
import {
  thresholdCuts,
  thresholdIndex,
  thresholdLabels,
  thresholdPalette,
} from '@jbrowse/core/util/thresholdScale'

import { LD_FIELD } from '../GWASAdapter/ldFields.ts'

import type { ShapeName } from '@jbrowse/core/util/markEncoding'

export interface LdSwatch {
  label: string
  color: string
  shape: ShapeName
}

// The LocusZoom r² convention as the display's colour object: the cuts and the
// palette a config author may move. Hex values match the LocusZoom.js default
// palette.
export const LD_DOMAIN = ['0.2', '0.4', '0.6', '0.8']
export const LD_PALETTE = [
  '#357ebd',
  '#46b8da',
  '#5cb85c',
  '#eea236',
  '#d43f3a',
]

// The title of the display's `legend` value under LD coloring, which both the
// on-screen key and the SVG export render.
export const LD_LEGEND_TITLE = 'r² to index'

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

/**
 * Legend rows, top to bottom: the index SNP, a diamond in the colour its r² of
 * 1 paints; the r² bins high to low, each colour the one the encoder's
 * threshold paints; and the grey of a point with no r².
 */
export function ldLegend(color: LdColor): LdSwatch[] {
  const { domain, range } = ldColorDefaults(color)
  const cuts = thresholdCuts(domain)
  const colors = thresholdPalette(cuts.length + 1, range)
  return [
    {
      label: 'Index SNP',
      color: colors[thresholdIndex(1, cuts)]!,
      shape: 'diamond',
    },
    ...thresholdLabels(cuts)
      .map((label, i) => ({
        label,
        color: colors[i]!,
        shape: 'circle' as const,
      }))
      .reverse(),
    { label: 'No LD data', color: NO_CATEGORY_COLOR, shape: 'circle' },
  ]
}
