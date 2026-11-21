import { htmlToPlainText } from '@jbrowse/plugin-features/band'

import {
  INTERNAL_SOURCE_KEYS,
  capitalizeFirst,
} from '../../shared/constants.ts'

import type { Source } from '../../shared/types.ts'

// Friendly labels + display order for the variant fields that buildVariantHit
// produces (VariantTooltipFields). The hovered row's sample metadata (from
// samplesTsv) renders after these, capitalized to match the "Color samples
// by" menu and legend labels.
const VARIANT_FIELD_LABELS: Record<string, string> = {
  featureName: 'Name',
  genotype: 'Genotype',
  alleles: 'Alleles',
  length: 'Length',
  insertion: 'Insertion',
  description: 'Description',
  carriers: 'Carriers',
  pile: 'Drawn here',
}

interface TooltipRow {
  key: string
  label: string
  value: string
}

export interface TooltipSource {
  name?: string
  sample?: Source
  [key: string]: unknown
}

// The friendly display override, matching the sidebar legend; `name` is the
// stable hit-test identity.
export function tooltipHeading(source: TooltipSource) {
  return source.sample?.label ?? source.name
}

// Turn a hovered record into ordered, human-labeled rows: variant identity
// first (fixed order), then the hovered row's sample metadata (capitalized),
// a column named like a variant field included. Skips internal plumbing keys
// and empty/undefined values so the table stays free of blank rows.
export function getTooltipRows(source: TooltipSource): TooltipRow[] {
  const rows: TooltipRow[] = []
  for (const key in VARIANT_FIELD_LABELS) {
    const value = source[key]
    if (value !== undefined && value !== '') {
      rows.push({
        key,
        label: VARIANT_FIELD_LABELS[key]!,
        value: String(value),
      })
    }
  }
  const { sample } = source
  if (sample) {
    for (const key in sample) {
      const value = sample[key]
      if (
        !INTERNAL_SOURCE_KEYS.has(key) &&
        value !== undefined &&
        value !== ''
      ) {
        rows.push({
          key: `sample.${key}`,
          label: capitalizeFirst(key),
          value: String(value),
        })
      }
    }
  }
  return rows
}

// The tooltip as plain text, heading first, for "Copy tooltip text"
export function tooltipPlainText(source: TooltipSource) {
  const heading = tooltipHeading(source)
  return [
    ...(heading ? [heading] : []),
    ...getTooltipRows(source).map(
      row => `${row.label}: ${htmlToPlainText(row.value)}`,
    ),
  ].join('\n')
}
