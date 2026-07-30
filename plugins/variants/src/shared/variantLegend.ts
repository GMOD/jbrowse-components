import {
  NO_CALL_COLOR,
  OTHER_ALT_COLOR,
  PRIMARY_ALT_COLOR,
  REFERENCE_COLOR,
  SECONDARY_ALT_COLOR,
  UNPHASED_COLOR,
  capitalizeFirst,
  getAltColorForDosage,
} from './constants.ts'
import { PHASE_SET_COLOR } from './getPhasedColor.ts'
import { CONSEQUENCE_IMPACT_JEXL, IMPACT_TIERS } from './variantConsequence.ts'
import { SV_TYPE_COLOR, svTypeDisplayLabel } from './variantSvType.ts'

import type { Source } from './types.ts'
import type {
  LegendItem,
  LegendSection,
} from '@jbrowse/plugin-linear-genome-view'

// Pure legend builders, split out of MultiSampleVariantBaseModel so they can be
// unit-tested without instantiating the display model. The model's
// `legendItems()` is a thin wrapper that feeds these its scalar getters.

// Genotype-color legend (the cell coloring): allele-dosage shades in
// alleleCount mode, alt-allele colors in phased mode.
export function getGenotypeLegendItems({
  renderingMode,
  hasSecondaryAlt,
  hasUnphased,
  hasNoCall,
  altColorOverride,
}: {
  renderingMode: string
  hasSecondaryAlt: boolean
  hasUnphased: boolean
  hasNoCall: boolean
  // A plain CSS color from `featureColor`: every alt-carrying cell is painted
  // with it, so the alt swatches collapse to one entry in that color. Dosage
  // shading and the secondary-alt color are gone in that case, and saying
  // otherwise would describe a scheme that isn't on screen. Ref, unphased and
  // no-call keep their own colors (see computeVariantMatrixCells).
  altColorOverride?: string
}): LegendItem[] {
  if (altColorOverride) {
    return [
      {
        color: REFERENCE_COLOR,
        label:
          renderingMode === 'phased' ? 'Reference' : 'Homozygous reference',
      },
      { color: altColorOverride, label: 'Alt allele' },
      ...(hasUnphased ? [{ color: UNPHASED_COLOR, label: 'Unphased' }] : []),
      ...(hasNoCall ? [{ color: NO_CALL_COLOR, label: 'No call' }] : []),
    ]
  }
  if (renderingMode === 'phased') {
    return [
      { color: REFERENCE_COLOR, label: 'Reference' },
      { color: PRIMARY_ALT_COLOR, label: 'Alt allele' },
      ...(hasSecondaryAlt
        ? [{ color: SECONDARY_ALT_COLOR, label: 'Other alt allele' }]
        : []),
      ...(hasUnphased ? [{ color: UNPHASED_COLOR, label: 'Unphased' }] : []),
      ...(hasNoCall ? [{ color: NO_CALL_COLOR, label: 'No call' }] : []),
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

// The cell-coloring section for a resolved `featureColor` key: the impact-tier
// key for the consequence preset, the present SV types for the SV-type preset,
// the phasing rule for the phase-set preset, or the genotype key — which is also
// where a plain CSS color lands, since "every alt cell is that color" is a
// genotype key with one alt swatch. Undefined only for a real jexl expression,
// whose output can't be enumerated into swatches.
function getCellColorSection({
  cellColorKey,
  renderingMode,
  hasSecondaryAlt,
  hasUnphased,
  hasNoCall,
  svTypeColors,
}: {
  cellColorKey: string
  renderingMode: string
  hasSecondaryAlt: boolean
  hasUnphased: boolean
  hasNoCall: boolean
  svTypeColors?: Record<string, string>
}): LegendSection | undefined {
  if (cellColorKey === CONSEQUENCE_IMPACT_JEXL) {
    return {
      id: 'consequenceImpact',
      title: 'Consequence impact',
      items: IMPACT_TIERS.map(t => ({ color: t.color, label: t.tier })),
    }
  }
  if (cellColorKey === SV_TYPE_COLOR) {
    return {
      id: 'svType',
      title: 'SV type',
      items: Object.entries(svTypeColors ?? {}).map(([type, color]) => ({
        color,
        label: svTypeDisplayLabel(type),
      })),
    }
  }
  if (cellColorKey === PHASE_SET_COLOR) {
    return {
      id: 'phaseSet',
      title: 'Phase set',
      // No swatch list of the phase sets present: a PS id is an arbitrary
      // per-sample integer with unbounded cardinality in a viewport, so
      // enumerating them is noise that would also have to be truncated
      // arbitrarily. The rule is what a reader needs — equal hue down a row means
      // one phasing block. Ref/no-call/unphased keep their own colors, so those
      // swatches stay literal.
      items: [
        { color: REFERENCE_COLOR, label: 'Reference' },
        { label: 'Alt allele (hue identifies the phase set)' },
        ...(hasUnphased ? [{ color: UNPHASED_COLOR, label: 'Unphased' }] : []),
        ...(hasNoCall ? [{ color: NO_CALL_COLOR, label: 'No call' }] : []),
      ],
    }
  }
  if (cellColorKey.startsWith('jexl:')) {
    return undefined
  }
  return {
    id: 'genotypes',
    title: 'Genotypes',
    items: getGenotypeLegendItems({
      renderingMode,
      hasSecondaryAlt,
      hasUnphased,
      hasNoCall,
      // '' (the default genotype coloring) is falsy, so it reads as "no
      // override" — the same meaning it has in the `featureColor` slot.
      altColorOverride: cellColorKey,
    }),
  }
}

// The legend split into independently-closable sections: the genotype/cell
// coloring and (when colorBy is set) the sample-grouping coloring used for the
// sidebar row labels — two distinct color meanings that share one legend box.
// The group section is omitted when colorBy is unset or carries a single value.
export function getVariantLegendSections({
  renderingMode,
  hasSecondaryAlt,
  hasUnphased,
  hasNoCall,
  featureColor,
  svTypeColors,
  colorBy,
  sources,
}: {
  renderingMode: string
  hasSecondaryAlt: boolean
  hasUnphased: boolean
  hasNoCall: boolean
  // Per-variant cell color override; '' = default genotype coloring. When set,
  // cells aren't genotype-colored, so the genotype legend is replaced — by the
  // impact-tier key for the consequence preset, the present SV types for the SV-
  // type preset, or dropped for an arbitrary custom expression we can't build a
  // key for.
  featureColor: string
  // The worker-assigned color per present SV type; drives the SV-type legend so
  // its swatches match the painted cells. Only read when the SV-type preset is
  // selected.
  svTypeColors?: Record<string, string>
  colorBy: string
  sources: Source[] | undefined
}): LegendSection[] {
  const groupItems = getSampleGroupLegendItems(colorBy, sources)
  // Phase-set coloring exists only on the phased path — the allele-count cell
  // loop never reads PS — so outside phased mode the cells are genotype-colored
  // and the legend has to say that instead of describing a scheme that isn't on
  // screen. Resolved here rather than by forbidding the combination, since
  // renderingMode can change after the color is chosen.
  const cellColorKey =
    featureColor === PHASE_SET_COLOR && renderingMode !== 'phased'
      ? ''
      : featureColor
  const cellSection = getCellColorSection({
    cellColorKey,
    renderingMode,
    hasSecondaryAlt,
    hasUnphased,
    hasNoCall,
    svTypeColors,
  })
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
