import { set1 } from '@jbrowse/core/ui/colors'

import {
  NO_CALL_COLOR,
  OTHER_ALT_COLOR,
  REFERENCE_COLOR,
  UNPHASED_COLOR,
  getAltColorForDosage,
} from './constants.ts'

import type { Source } from './types.ts'
import type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

// Pure legend builders, split out of MultiSampleVariantBaseModel so they can be
// unit-tested without instantiating the display model. The model's
// `legendItems()` is a thin wrapper that feeds these its scalar getters.

// Genotype-color legend (the cell coloring): allele-dosage shades in
// alleleCount mode, alt-allele colors in phased mode.
export function getGenotypeLegendItems({
  renderingMode,
  hasSecondaryAlt,
  hasUnphased,
}: {
  renderingMode: string
  hasSecondaryAlt: boolean
  hasUnphased: boolean
}): LegendItem[] {
  if (renderingMode === 'phased') {
    return [
      { color: REFERENCE_COLOR, label: 'Reference' },
      { color: set1[0], label: 'Alt allele' },
      ...(hasSecondaryAlt
        ? [{ color: set1[1], label: 'Other alt allele' }]
        : []),
      ...(hasUnphased ? [{ color: UNPHASED_COLOR, label: 'Unphased' }] : []),
    ]
  }
  return [
    { color: REFERENCE_COLOR, label: 'Homozygous reference' },
    { color: getAltColorForDosage(0.5), label: 'Heterozygous alt' },
    { color: getAltColorForDosage(1), label: 'Homozygous alt' },
    ...(hasSecondaryAlt
      ? [{ color: OTHER_ALT_COLOR, label: 'Other alt allele' }]
      : []),
    { color: NO_CALL_COLOR, label: 'No call' },
  ]
}

// Sample-grouping legend (the per-row sidebar coloring): one entry per distinct
// `colorBy` metadata value (e.g. population), most-common first, reusing the
// color applyColorPalette already assigned to that group's sources. Empty when
// colorBy is unset or no sources carry it.
export function getSampleGroupLegendItems(
  colorBy: string,
  sources: Source[] | undefined,
): LegendItem[] {
  if (!colorBy || !sources?.length) {
    return []
  }
  const counts = new Map<string, number>()
  const colorByValue = new Map<string, string>()
  for (const source of sources) {
    const value = String(source[colorBy] ?? '')
    counts.set(value, (counts.get(value) ?? 0) + 1)
    const { color } = source
    if (color !== undefined) {
      colorByValue.set(value, color)
    }
  }
  if (counts.size <= 1 && counts.has('')) {
    return []
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value]) => ({
      color: colorByValue.get(value),
      label: value || '(unlabeled)',
    }))
}
