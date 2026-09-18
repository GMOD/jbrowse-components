import { ALT_HUE, shadeByDosage } from './cellFill.ts'
import {
  NO_CALL_COLOR,
  PRIMARY_ALT_COLOR,
  REFERENCE_COLOR,
  SECONDARY_ALT_COLOR,
  UNPHASED_COLOR,
  capitalizeFirst,
} from './constants.ts'
import { PHASE_SET_COLOR } from './getPhasedColor.ts'
import {
  CONSEQUENCE_IMPACT_JEXL,
  IMPACT_TIERS,
  UNANNOTATED_IMPACT,
  getImpactColor,
} from './variantConsequence.ts'
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
//
// Every swatch comes from the same functions the cells do — `shadeByDosage` for
// the ramp, the scale's own color table for the hue — and every gated entry
// comes from what the worker painted, so the key cannot describe a scheme that
// is not on the screen.

// A fixed-vocabulary row: the value is its label.
function entry(label: string, color?: string): CategoricalEntry {
  return { value: label, label, color }
}

export interface VariantLegendInputs {
  renderingMode: string
  // Painted, not possible: each is true only where the cell loops emitted a
  // cell of that category anywhere in the fetched cell data (see
  // `paintedLegendFlags`).
  hasSecondaryAlt: boolean
  hasUnphased: boolean
  hasNoCall: boolean
  // The cell scale's domain values an alt cell was painted for — impact tiers
  // or SV classes.
  paintedDomain: readonly string[]
  shadeByDosage: boolean
}

// The absent-data categories, which every cell scale paints and none of them
// names: an alt hue applies only to alt-carrying cells, so a reference call
// keeps the grey fill and a no-call keeps the no-call yellow. Ref is
// unconditional because grey is the row background even under
// `referenceDrawingMode: 'skip'`; the other two are gated on having been
// painted.
function absentDataEntries({
  renderingMode,
  hasUnphased,
  hasNoCall,
}: VariantLegendInputs): CategoricalEntry[] {
  return [
    entry(
      renderingMode === 'phased' ? 'Reference' : 'Homozygous reference',
      REFERENCE_COLOR,
    ),
    ...(hasUnphased ? [entry('Unphased', UNPHASED_COLOR)] : []),
    ...(hasNoCall ? [entry('No call', NO_CALL_COLOR)] : []),
  ]
}

// What a one-member alt domain spends its entries on. In allele-count mode
// lightness carries the dosage, so the key shows the ramp's two named stops
// rather than one swatch a reader would have to infer them from; in phased mode
// a row is a haplotype and there is no dosage to show. The labels name the
// dosage, not the zygosity: the ramp is continuous, and a triploid `0/0/1`
// paints at a third, which "Heterozygous alt" did not list.
function altEntries(hue: string, inputs: VariantLegendInputs) {
  if (inputs.renderingMode === 'phased' || !inputs.shadeByDosage) {
    return [entry('Alt allele', hue)]
  }
  return [
    entry('Alt, half dosage (het)', shadeByDosage(hue, 0.5)),
    entry('Alt, full dosage (hom)', shadeByDosage(hue, 1)),
  ]
}

