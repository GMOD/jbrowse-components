import { INTERNAL_SOURCE_KEYS, capitalizeFirst } from '../constants.ts'

// Friendly labels + display order for the variant fields that buildVariantHit
// produces (VariantTooltipFields). Metadata attributes carried by the source
// (from samplesTsv) render after these, capitalized to match the "Color samples
// by" menu and legend labels.
const VARIANT_FIELD_LABELS: Record<string, string> = {
  featureName: 'Name',
  genotype: 'Genotype',
  alleles: 'Alleles',
  length: 'Length',
  description: 'Description',
}

export interface TooltipRow {
  key: string
  label: string
  value: string
}

// Turn a hovered {...source, ...hoveredGenotype} record into ordered,
// human-labeled rows: variant identity first (fixed order), then sample
// metadata attributes (capitalized). Skips internal plumbing keys and
// empty/undefined values so the table stays free of blank rows.
export function getTooltipRows(source: Record<string, unknown>): TooltipRow[] {
  const rows: TooltipRow[] = []
  const shown = new Set<string>()
  for (const key in VARIANT_FIELD_LABELS) {
    shown.add(key)
    const value = source[key]
    if (value !== undefined && value !== '') {
      rows.push({
        key,
        label: VARIANT_FIELD_LABELS[key]!,
        value: String(value),
      })
    }
  }
  for (const key in source) {
    if (!shown.has(key) && !INTERNAL_SOURCE_KEYS.has(key)) {
      const value = source[key]
      if (value !== undefined && value !== '') {
        rows.push({ key, label: capitalizeFirst(key), value: String(value) })
      }
    }
  }
  return rows
}
