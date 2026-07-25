import { featureLocString } from '../ucscShared.ts'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

// feature fields are `unknown` off the serialized feature's index signature
function num(value: unknown) {
  return typeof value === 'number' ? value : undefined
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export interface ResultColumn {
  label: string
  cell: (feature: SimpleFeatureSerialized) => string
}

export const LOCATION_COLUMN: ResultColumn = {
  label: 'Location',
  cell: featureLocString,
}

const STRAND_COLUMN: ResultColumn = {
  label: 'Strand',
  cell: f => (f.strand === -1 ? '-' : '+'),
}

// A BLAT hit answers "how well does it match" (identity) and "how much of what I
// pasted is here" (coverage), which is what tells the real locus from a paralog.
const BLAT_COLUMNS: ResultColumn[] = [
  { label: 'Query', cell: f => text(f.queryName) },
  LOCATION_COLUMN,
  STRAND_COLUMN,
  { label: 'Identity', cell: f => `${num(f.identity) ?? '?'}%` },
  { label: 'Coverage', cell: f => `${num(f.coverage) ?? '?'}%` },
  { label: 'Score', cell: f => String(num(f.score) ?? '') },
]

// hgPcr products carry their size and the primer pair that amplified them
const PCR_COLUMNS: ResultColumn[] = [
  { label: 'Product', cell: f => text(f.name) },
  LOCATION_COLUMN,
  STRAND_COLUMN,
  {
    label: 'Primers',
    cell: f => `${text(f.forwardPrimer)} / ${text(f.reversePrimer)}`,
  },
]

// The columns come from the fields the hits actually carry rather than from a
// flag passed in by the caller, so the table can't claim a column the features
// can't fill.
export function columnsFor(features: SimpleFeatureSerialized[]) {
  return features.some(f => num(f.identity) !== undefined)
    ? BLAT_COLUMNS
    : PCR_COLUMNS
}
