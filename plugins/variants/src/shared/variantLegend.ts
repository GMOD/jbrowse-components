import { set1 } from '@jbrowse/core/ui/colors'
import { measureText } from '@jbrowse/core/util'

import {
  NO_CALL_COLOR,
  OTHER_ALT_COLOR,
  REFERENCE_COLOR,
  UNPHASED_COLOR,
  capitalizeFirst,
  getAltColorForDosage,
} from './constants.ts'
import { CONSEQUENCE_IMPACT_JEXL, IMPACT_TIERS } from './variantConsequence.ts'

import type { Source } from './types.ts'
import type {
  LegendItem,
  LegendSection,
} from '@jbrowse/plugin-linear-genome-view'

const LABEL_PADDING_PX = 10
const SWATCH_ONLY_WIDTH_PX = 20

// Width of the legend label column: the widest sample label at the given font
// size plus padding, or a fixed swatch width when labels are hidden.
export function getMaxLabelWidth({
  sources,
  fontSize,
  canDisplayLabels,
}: {
  sources: Source[] | undefined
  fontSize: number
  canDisplayLabels: boolean
}) {
  let maxWidth = 0
  if (sources) {
    for (const s of sources) {
      const width = canDisplayLabels
        ? measureText(s.label ?? s.name, fontSize) + LABEL_PADDING_PX
        : SWATCH_ONLY_WIDTH_PX
      if (width > maxWidth) {
        maxWidth = width
      }
    }
  }
  return maxWidth
}

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
  // A single group (whether unset '' or one shared real value) distinguishes
  // nothing, so the group legend is omitted — matches getVariantLegendSections'
  // "omitted when colorBy is unset or carries a single value".
  if (counts.size <= 1) {
    return []
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value]) => ({
      color: colorByValue.get(value),
      label: value || '(unlabeled)',
    }))
}

// The legend split into independently-closable sections: the genotype/cell
// coloring and (when colorBy is set) the sample-grouping coloring used for the
// sidebar row labels — two distinct color meanings that share one legend box.
// The group section is omitted when colorBy is unset or carries a single value.
export function getVariantLegendSections({
  renderingMode,
  hasSecondaryAlt,
  hasUnphased,
  featureColor,
  colorBy,
  sources,
}: {
  renderingMode: string
  hasSecondaryAlt: boolean
  hasUnphased: boolean
  // Per-variant cell color override; '' = default genotype coloring. When set,
  // cells aren't genotype-colored, so the genotype legend is replaced — by the
  // impact-tier key for the known consequence preset, or dropped for an
  // arbitrary custom expression we can't build a key for.
  featureColor: string
  colorBy: string
  sources: Source[] | undefined
}): LegendSection[] {
  const groupItems = getSampleGroupLegendItems(colorBy, sources)
  const cellSection: LegendSection | undefined = featureColor
    ? featureColor === CONSEQUENCE_IMPACT_JEXL
      ? {
          id: 'consequenceImpact',
          title: 'Consequence impact',
          items: IMPACT_TIERS.map(t => ({ color: t.color, label: t.tier })),
        }
      : undefined
    : {
        id: 'genotypes',
        title: 'Genotypes',
        items: getGenotypeLegendItems({
          renderingMode,
          hasSecondaryAlt,
          hasUnphased,
        }),
      }
  return [
    ...(cellSection ? [cellSection] : []),
    ...(groupItems.length
      ? [
          {
            id: 'group',
            title: capitalizeFirst(colorBy) || 'Samples',
            items: groupItems,
          },
        ]
      : []),
  ]
}
