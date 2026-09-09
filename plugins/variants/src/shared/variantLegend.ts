import {
  NO_CALL_COLOR,
  OTHER_ALT_COLOR,
  PRIMARY_ALT_COLOR,
  REFERENCE_COLOR,
  SECONDARY_ALT_COLOR,
  UNPHASED_COLOR,
  capitalizeFirst,
  getAltColorForDosage,
  getInsertionColorForDosage,
} from './constants.ts'
import { PHASE_SET_COLOR } from './getPhasedColor.ts'
import { CONSEQUENCE_IMPACT_JEXL, IMPACT_TIERS } from './variantConsequence.ts'
import { SV_TYPE_COLOR, svTypeDisplayLabel } from './variantSvType.ts'

import type { Source } from './types.ts'
import type {
  CategoricalEntry,
  CategoricalScale,
  ColorScale,
} from '@jbrowse/core/ui/colorScale'

// Pure scale builders, split out of MultiSampleVariantBaseModel so they can be
// unit-tested without instantiating the display model. The model's
// `colorScales` feeds these its scalar getters.

// A fixed-vocabulary row: the value is its label.
function entry(label: string, color?: string): CategoricalEntry {
  return { value: label, label, color }
}

// Genotype-color scale (the cell coloring): allele-dosage shades in
// alleleCount mode, alt-allele colors in phased mode.
export function getGenotypeEntries({
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
}): CategoricalEntry[] {
  if (altColorOverride) {
    return [
      entry(
        renderingMode === 'phased' ? 'Reference' : 'Homozygous reference',
        REFERENCE_COLOR,
      ),
      entry('Alt allele', altColorOverride),
      ...(hasUnphased ? [entry('Unphased', UNPHASED_COLOR)] : []),
      ...(hasNoCall ? [entry('No call', NO_CALL_COLOR)] : []),
    ]
  }
  if (renderingMode === 'phased') {
    return [
      entry('Reference', REFERENCE_COLOR),
      entry('Alt allele', PRIMARY_ALT_COLOR),
      ...(hasSecondaryAlt
        ? [entry('Other alt allele', SECONDARY_ALT_COLOR)]
        : []),
      ...(hasUnphased ? [entry('Unphased', UNPHASED_COLOR)] : []),
      ...(hasNoCall ? [entry('No call', NO_CALL_COLOR)] : []),
    ]
  }
  return [
    entry('Homozygous reference', REFERENCE_COLOR),
    entry('Heterozygous alt', getAltColorForDosage(0.5)),
    entry('Homozygous alt', getAltColorForDosage(1)),
    ...(hasSecondaryAlt ? [entry('Other alt allele', OTHER_ALT_COLOR)] : []),
    entry('No call', NO_CALL_COLOR),
  ]
}

// How the legend names the rows whose `colorBy` attribute is blank. The entry
// keeps the blank as its `value`, so a click hands `focusGroup` the value
// itself.
export const UNLABELED_GROUP = '(unlabeled)'

// Sample-grouping scale (the per-row sidebar coloring): one entry per distinct
// `colorBy` metadata value (e.g. population), most-common first, reusing the
// `labelColor` the palette already assigned to that group's sources. Empty
// when colorBy is unset or no sources carry it.
export function getSampleGroupEntries(
  colorBy: string,
  sources: Source[] | undefined,
): CategoricalEntry[] {
  if (!colorBy || !sources?.length) {
    return []
  }
  const counts = new Map<string, number>()
  const colorByValue = new Map<string, string>()
  for (const source of sources) {
    const value = String(source[colorBy] ?? '')
    counts.set(value, (counts.get(value) ?? 0) + 1)
    const { labelColor } = source
    if (labelColor !== undefined) {
      colorByValue.set(value, labelColor)
    }
  }
  // A single group (whether unset '' or one shared real value) distinguishes
  // nothing, so the group scale is omitted — matches getVariantColorScales'
  // "omitted when colorBy is unset or carries a single value".
  if (counts.size <= 1) {
    return []
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value]) => ({
      value,
      label: value || UNLABELED_GROUP,
      color: colorByValue.get(value),
    }))
}

// The two swatches every override-color mode still paints and none of them can
// name: an override applies only to alt-carrying cells, so a reference call
// keeps the grey fill and a no-call keeps the no-call yellow (see
// `getColorAlleleCount`). Without these, an SV-type or consequence key describes
// five colors while most of the picture is the two it left out — which is
// exactly how a reviewer read the yellow no-call column in the RHD figure as
// unexplained. Ref is unconditional because grey is the row background even
// under `referenceDrawingMode: 'skip'`; no-call is gated on there being one.
function getNonAltEntries({
  renderingMode,
  hasNoCall,
}: {
  renderingMode: string
  hasNoCall: boolean
}): CategoricalEntry[] {
  return [
    entry(
      renderingMode === 'phased' ? 'Reference' : 'Homozygous reference',
      REFERENCE_COLOR,
    ),
    ...(hasNoCall ? [entry('No call', NO_CALL_COLOR)] : []),
  ]
}

