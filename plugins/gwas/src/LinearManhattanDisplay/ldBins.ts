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

// LocusZoom.js's default r² cuts and palette
export const LD_DOMAIN = ['0.2', '0.4', '0.6', '0.8']
export const LD_PALETTE = [
  '#357ebd',
  '#46b8da',
  '#5cb85c',
  '#eea236',
  '#d43f3a',
]

export const LD_LEGEND_TITLE = 'r² to index'

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

/**
 * Legend rows, top to bottom: the index SNP, a diamond in the colour its r² of
 * 1 paints; the r² bins high to low, each colour the one the encoder's
 * threshold paints; and the grey of a point with no r².
 */
export function ldLegend({
  domain,
  range,
}: {
  domain: readonly string[]
  range: readonly string[]
}): LdSwatch[] {
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
