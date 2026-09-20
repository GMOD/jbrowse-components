import { SimpleFeature } from '@jbrowse/core/util'
import {
  PREDEFINED_SV_TYPES,
  getVariantSvType,
  svTypeDisplayLabel,
  svTypeFromToken,
} from '@jbrowse/plugin-variants'

import type { GridRow } from './SpreadsheetModel.tsx'

export interface SvTypeTally {
  /** the canonical class: DEL, DUP, INS, INV, CNV, BND, a CN state, MIXED */
  type: string
  /** how a reader sees it named — "Deletion", "Breakend" */
  label: string
  count: number
}

/**
 * A row's SV class, or undefined for a record that is not a structural variant.
 * The ALT decides where it can, since it distinguishes what SVTYPE folds
 * together (a `<CN3>` keeps its copy number). A row carrying the declared type
 * and no parsed record — one restored from an older session — is classed from
 * the `field` column's token.
 */
export function rowSvType(row: GridRow, field?: string) {
  const raw = field ? row[field] : undefined
  return (
    (row.feature
      ? getVariantSvType(new SimpleFeature(row.feature))
      : svTypeFromToken(typeof raw === 'string' ? raw : '')) || undefined
  )
}

const CANONICAL_ORDER = Object.fromEntries(
  PREDEFINED_SV_TYPES.map((t, i) => [t.type, i]),
)

/**
 * The structural-variant classes present in a set of rows, in the order a
 * legend reads them.
 *
 * One tally for both places the view names an SV class — the "Filter by SV
 * type" dropdown and the circle's legend. They used to derive it separately and
 * disagreed: the dropdown listed the raw `INFO.SVTYPE` column values while the
 * legend bucketed by ALT, so a sniffles callset offered `TRA` in one control
 * and counted 273 `Breakend` in the other, inches apart.
 *
 * The class is what the circle draws and what a reader is looking at, so it is
 * the vocabulary both use, and `rowSvType` is what the sheet filters rows by.
 *
 * Records that are not structural variants (a plain SNV in a mixed VCF) have no
 * class and are left out rather than tallied under an empty label.
 */
export function tallySvTypes(rows: GridRow[] | undefined, field?: string) {
  const tally = new Map<string, number>()
  for (const row of rows ?? []) {
    const type = rowSvType(row, field)
    if (type) {
      tally.set(type, (tally.get(type) ?? 0) + 1)
    }
  }
  return [...tally]
    .map(([type, count]) => ({ type, label: svTypeDisplayLabel(type), count }))
    .sort(
      (a, b) =>
        (CANONICAL_ORDER[a.type] ?? Number.POSITIVE_INFINITY) -
          (CANONICAL_ORDER[b.type] ?? Number.POSITIVE_INFINITY) ||
        a.type.localeCompare(b.type),
    ) satisfies SvTypeTally[]
}