// The genotype scale: the constant alt hue, a plain CSS color from
// `featureColor`, or — in phased mode — the two allele identities.
export function getGenotypeEntries(
  inputs: VariantLegendInputs,
  altColorOverride?: string,
): CategoricalEntry[] {
  const hue = altColorOverride || ALT_HUE
  if (inputs.renderingMode === 'phased' && !altColorOverride) {
    return [
      entry('Reference', REFERENCE_COLOR),
      entry('Alt allele', PRIMARY_ALT_COLOR),
      ...(inputs.hasSecondaryAlt
        ? [entry('Other alt allele', SECONDARY_ALT_COLOR)]
        : []),
      ...(inputs.hasUnphased ? [entry('Unphased', UNPHASED_COLOR)] : []),
      ...(inputs.hasNoCall ? [entry('No call', NO_CALL_COLOR)] : []),
    ]
  }
  const [reference, ...rest] = absentDataEntries(inputs)
  return [reference!, ...altEntries(hue, inputs), ...rest]
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

export const DOSAGE_NOTE = 'Pale: het, full: hom'

// One row per painted domain value, ordered by the scale's own vocabulary.
// Where lightness carries dosage, each row draws its het and hom shades and a
// note row says which is which; otherwise the row is the hue alone.
function domainEntries(
  order: readonly string[],
  inputs: VariantLegendInputs,
  color: (value: string) => string,
  label: (value: string) => string,
): CategoricalEntry[] {
  const painted = inputs.paintedDomain
  const seen = new Set(painted)
  const ranked = order.filter(value => seen.has(value))
  const rest = painted.filter(value => !order.includes(value)).sort()
  const values = [...ranked, ...rest]
  if (inputs.renderingMode === 'phased' || !inputs.shadeByDosage) {
    return values.map(value => ({
      value,
      label: label(value),
      color: color(value),
    }))
  }
  return [
    ...values.map(value => ({
      value,
      label: label(value),
      swatches: [
        { color: shadeByDosage(color(value), 0.5) },
        { color: color(value) },
      ],
    })),
    ...(values.length ? [entry(DOSAGE_NOTE)] : []),
  ]
}

// The cell-coloring scale for a resolved `featureColor` key: the impact tiers
// painted for the consequence preset, the SV classes painted for the SV-type
// preset, the phasing rule for the phase-set preset, or the genotype key —
// which is also where a plain CSS color lands, since "every alt cell is that
// color" is a genotype key with one alt hue. Undefined only for a real jexl
// expression, whose output can't be enumerated into swatches.
function getCellColorScale(
  cellColorKey: string,
  inputs: VariantLegendInputs,
  svTypeColors?: Record<string, string>,
): CategoricalScale | undefined {
  if (cellColorKey === CONSEQUENCE_IMPACT_JEXL) {
    return {
      kind: 'categorical',
      id: 'consequenceImpact',
      title: 'Consequence impact',
      entries: [
        ...domainEntries(
          [...IMPACT_TIERS.map(t => t.tier), UNANNOTATED_IMPACT],
          inputs,
          getImpactColor,
          tier => tier,
        ),
        ...absentDataEntries(inputs),
      ],
    }
  }
  if (cellColorKey === SV_TYPE_COLOR) {
    const colors = svTypeColors ?? {}
    return {
      kind: 'categorical',
      id: 'svType',
      title: 'SV type',
      entries: [
        ...domainEntries(
          Object.keys(colors),
          inputs,
          type => colors[type]!,
          svTypeDisplayLabel,
        ),
        ...absentDataEntries(inputs),
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
      // one phasing block.
      entries: [
        entry('Reference', REFERENCE_COLOR),
        entry('Alt allele (hue identifies the phase set)'),
        ...(inputs.hasUnphased ? [entry('Unphased', UNPHASED_COLOR)] : []),
        ...(inputs.hasNoCall ? [entry('No call', NO_CALL_COLOR)] : []),
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
    // '' (the default genotype coloring) is falsy, so it reads as "no
    // override" — the same meaning it has in the `featureColor` slot.
    entries: getGenotypeEntries(inputs, cellColorKey),
  }
}

/**
 * The display's color scales, each a section of the key the reader can close on
 * its own: the genotype/cell coloring, the insertion marker where one is drawn,
 * and (when colorBy is set) the sample-grouping coloring used for the sidebar
 * row labels. The group scale is omitted when colorBy is unset or carries a
 * single value.
 */
export function getVariantColorScales({
  featureColor,
  svTypeColors,
  colorBy,
  sources,
  insertionMarkers = false,
  ...inputs
}: VariantLegendInputs & {
  // Per-variant cell hue; '' = the default genotype coloring.
  featureColor: string
  // The worker-assigned color per present SV type, so the swatches match the
  // painted cells. Only read when the SV-type preset is selected.
  svTypeColors?: Record<string, string>
  colorBy: string
  sources: Source[] | undefined
  // Whether the display is drawing insertion markers in this window (the
  // matrix display never does, and the regular one only where a marker outgrows
  // its cell).
  insertionMarkers?: boolean
}): ColorScale[] {
  const groupEntries = getSampleGroupEntries(colorBy, sources)
  // Phase-set coloring exists only on the phased path — the allele-count cell
  // loop never reads PS — so outside phased mode the cells are genotype-colored
  // and the legend has to say that instead of describing a scheme that isn't on
  // screen. Resolved here rather than by forbidding the combination, since
  // renderingMode can change after the color is chosen.
  const cellColorKey =
    featureColor === PHASE_SET_COLOR && inputs.renderingMode !== 'phased'
      ? ''
      : featureColor
  const cellScale = getCellColorScale(cellColorKey, inputs, svTypeColors)
  return [
    ...(cellScale ? [cellScale] : []),
    // A section of its own rather than one more entry on the genotype scale:
    // the marker is drawn in EVERY cell-color mode, while the genotype entries
    // are *replaced* wholesale by the consequence-impact, SV-type or phase-set
    // section. It has no swatch, because the marker has no color of its own —
    // it is the cell's color, widened — and what a reader cannot decode is the
    // number: the review that prompted this reported the marker as "the text
    // like 5593".
    ...(insertionMarkers
      ? [
          {
            kind: 'categorical' as const,
            id: 'insertions',
            title: 'Insertions',
            entries: [entry('Widened to inserted bp')],
          },
        ]
      : []),
    ...(groupEntries.length
      ? [
          {
            kind: 'categorical' as const,
            id: 'group',
            title: capitalizeFirst(colorBy) || 'Samples',
            focusesRows: true,
            entries: groupEntries,
          },
        ]
      : []),
  ]
}