// The cell-coloring scale for a resolved `featureColor` key: the impact-tier
// key for the consequence preset, the present SV types for the SV-type preset,
// the phasing rule for the phase-set preset, or the genotype key — which is also
// where a plain CSS color lands, since "every alt cell is that color" is a
// genotype key with one alt swatch. Undefined only for a real jexl expression,
// whose output can't be enumerated into swatches.
function getCellColorScale({
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
}): CategoricalScale | undefined {
  if (cellColorKey === CONSEQUENCE_IMPACT_JEXL) {
    return {
      kind: 'categorical',
      id: 'consequenceImpact',
      title: 'Consequence impact',
      entries: [
        ...IMPACT_TIERS.map(t => entry(t.tier, t.color)),
        ...getNonAltEntries({ renderingMode, hasNoCall }),
      ],
    }
  }
  if (cellColorKey === SV_TYPE_COLOR) {
    return {
      kind: 'categorical',
      id: 'svType',
      title: 'SV type',
      entries: [
        ...Object.entries(svTypeColors ?? {}).map(([type, color]) => ({
          value: type,
          label: svTypeDisplayLabel(type),
          color,
        })),
        ...getNonAltEntries({ renderingMode, hasNoCall }),
      ],
    }
  }
  if (cellColorKey === PHASE_SET_COLOR) {
    return {
      kind: 'categorical',
      id: 'phaseSet',
      title: 'Phase set',
      // No swatch list of the phase sets present: a PS id is an arbitrary
      // per-sample integer with unbounded cardinality in a viewport, so
      // enumerating them is noise that would also have to be truncated
      // arbitrarily. The rule is what a reader needs — equal hue down a row means
      // one phasing block. Ref/no-call/unphased keep their own colors, so those
      // swatches stay literal.
      entries: [
        entry('Reference', REFERENCE_COLOR),
        entry('Alt allele (hue identifies the phase set)'),
        ...(hasUnphased ? [entry('Unphased', UNPHASED_COLOR)] : []),
        ...(hasNoCall ? [entry('No call', NO_CALL_COLOR)] : []),
      ],
    }
  }
  if (cellColorKey.startsWith('jexl:')) {
    return undefined
  }
  return {
    kind: 'categorical',
    id: 'genotypes',
    title: 'Genotypes',
    entries: getGenotypeEntries({
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

// The display's color scales, each a section of the key the reader can close
// on its own: the genotype/cell coloring, the insertion marker where one is
// drawn, and (when colorBy is set) the sample-grouping coloring used for the
// sidebar row labels — distinct color meanings that share one legend box. The
// group scale is omitted when colorBy is unset or carries a single value.
export function getVariantColorScales({
  renderingMode,
  hasSecondaryAlt,
  hasUnphased,
  hasNoCall,
  featureColor,
  svTypeColors,
  colorBy,
  sources,
  insertionColor,
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
  // The insertion marker's color, or undefined where no marker is drawn (the
  // matrix display, the slot turned off, or nothing visible inserting bases).
  // Resolved by the display rather than imported, for the same reason
  // `drawVariantInsertionGlyphs` takes it: this is `palette.insertion`, so a
  // custom theme moves the swatch and the glyph together.
  insertionColor?: string
}): ColorScale[] {
  const groupEntries = getSampleGroupEntries(colorBy, sources)
  // Phase-set coloring exists only on the phased path — the allele-count cell
  // loop never reads PS — so outside phased mode the cells are genotype-colored
  // and the legend has to say that instead of describing a scheme that isn't on
  // screen. Resolved here rather than by forbidding the combination, since
  // renderingMode can change after the color is chosen.
  const cellColorKey =
    featureColor === PHASE_SET_COLOR && renderingMode !== 'phased'
      ? ''
      : featureColor
  const cellScale = getCellColorScale({
    cellColorKey,
    renderingMode,
    hasSecondaryAlt,
    hasUnphased,
    hasNoCall,
    svTypeColors,
  })
  return [
    ...(cellScale ? [cellScale] : []),
    // A scale of its own rather than one more swatch on the genotype entries:
    // the marker is drawn in EVERY cell-color mode, while the genotype entries
    // are *replaced* wholesale by the consequence-impact, SV-type or phase-set
    // section — so an entry appended to them would vanish exactly when the
    // cells are colored by SV type. The label names what the number means, not
    // just the color: the review that prompted this reported the marker as "the
    // text like 5593", so the unexplained thing was the count, not the box.
    //
    // Two swatches in allele-count mode, where one row is a whole sample and the
    // bar's shade is the only thing left saying how many copies it carries —
    // the marker covers the dosage-shaded cell underneath. Phased mode needs
    // one: a row there is a single haplotype, which either carries the allele or
    // does not, so zygosity reads as the pattern down a sample's rows. Same
    // split the genotype entries already make ("Reference" vs "Homozygous
    // reference"), and both shades come from `getInsertionColorForDosage` so the key
    // cannot drift from the glyph.
    ...(insertionColor
      ? [
          {
            kind: 'categorical' as const,
            id: 'insertions',
            // The number's meaning rides on the title rather than on every
            // item: as an item label it ran past the legend box and ellipsized
            // to "Insertion, homozygous (label is l...", losing exactly the
            // thing the entry exists to say.
            title: 'Insertions (number = bp)',
            entries:
              renderingMode === 'phased'
                ? [entry('Insertion', insertionColor)]
                : [
                    entry('Homozygous', insertionColor),
                    entry(
                      'Heterozygous',
                      getInsertionColorForDosage(insertionColor, 128),
                    ),
                  ],
          },
        ]
      : []),
    ...(groupEntries.length
      ? [
          {
            kind: 'categorical' as const,
            id: 'group',
            title: capitalizeFirst(colorBy) || 'Samples',
            entries: groupEntries,
          },
        ]
      : []),
  ]
}
