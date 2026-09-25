import { MAX_LEGEND_ITEMS } from '@jbrowse/core/ui/legendSpec'

import type { Feature } from '@jbrowse/core/util'

export const PLOT_FIELD_SAMPLE = 200

// Structure rather than data: a plot of `start` or of `uniqueId` says nothing,
// and `subfeatures` is a tree.
const NON_PLOT_FIELDS = new Set([
  'uniqueId',
  'refName',
  'start',
  'end',
  'subfeatures',
  'parentId',
  'type',
  'name',
  'id',
  'description',
  'CHROM',
  'POS',
])

// A code, not a quantity: +1 and -1 want a palette and never a ramp.
const ALWAYS_CATEGORICAL = new Set(['strand'])

const ROWS_FIELD = 'source'

/** The plottable fields the scanned features carry, split by what they hold. */
export interface PlotFields {
  numeric: string[]
  /** Numeric fields fewer than half the scanned features carry. */
  sparse?: string[]
  /** Text fields few enough values apart that a colour key can name them. */
  categorical: string[]
  /** `source`, where a multi-source adapter lists more than one: a row each. */
  rows?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// What a channel reads as one datum: a one-element list is its element, as a
// VCF INFO value is, and a longer list or a record is no datum at all.
function datumOf(value: unknown) {
  const v: unknown =
    Array.isArray(value) && value.length === 1 ? value[0] : value
  return v === undefined || v === null || v === '' || typeof v === 'object'
    ? undefined
    : v
}

// A record's own fields, and one level into a structured one under the dotted
// path a channel reads it by: `INFO.DP` on a VCF record, `tags.NM` on a read.
function fieldEntries(record: Record<string, unknown>): [string, unknown][] {
  return Object.entries(record).flatMap(([field, value]) =>
    NON_PLOT_FIELDS.has(field)
      ? []
      : isRecord(value)
        ? Object.entries(value).map(([key, member]): [string, unknown] => [
            `${field}.${key}`,
            member,
          ])
        : [[field, value]],
  )
}

function isNumericDatum(v: unknown) {
  return typeof v === 'number'
    ? Number.isFinite(v)
    : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))
}

/**
 * The fields a sample of features carry, each numeric only where every value
 * seen for it read as a finite number and sparse where most features lack it, and a text field only where a colour
 * key could name its values. `source` is a facet only where the adapter lists
 * more than one source, since a GFF3 record's `source` column is not a file,
 * and a multi-BigWig answers each file's features in one run, so a sample
 * would see the first file alone.
 * Enumerated through `toJSON`, not `tags()`: `tags` is `SimpleFeature`'s, and
 * the `Feature` interface an adapter may implement carries only the
 * serializer.
 */
export function scanPlotFields(
  features: readonly Feature[],
  { listedSources }: { listedSources: number },
): PlotFields {
  const numeric = new Map<string, boolean>()
  const carried = new Map<string, number>()
  const values = new Map<string, Set<unknown>>()
  const n = Math.min(features.length, PLOT_FIELD_SAMPLE)
  for (let i = 0; i < n; i++) {
    const record = features[i]!.toJSON()
    for (const [field, value] of fieldEntries(record)) {
      const v = datumOf(value)
      if (v === undefined) {
        continue
      }
      const num = !ALWAYS_CATEGORICAL.has(field) && isNumericDatum(v)
      numeric.set(field, (numeric.get(field) ?? true) && num)
      carried.set(field, (carried.get(field) ?? 0) + 1)
      const seen = values.get(field) ?? new Set()
      if (seen.size <= MAX_LEGEND_ITEMS) {
        seen.add(v)
      }
      values.set(field, seen)
    }
  }
  const fields = [...numeric.keys()].sort()
  const numericFields = fields.filter(f => numeric.get(f)!)
  const sparse = numericFields.filter(f => carried.get(f)! * 2 < n)
  return {
    numeric: numericFields,
    ...(sparse.length > 0 ? { sparse } : {}),
    categorical: fields.filter(
      f => !numeric.get(f)! && values.get(f)!.size <= MAX_LEGEND_ITEMS,
    ),
    ...(listedSources > 1 ? { rows: ROWS_FIELD } : {}),
  }
}
